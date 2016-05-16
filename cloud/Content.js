var helper = require('cloud/Helper.js');

Parse.Cloud.afterSave('PrivateContent', function(request, response) {

  if(!request.object.existed()) {

    var type = "content";
    
    helper.newActivity(request, type, request.object.get('recipient'));
    
  } else {

    var content = request.object;
    
    updateActivity(content).then(function() {

      if (content.get('status') == "read") {

        content.destroy();
      }
    });
  }
});

Parse.Cloud.beforeDelete('PrivateContent', function(request, response) {

  var content = request.object;
  
  updateActivityManager(content, content.get('owner'), true, function() {

    updateActivityManager(content, content.get('recipient'), false, function() {
        response.success();
    });
  });
});

Parse.Cloud.beforeDelete('PublicContent', function(req, resp) {

  var content = req.object;

  var feedbackRelation = content.relation('feedback');

  var query = feedbackRelation.query();

  query.find().then(function(feedback) {

    return Parse.Object.destroyAll(feedback);

  }).then(function() {

    if (!content.get("didCheckIn")) {
      return Parse.Promise.as();
    }

    var business = content.get("checkedInBusiness");

    var request = content.get("request");

    var contentManager;

    return business.fetch().then(function(business) {

      contentManager = business.get("contentManager");

      return contentManager.fetch();
      
    }).then(function(contentManager) {

      contentManager.increment("channelCount", -1);

      return contentManager.save();

    }).then(function() { 

      if (!request) {
        return Parse.Promise.as();
      }
      
      return request.fetch().then(function(request) {

        contentManager.increment("requestCount", -1);

        return request.destroy();

      }).then(function() { 
        resp.success();
      }, function(error) {
        resp.error(error);
      });   
    }).then(function() { 
      resp.success();      
    }, function(error) {
      resp.error(error);
    });
  }).then(function() {

    var query = new Parse.Query(Parse.Object.extend("Request"));

    query.equalTo('content', content);

    return query.find();

  }).then(function(requests) {  
    
    return Parse.Object.destroyAll(requests);
  }).then(function() {
    resp.success();   
  }, function(error) {
    resp.error("Failed to Delete Feedback For Content " + content.id);
  });
});

Parse.Cloud.beforeSave('ContentManager', function(request, response) {

  var contentManager = request.object;

  if (contentManager.isNew()) {

    contentManager.set('acceptedRequestCount', 0);
    contentManager.set('activityScore', 0);
    contentManager.set('channelCount', 0);
    contentManager.set('contentHornCount', 0);
    contentManager.set('contentLikeCount', 0);
    contentManager.set('contentLoveCount', 0);
    contentManager.set('contentViewCount', 0);
    contentManager.set('eventCount', 0);
    contentManager.set('paperTrailCount', 0);
    contentManager.set('rejectedRequestCount', 0);
    contentManager.set('totalContentCreated', 0);
    contentManager.set('totalRequestCount', 0);
    contentManager.set('lastChannelUpdate', new Date());
    contentManager.set('lastChannelUpdateExpires', new Date());
    contentManager.set('totalActivity', 0);
    contentManager.set('statusLevel', 0);

    response.success();

  } else {

      updateContentManager(request, response);
  }
});

Parse.Cloud.beforeSave('BusinessContentManager', function(request, response) {
  
  if (!request.object.isNew()) {

    updateContentManager(request, response);

  } else {
    
    response.success();
  }
});

Parse.Cloud.beforeSave('SugrChannel', function(request, response) {
        
    if (request.object.isNew()) {

      response.success();

    }  else {

      updateContentManager(request, response);
    }
});

Parse.Cloud.define("processReceipt", function(req, resp) {

  var payload = req.params;

  var query = new Parse.Query(Parse.Object.extend("User"));
  
  query.get(payload.destination, {

    success: function(user) {

      var pushQuery = new Parse.Query(Parse.Installation);
      
      pushQuery.equalTo('user', user);
      
      helper.sendPushWithData(pushQuery, payload);
      
      resp.success("Successfully Processed");
    },
    error: function(object, error) {

      resp.error("Failed to Get User: " + error.message);
    }
  });
});

var updateContentManager = function(request, response) {

  var contentManager = request.object;

  var query = contentManager.relation("channel").query();
  
  var now = new Date();

//  query.greaterThan("expiresAt", now);

  query.descending("expiresAt");

  query.find().then(function (contents) {
    
    console.log("count: " + contents.length);

    var contentIds = [];
    var expiresDates = [];

    for (var i = 0; i < contents.length ; ++i) {

      var aContent = contents[i];

      if (aContent.get("expiresAt").getTime() > now.getTime()) {
        contentIds.push(aContent.id);
        expiresDates.push(aContent.get("expiresAt"));
      }
    }
    
    if (contents.length > 0) {

      var aContent = contents[0];

      contentManager.set("lastChannelUpdateExpires", aContent.get("expiresAt"));
    }

    contentManager.set("activeIds", contentIds);

    contentManager.set("activeIdExpirations", expiresDates);

    contentManager.set("channelCount", contents.length);
    
    return response.success();

  }, function(error) { 

    response.error("failed to find contentManager active Ids"); 
  });
}

var updateActivity = function(content) {

  var query = new Parse.Query(Parse.Object.extend("Activity"));

  query.equalTo('contentId', content.id);
  
  return query.first().then(function (activity) {

    activity.set('status', content.get('status'));
    
    if (content.get('status') == "read") {

      activity.set('contentId', "deleted");
    }
    
    return activity.save();
  });
};

var updateActivityManager = function (content, owner, isSource, callBack) {

  var query = new Parse.Query(Parse.Object.extend("ActivityManager"));
  
  query.equalTo('owner', owner);
  
  query.find().then(function(manager) {

    var decrementKey = isSource ? "outgoingMessagesCount" : "incomingMessagesCount";
    
    manager[0].increment(decrementKey, -1);
    
    manager[0].save().then( function(manager) { callBack(); });
  });
}