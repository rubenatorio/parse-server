/* Run In Command Line To Test Functions
 curl -X POST \
 -H "X-Parse-Application-Id: 3I7pMee6AvyM5XETuuzHPfKRDEJc6B6oW5fRQl0H" \
 -H "X-Parse-REST-API-Key: L2ZRhpqszSFH1Sfo9OAgSkMSQ8I6EFSulAhhGN6o" \
 -H "Content-Type: application/json" \
 -d '{ Parameter Here}' \
 https://api.parse.com/1/functions/{Function Name Here}
 */

/*
 
 // SUGR-DEV CLOUD CODE KEYS
 "applicationId": "3I7pMee6AvyM5XETuuzHPfKRDEJc6B6oW5fRQl0H",
 "masterKey": "cWgOZxhABzhu8cVBWnLZicjroDN69kI9HUBVzfQx"
 
 // SUGR-LIVE CLOUD CODE KEYS
 "applicationId": "MK5KVBqIzhhM5tIwX9hrKnQLLKpHeJ9O0VHS4Fqp",
 "masterKey": "G1QPMwxoMOfCNALvY7RrQkk9Z2X2yin7kQkemghg"
 
 */

// MUST INCLUDE THESE FILES FOR THEM TO WORK
require('./Content.js');
require('./Request.js');
require('./User.js');
require('./phone.js');
require('./strings.js');
require('./Channels.js');
require('./Business.js');
require('./Activity.js');
require('./Event.js');
require('./Payment.js');
require('./TabCredit.js');

var _ = require("underscore");

/************************
 * CLOUD CODE FUNCTIONS
 *************************/

 Parse.Cloud.define("businessNameToKeywords", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var query = new Parse.Query(Parse.Object.extend("Business"));

  query.find().then(function(businesses) {

    for (var i = 0; i < businesses.length; i++) {

      var business = businesses[i];

      var toLowerCase = function(w) { return w.toLowerCase(); };

      var words = business.get("name").split(" ");
      words = _.map(words, toLowerCase);
      var stopWords = ["the", "in", "and"];
      words = _.filter(words, function(w) { return !_.contains(stopWords, w); });
      business.set("keywords", words);
    }

    Parse.Object.saveAll(businesses, {
      success: function(businesses) {
        resp.success("Updated: " + businesses.length + "businesses");
      },
      error: function(error) {
        resp.error(error);
      }
    });
  });
});

// Parse.Cloud.define("updateBusiness", function(req, resp) {
    
//     Parse.Cloud.useMasterKey();
    
//     var currentUser = Parse.User.current();

//     var query = new Parse.Query(Parse.Object.extend("BusinessContentManager"));
    
//     query.limit(200);
    
//     query.find().then(function(contentManagers) {
        
//         for (var i = 0; i < contentManagers.length; i++) {
            
//             var contentManager = contentManagers[i];
            
//             var admins = contentManager.relation("admins");

//             admins.add(currentUser);
//         }
        
//         Parse.Object.saveAll(contentManagers, {
//         success: function(businesses) {
//             resp.success("Updated: " + contentManagers.length + "contentManagers");
//         },
//         error: function(error) {
//             resp.error(error);
//         }
//         });
//     });
// });

Parse.Cloud.define("updateUsers", function(req, resp) {

 Parse.Cloud.useMasterKey();

 var query = new Parse.Query(Parse.User);

 query.find().then(function(users) {

   for (var i = 0; i < users.length; i++) {

     var user = users[i];
     
     user.set("creditCards", []);
     
   }

   Parse.Object.saveAll(users, {
     success: function(users) {
       resp.success("Updated: " + users.length + "businesses");
     },
     error: function(error) {
       resp.error(error);
     }
   });
 });
});

Parse.Cloud.define("updateCraig", function(req, resp) {
 
  Parse.Cloud.useMasterKey();

  var query = new Parse.Query(Parse.Object.extend("ActivityManager"));

  query.limit(200);

  query.find().then(function(activityManagers) {

    var count = 0;

    var total = activityManagers.length;

    for (var i = 0; i < total; i++) {     

     (function(clsn){

      var activityManager = activityManagers[i];

      var subQuery = activityManager.relation("activity").query();

      subQuery.find().then(function(activitys) {

        activityManager.set("activityCount", activitys.length);

        activityManager.save().then(function() {

          count++;

          if (count > total - 1) resp.success();

        });
      });
    }(i));     
   }     
  }, function(error) {
    resp.error(error);
  });
});
/*
 * Push Notification for Recipients
 * @params contentId - Id of content to retrieve
 */
 Parse.Cloud.define("removeUserFromSugrCube", function(req, resp) {

  console.log("removeUserFromCube");

  Parse.Cloud.useMasterKey();

  var beaconId = req.params.beaconId;

  var currentUser = Parse.User.current();

  var query = new Parse.Query(Parse.Object.extend("SugrCube"));

  query.equalTo("beaconId", beaconId);

  query.equalTo("inRange", currentUser);

  query.find().then(function(sugrCubes) {

    for (var i = 0; i < sugrCubes.length; i++) {

      var sugrCube = sugrCubes[i];

      var inRange = sugrCube.relation("inRange");

      inRange.remove(currentUser);

      sugrCube.increment("inRangeCount", -1);
    }

    Parse.Object.saveAll(sugrCubes, {
      success: function(sugrCubes) {
        resp.success("Updated: " + sugrCubes.length + "sugrcubes");
      },
      error: function(error) {
        resp.error(error);
      }
    });
  });
});

/*
 * Push Notification for Recipients
 * @params contentId - Id of content to retrieve
 */
 Parse.Cloud.define("notifyTargets", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var contentID = req.params.contentId;

  var query = new Parse.Query(Parse.Object.extend("PrivateContent"));

  query.get(contentID, {

    success: function(results) {

      var targets = getTargetsFromUsers(results.get("targets"));

      sendPush(Parse.User.current(), targets, resp);
    },
    error: function(object, error) {

      resp.error("Failed to retrieve Content " + error.message);
    }
  });
});

/*
 * Push Notification for Recipients
 * @params users - array of users
 * @params payload - NSDictionary
 */
 Parse.Cloud.define("sendPushToUsers", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var users = req.params.users;

  var payload = req.params.payload;

  var pushQuery = new Parse.Query(Parse.Installation);

  pushQuery.containedIn("user", users);

  Parse.Push.send({

    where: pushQuery,

    data: payload

  }).then(function() {

    resp.success("Push was sent successfully.")

  }, function(error) {

    resp.error("Push failed to send with error: " + error.message);
  });
});

/*
 * SEND PUSH TO USERS IN THE SAME CITY
 * @PARAMS {contentId}
 */
 Parse.Cloud.define("uploadContentToUsersInCity", function(req, resp) {

  sendPushToLocation(req, resp);
});
/*
 * SEND PUSH TO USERS WITHIN SPECIFIED RADIUS
 * @PARAMS {contentId, radius}
 */
 Parse.Cloud.define("broadcastToUsersInRadius", function(req, resp) {

  sendPushToLocation(req, resp);
});
/*
 * SEND PUSH TO ALL USERS
 * @PARAMS {contentId}
 */
 Parse.Cloud.define("broadcastToAllUsers", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var currentUser = Parse.User.current();

  var contentID = req.params.contentId;

  var query = new Parse.Query(Parse.Object.extend("User"));

  query.find({

    success: function(results) {

      var query = new Parse.Query(Parse.Object.extend("PublicContent"));

      var targets = getTargetsFromUsers(results);

      query.get(contentID, {

        success: function(result) {

          result.set("targets", targets);

          var aRelation = result.relation("recipients");

          aRelation.add(results);

          result.save();

          sendPush(currentUser, targets, resp);
        },
        error: function(object, error) {

          resp.error("Failed to retrieve Content " + error.message);
        }
      });
    },
    error: function(object, error) {

      resp.error("Failed to retrieve "+error.message);
    }
  });
});

//  Parse.Cloud.job("updateBeaconId", function(req, resp) {

//   Parse.Cloud.useMasterKey();

//   var query = new Parse.Query(Parse.Object.extend("User"));

//   query.find({

//     success: function(results) {

//       for(var i = 1; i < results.length; i++) {
//         results[i].set("beaconId", i);
//         results[i].save();
//       }
//     },
//     error: function(object, error) {

//       resp.error("Failed to retrieve "+error.message);
//     }
//   });
// });

/*
 * SEND PUSH TO ALL USERS
 * @PARAMS {contentId, beaconIds}
 */
 Parse.Cloud.define("broastcastToBeacons", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var currentUser = Parse.User.current();

  var contentID = req.params.contentId;

  var beaconIds = req.params.beaconIds;

  var query = new Parse.Query(Parse.Object.extend("User"));

  query.containedIn("beaconId", beaconIds);

  query.find({

    success: function(results) {

      var query = new Parse.Query(Parse.Object.extend("PrivateContent"));

      var targets = getTargetsFromUsers(results);

      query.get(contentID, {

        success: function(result) {

          result.set("targets", targets);

          var aRelation = result.relation("recipients");

          aRelation.add(results);

          result.save();

          sendPush(currentUser, targets, resp);
        },
        error: function(object, error) {

          resp.error("Failed to retrieve Content " + error.message);
        }
      });
    },
    error: function(object, error) {

      resp.error("Failed to retrieve "+error.message);
    }
  });
});

Parse.Cloud.define("unFriendUser", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var destination = req.params.destination;
  
  var currentUser = Parse.User.current();
  
  var query = new Parse.Query(Parse.Object.extend("User"));
  
  query.get(destination, {

    success: function(user) {

      var sourceFriends = currentUser.relation("friends");

      isUserInRelation(sourceFriends, user, function(isFriend) {

        if (isFriend) {
          
          var destinationFriends = user.relation("friends");

          sourceFriends.remove(user);

          destinationFriends.remove(currentUser);

          currentUser.increment("friendCount", -1);

          user.increment("friendCount", -1);
          
          Parse.Object.saveAll([currentUser, user], {
            
            success: function(users) {

              var pushQuery = new Parse.Query(Parse.Installation);

              pushQuery.equalTo("user", user);

              Parse.Push.send({

                where: pushQuery,

                data: {  
                  notification_type: 'unfriend',
                  source: currentUser.id,
                  destination: user.id,
                }
              }).then(function() {

                resp.success("Push was sent successfully.")

              }, function(error) {

                resp.error("Push failed to send with error: " + error.message);
              });
            },
            error: function(error) {
              resp.error(error);
            }
          });
        }
      });
    },
    error: function(object, error) {

      resp.error("Failed to Get User: " + error.message);
    }
  });
});

/************************
 * JOBs
 *************************/
/*
 // CHECKS IF CONTENT HAS TYPE FOR 24 HOURS
 Parse.Cloud.job("deleteEphemeralContent", function(req, resp) {
 
 Parse.Cloud.useMasterKey();
 
 var today = new Date();
 
 var expirationDate = new Date(today.getTime() - (24 * 3600 * 1000));
 
 var query = new Parse.Query(Parse.Object.extend("Constraints"));
 
 query.equalTo("type", 0);
 
 query.lessThanOrEqualTo("createdAt", expirationDate);
 
 deleteWithRelation(query, "Constraints", "content", resp);
 });
 
 // CHECKS IF ALL RECIPIENTS LOOKED AT CONTENT
 Parse.Cloud.job("deleteNoTargetContent", function(req, resp) {
 
 Parse.Cloud.useMasterKey();
 
 var query = new Parse.Query(Parse.Object.extend("PublicContent"));
 
 query.doesNotExist("targets");
 
 deleteWithRelation(query, "PublicContent", "constraints", resp);
 
 var query = new Parse.Query(Parse.Object.extend("PrivateContent"));
 
 query.doesNotExist("targets");
 
 deleteWithRelation(query, "PrivateContent", "constraints", resp);
 
 });
*/
/************************
 * HELPER FUNCTIONS
 *************************/

 function print_r(obj) {

  return JSON.stringify(obj);
}

function sendPushToLocation(req, resp) {

  Parse.Cloud.useMasterKey();

  var currentUser = Parse.User.current();

  var contentID = req.params.contentId;

  var radius = req.params.radius;

  var query = new Parse.Query(Parse.Object.extend("User"));

  var className = "";

  if(radius != null) {

    query.withinMiles("currentLocation", currentUser.get("currentLocation"), radius * 0.5);

    query.notEqualTo("objectId", currentUser.id);

    className = "PrivateContent";

  } else {

    query.equalTo("currentCity", currentUser.get("currentCity"));

    className = "PublicContent";
  }

  query.find({

    success: function(results) {

      var query = new Parse.Query(Parse.Object.extend(className));

      var targets = getTargetsFromUsers(results);

      query.get(contentID, {

        success: function(result) {

          result.set("targets", targets);

          result.save();

          var aRelation = result.relation("recipients");

          aRelation.add(results);

          result.save();

          sendPush(currentUser, targets, resp);
        },
        error: function(object, error) {

          resp.error("Failed to retrieve Content " + error.message);
        }
      });
    },
    error: function(object, error) {

      resp.error("Failed to retrieve "+error.message);
    }
  });
}
/* Delete with 1-1 Relation */
function deleteWithRelation(query, table, relation, resp){

  query.find({

    success: function(results) {

      for(var i = 0; i < results.length; i++) {

        var relationPtr = results[i].get(relation);

        relationPtr.destroy();

        results[i].destroy();
      }

      resp.success(table + " Deleted: " + results.length);
    },
    error: function(object, error) {

      resp.error("Failed to retrieve " + table + " " + error.message);
    }
  });
}

function sendPush(user, targets, resp) {

  var message = user.get("username") + " sent you a message";

  var pushQuery = new Parse.Query(Parse.Installation);

  pushQuery.containedIn("user", targets);

  Parse.Push.send({

    where: pushQuery,

    data: { alert: message }

  }).then(function() {

    resp.success("Push was sent successfully.")

  }, function(error) {

    resp.error("Push failed to send with error: " + error.message);
  });
}

function getTargetsFromUsers(users) {

  var _ = require("underscore");

  var targets = _.map(users, function(target) {

    var pointer = new Parse.Object("User");

    pointer.id = target.id;

    return pointer;
  });

  return targets;
}

var isUserInRelation = function(friendRelation, user, callBack) {
  
  var query = friendRelation.query();
  
  query.equalTo("objectId", user.id);
  
  query.find().then(function(user) {
    
    callBack((user.length > 0) ? true : false);
  });
}