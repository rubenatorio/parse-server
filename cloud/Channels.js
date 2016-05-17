var helper = require('./Helper.js');

// query.get("", { success: function(ob){} , error: function(error){resp.error(false);}});


Parse.Cloud.define("featureBusiness", function(req, resp) {

  var contentId  = req.params.contentId;

  var query = new Parse.Query(Parse.Object.extend("PublicContent"));

  query.get(contentId, {

    success: function(content) {

      var business = content.get("checkedInBusiness");

        var contentManager;

        var request;

        business.fetch().then(function(business){

          contentManager = business.get("contentManager");

          return contentManager.fetch();

        }).then(function(contentManager) {

          contentManager.set("lastChannelUpdate", new Date());

          contentManager.set("lastChannelUpdateExpires", new Date((new Date()).getTime() + 86400000));

          return contentManager.relation("admins").query().find();

        }).then(function(admins) {

         for (var i = 0; i < admins.length; i++) 
           if (admins[i].id == req.user.id) {

            contentManager.relation("channel").add(content);
            contentManager.increment("channelCount");
            content.set("didCheckIn", true);

            return Parse.Object.saveAll([contentManager, content]);
          }

          var Request = Parse.Object.extend("Request");

          request = new Request();

          request.set("source", req.user);

          request.set("type", "featureBusiness");

          request.set("status", "pending");

          request.set("hasBeenFetched", false);

          var date = new Date();

          date.setFullYear(date.getFullYear() + 10);

          request.set("expiresAt", date);

          request.set("content", content);

          return Parse.Object.saveAll([contentManager, request]);

        }).then(function() {

          if (!request) return;

          contentManager.relation("requests").add(request);
          contentManager.increment("requestCount");

          content.set("request", request);

          return Parse.Object.saveAll([contentManager, content]);

        }).then(function() { 
          resp.success("successfully saved PublicContent " + content.id);
        }, function(error) { 
          resp.error("error " + error);
        });
    },
    error: function(error) {
      resp.error("Couldn't load Public Content");
    }
  });
});


Parse.Cloud.define("viewedContent", function(req, resp) {

  var destination  = req.params.destination;

  var query = new Parse.Query(Parse.Object.extend("User"));

  query.get(destination, {

    success: function(aUser) {

      var contentManager = aUser.get("contentManager");

      contentManager.fetch({

        success: function(contentManager) {

          contentManager.increment("contentViewCount");

          contentManager.save();

          var currentUser = req.user;

          var message = currentUser.get("name") + " viewed your channel";

          var payload = {

            alert: "",
            message: message,
            notification_type: 'viewed',
            notification_subtype: 'content'
          };

          var pushQuery = new Parse.Query(Parse.Installation);

          pushQuery.equalTo('user', aUser);

          helper.sendPushWithData(pushQuery, payload);

          resp.success(true);
        },
        error: function(myObject, error) {
          resp.error(false);
        }
      });
    },

    error: function(object, error)
    {
      resp.error(false);
    }
  });
});

Parse.Cloud.define("updateUserInteraction", function(req, resp) {

  var UserInteraction = Parse.Object.extend("UserInteraction");

  var userInteraction; 

  var destination = helper.createUserWithId(req.params.destination);

  var options = req.params.options;

  var visitPoint    = 1;
  var viewPoint     = 5;
  var feedbackPoint = 20;
  var textPoint     = 50;
  var facetimePoint = 100;
  var messagePoint  = 20;
  var payPoint      = 100;
  var featurePoint  = 50;
  var unfiendPoint  = 1;

  var points = [visitPoint, viewPoint,feedbackPoint, textPoint, facetimePoint, 
                messagePoint, payPoint, featurePoint, unfiendPoint];

  var source = req.user;

  var query1 = source.relation("userInteractions").query();

  query1.equalTo('user1', source);

  query1.equalTo("user2", destination);

  var query2 = source.relation("userInteractions").query();

  query2.equalTo("user1", destination);

  query2.equalTo("user2", source);

  var query = Parse.Query.or(query1, query2);

  query.first().then(function(interaction) {

    var score = 0;

    var isNew = false;

    if (interaction) {

      userInteraction = interaction;

      score = userInteraction.get("score");
    
    } else {

      isNew = true;

      userInteraction = new UserInteraction();
      userInteraction.set("user1", source);
      userInteraction.set("user2", destination);
      userInteraction.set("friendshipStartDate", new Date(1970, 0, 1));
    }
      
    for (var i = 0; i < options.length; i++) {

      score += options[i] * points[i];
    }

    userInteraction.set("score", score);

      return userInteraction.save().then(function(userInteraction) {

      if (isNew) {
        source.relation("userInteractions").add(userInteraction);
        destination.relation("userInteractions").add(userInteraction);

        return Parse.Object.saveAll([source, destination]);

      } else {

        return Parse.Promise.as();
      }
    });

  }).then(function() {
    resp.success("success");
  }, function(error) { 
    resp.error(error); 
  });
});

// Parse.Cloud.job("hotProfiles", function(req, resp) {

//   Parse.Cloud.useMasterKey();

//   var hotUsers = [];

//     // Delete all hot profiles
//     var HP = Parse.Object.extend("HotProfiles");
    
//     var query = new Parse.Query(HP);
    
//     query.find({

//       success: function(results) {

//         Parse.Object.destroyAll(results, null);
//       },
//       error: function(error) {

//         resp.error("Could not delete hot profiles: " + error);
//       }
//     });
    
//     randomSocialGravity(function() {

//         // Create new hot profiles
//         var userQuery = new Parse.Query(Parse.Object.extend("User"));
        
//         userQuery.descending("socialGravity");

//         userQuery.find({

//           success: function(users) {

//             var tier = users.length * 0.05;

//             for (var i = 0; i < users.length; i++) {

//               var user = users[i];

//               var isHot = (i <= tier);

//               if(isHot) {

//                 var hotProfile = new HP();

//                 hotProfile.set("owner", user);
//                 hotProfile.set("score", user.get("socialGravity"));
//                 hotProfile.save();

//                 hotUsers.push(user);
//               }

//               user.set("isHot", isHot);
//             }

//             Parse.Object.saveAll(users, {

//               success: function(count) {

//                 var payload = alertPayload();

//                 var query = new Parse.Query(Parse.Installation);

//                 query.containedIn('user', hotUsers);

//                 helper.sendPushWithData(query, payload);

//                 resp.success("Saved Successful");
//               },
//               error: function(error) {
//                 resp.error("ERROR");
//               }
//             });
//           },
//           error: function(error)
//           {
//             resp.error("cannot find users: " + error);
//           }
//         });
// });
// });

/*
 
 Parse.Object.saveAll(users, {
     success: function(objs)
     {

     },
     error: function(error)
     {
        resp.error("Error creating hot profiles3");
     }
 });
*/

Parse.Cloud.define("isFriend", function(req, resp) {

  var destination  = req.params.destination;

  var relation = req.user.relation("friends");

  var query = relation.query();

  query.equalTo("objectId", destination);

  query.count({
    success: function(count) {
      resp.success(count);
    },
    error: function(error) {
      resp.error("ERROR");
    }
  });
});

var alertPayload = function() {

  var payload = {

    alert: "You are 🔥🔥🔥",
    message: "You are 🔥🔥🔥",
    notification_type: 'reward',
    notification_subtype: 'hot',
  };

  return payload;
}

var randomSocialGravity = function(callBack) {

    // Create new hot profiles
    var userQuery = new Parse.Query(Parse.Object.extend("User"));
    
    userQuery.find({

      success: function(users) {

        for (var i = 0; i < users.length; i++) {

          var user = users[i];

          var socialGravity = Math.floor(Math.random() * 100000);

          user.set("socialGravity", socialGravity);
        }

        Parse.Object.saveAll(users, {

          success: function(count) {
            callBack();
          },
          error: function(error) {
            resp.error("ERROR");
          }
        });
      },
      error: function(error)
      {
        resp.error("cannot find users: " + error);
      }
    });
  }
