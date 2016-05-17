var sendPushWithData = exports.sendPushWithData = function(query, data) {
  
  Parse.Push.send({
    
    where: query,
    
    data: data
  }, { useMasterKey: true });
}

var sendPushToUser = function(payload, destination) {
  
  var query = new Parse.Query(Parse.Installation);
  
  query.equalTo('user', destination);
  
  sendPushWithData(query, payload);
}


var sendPushToUsers = function(request, activity, destination) {
  
  alertPayload(request, activity, false, function(payload) {
    
    sendPushToUser(payload, destination);
  });
  
  alertPayload(request, activity, true, function(payload) {
    
    sendPushToUser(payload, request.user);
  });
}

var sendRejectRequestPush = function(request, activity) {

  var payload = {
      
      notification_type: activity.get('type'),
      notification_subtype: activity.get('subtype'),
      status: activity.get('status'),
      source: activity.get('source').id,
      destination: activity.get('destination').id,
      activityId:activity.id,
      id: request.object.id
    };

    activity.get('source').fetch().then(function(source) {

      sendPushToUser(payload, source);

      return activity.get('destination').fetch();

    }).then(function(destination) {

      sendPushToUser(payload, destination);
    });
}

exports.newActivity = function(request, type, destination) {
  
  var Activity = Parse.Object.extend("Activity");
  
  var query = new Parse.Query(Activity);

  query.equalTo("contentId", request.object.id);
  
  query.find().then(function(activity) {
    
    if(activity.length > 0) {
      
      updateActivityStatus(request, activity[0], destination);
      
    } else {
      
      createNewActivity(request, type, destination, Activity);
    }
  });
}

var alertPayload = function(request, activity, isFeedBack, callBack) {
  
  var message = alertMessage(request, activity, isFeedBack, function(message) {
   
    var payload = {
      
      alert: isFeedBack ? '' : message,
      badge: isFeedBack ? '' : "Increment",
      message:message,
      notification_type: activity.get('type'),
      notification_subtype: activity.get('subtype'),
      status: activity.get('status'),
      source: activity.get('source').id,
      destination: activity.get('destination').id,
      activityId:activity.id,
      id: request.object.id
    };

    if (!isFeedBack) {
      payload.sound = "silence.caf";
      payload.badge = 'Increment';
    }
    
    callBack(payload);
  });
}

var alertMessage = function(request, activity, isFeedBack, callBack) {
  
  if (activity.get('type') == 'content') {
    
    alertMessageContent(request, activity, isFeedBack, function(message) {
      callBack(message);
    });
    
  } else {
    
    alertMessageRequest(request, activity, isFeedBack, function(message) {
      callBack(message);
    });
  }
}

var alertMessageRequest = function(request, activity, isFeedBack, callBack) {
  
  var message = "";
  var status = activity.get('status');
  var type = activity.get('subtype');
  var sourceName = activity.get('sourceName');
  var destinationName = activity.get('destinationName');
  
  if (isFeedBack) {
    
    if (type === "friend") {
      
      message = (status === "accepted") ? 'You and ' + sourceName + ' are now friends' : 'Friend Request Sent to ' + destinationName;
    }
    
    if (type === "feature") {
      
      message = (status === "accepted") ? sourceName + ' accepted your feature request' : 'Feature request from ' + destinationName;
    }

    if (type === "featureBusiness") {
      
      message = (status === "accepted") ? '3' : '4';
    }

    if (type === "giftCredit" || type === "giftWallet" || type === "giftTicket") {
      
      message = (status === "accepted") ? 'You accepted '+sourceName+"'s gift" : 'Gift sent to ' + destinationName;
    }
  } else  {
    
    if (type === "friend") {
      
      message = (status === "accepted") ? 'You and ' + destinationName + ' are now friends' : sourceName + ' sent you a friend request.';
    }

    if (type === "feature") {
      
      message = (status === "accepted") ? destinationName + ' accepted your feature request' : 'Feature request from ' + sourceName;
    }

    if (type === "featureBusiness") {
      
      message = (status === "accepted") ? '1' : '2';
    }
    if (type === "giftCredit" || type === "giftWallet" || type === "giftTicket") {
      
      message = (status === "accepted") ? destinationName + ' accepted your gift' : sourceName + ' sent you a gift';
    }
  }
  
  if (type == 'friend' || type == 'feature' || type == 'featureBusiness' || type == 'giftWallet' || type == 'giftCredit' || type == 'giftTicket') {
   
    callBack(message);
    
    return;
  }

  var event = request.object.get('event');
  
  event.fetch().then(function(event) {
    
    if (event.get("atBusinessEvent")) {
      
      return event.get("businessEvent").fetch();
      
    } else {
      
      return event.get('eventDescriptor').fetch();
    }
    
  }).then(function(descriptor) {
    
    var isBusinessEvent = event.get("atBusinessEvent");
    
    var eventName = descriptor.get(isBusinessEvent ? "customName" : "name");
    
    if (isFeedBack) {
      
      if (type === "invite") {
        
        message = (status === "accepted") ? 'You are going to ' + sourceName + ' event' : 'You invited ' + event.get('requestCount') + ' to ' + eventName;
        
      } else if (type === "access") {
        
        message = (status === "accepted") ? 'You are going to ' + eventName + ' with ' + sourceName : 'You want to ' + eventName + ' with ' + destinationName;
      }
      
    } else {
      
      if (type === "invite") {
        
        message = (status === "accepted") ? destinationName + ' accepted your '+ eventName +' invite.' : sourceName + ' invited you to ' + eventName;
        
      } else if (type === "access") {
        
        message = (status === "accepted") ? destinationName + ' accepted your event.' : sourceName + ' wants to go to event.';
      }
    }
    
    callBack(message);
  });
}


var alertMessageContent = function(request, activity, isFeedback, callBack) {
  
  var message = "";
  var subtype = activity.get('subtype');
  
  if (isFeedback) {
    
    message = "Sent " + subtype + " to " + activity.get('destinationName');
    
  } else {
    
    message = activity.get('sourceName') + " sent you " + ((subtype == "image") ? "a photo" : "a video");
  }
  
  callBack(message);
}

var addActivityToManager = function(request, activity, manager, isIncoming, callBack) {
  
  var aRelation = manager.relation("activity");
  
  aRelation.add(activity);
  
  if (activity.get('type') == 'request') {
    
    var requestRelation = manager.relation(isIncoming ? 'incomingPendingRequests' : 'outgoingPendingRequests');
    
    requestRelation.add(request.object);
    
    manager.increment(isIncoming ? 'incomingPendingRequestCount' : 'outgoingPendingRequestCount');
  }
  
  manager.increment('activityCount');
  
  manager.save().then(function(manager) { callBack(manager); });
}

var updateActivityManager = function(request, activity, manager, isIncoming, callBack) {
  
  if (activity.get('type') == 'request' && activity.get('status') != 'pending') {
    
    var requestRelation = manager.relation(isIncoming ? 'incomingPendingRequests' : 'outgoingPendingRequests');
    requestRelation.remove(request.object);
    manager.increment(isIncoming ? 'incomingPendingRequestCount' : 'outgoingPendingRequestCount', -1);
    
    var resolvedRequestRelation = manager.relation(isIncoming ? 'incomingResolvedRequests' : 'outgoingResolvedRequests');
    resolvedRequestRelation.add(request.object);
    manager.increment(isIncoming ? 'incomingResolvedRequestCount' : 'outgoingResolvedRequestCount');
    
    manager.save().then(function(manager) { callBack(manager); });
  }
}

var createNewActivity = function(request, type, destination, Activity) {
  
  var source = request.object.get( (type == 'content') ? 'owner' : 'source');
  
  var activity = new Activity();
  
  activity.set("contentId", request.object.id);
  
  activity.set("type", type);
  
  activity.set("subtype", request.object.get('type'));
  
  activity.set("destination", destination);
  
  activity.set("status", request.object.get('status'));
  
  activity.set("source", source);
  
  source.fetch().then(function(source) {
    
    return destination.fetch();
    
  }).then(function(destination) {
    
    activity.set("destinationName", destination.get('name'));
    
    activity.set("sourceName", source.get("name"));
    
    activity.save().then(function(activity) {
      
      var managerQuery = new Parse.Query(Parse.Object.extend("ActivityManager"));
      
      managerQuery.containedIn('owner', [activity.get('destination'), activity.get('source')]);
      
      return managerQuery.find();
      
    }).then(function(manager) {
      
      var destinationManager = (manager[0].id == destination.get('activityManager').id) ? manager[0] : manager[1];
      
      var sourceManager = (manager[1].id == destination.get('activityManager').id) ? manager[0] : manager[1];
      
      addActivityToManager(request, activity, destinationManager, true, function(manager) {
        
        addActivityToManager(request, activity, sourceManager, false, function(manager) {
          
          sendPushToUsers(request, activity, destination);
        });
      });
    });
  });
}

var updateActivityStatus = function(request, activity, destination) {

  var status = request.object.get('status');
  
  activity.set("status", status);
  
  activity.save().then(function(activity) {
    
    var managerQuery = new Parse.Query(Parse.Object.extend("ActivityManager"));
    
    managerQuery.containedIn('owner', [activity.get("destination"), activity.get("source")]);
    
    return managerQuery.find();
    
  }).then(function(manager) {
    
    activity.get("destination").fetch().then(function(destination) {
      
      var destinationManager = (manager[0].id == destination.get('activityManager').id) ? manager[0] : manager[1];
      
      var sourceManager = (manager[1].id == destination.get('activityManager').id) ? manager[0] : manager[1];
      
      updateActivityManager(request, activity, destinationManager, true, function(manager) {
        
        updateActivityManager(request, activity, sourceManager, false, function(manager) {});
      });
    });
    
    if (status == "accepted") {
      
      sendPushToUsers(request, activity, destination);
   }

   if (status == "rejected") {
      
      sendRejectRequestPush(request, activity);
   }
  });
}

exports.destroyObject = function(object) {
  
  if (object) {
    return object.destroy();
  }

  return Parse.Promise.as();
}

exports.destroyAllInQuery = function(query) {
  
  return query.find().then(function(objects) {

    return Parse.Object.destroyAll(objects);
  });
}

exports.queryWithReverseField = function(className, field1, field2, obj1, obj2) {

  var query1 = new Parse.Query(Parse.Object.extend(className));

  query1.equalTo(field1, obj1);

  query1.equalTo(field2, obj2);

  var query2 = new Parse.Query(Parse.Object.extend(className));

  query2.equalTo(field1, obj2);

  query2.equalTo(field2, obj1);

  var query = Parse.Query.or(query1, query2);

  return query;
}

exports.createUserWithId = function(objectId) {

  var user = new Parse.Object("_User");

  user.id = objectId;

  return user;
}