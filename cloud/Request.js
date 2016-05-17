var helper = require('./Helper.js');
var TabCredit = require('./TabCredit.js');

Parse.Cloud.afterSave('Request', function(request, response) {

  Parse.Cloud.useMasterKey();

  var type = request.object.get("type");

  var status = request.object.get("status");

  if(type == "featureBusiness") {

    return;
  }
  
  if(status != "accepted" && request.object.get("hasBeenFetched")) {
    return;
  }
  
  var toUser = "";
  
  if(request.object.existed() && status === "accepted") {

    handleRequest(request.object);
    
    toUser = request.object.get("source");
    
  } else {

    if (request.object.existed() && status === "rejected" && 
     (type == "giftCredit" || type == "giftWallet" || type == "giftTicket")) 
    {

      handleRejectedGift(request.object);
    }

    toUser = request.object.get("destination")
  }

  var type = 'request';

  helper.newActivity(request, type, toUser);

});

Parse.Cloud.beforeDelete('Request', function(request, response) {

  var type = request.object.get('type');
  
  if (type == "featureBusiness") {
    response.success();
    return;
  }
  var source = request.object.get('source');
  
  var destination = request.object.get('destination');
  
  var query = new Parse.Query(Parse.Object.extend("Activity"));
  
  query.equalTo('contentId', request.object.id);
  
  query.find().then(function(activity) {

    if (!activity[0]) {
      response.success();
      return;
    }
    
    if (request.object.get('status') == "pending") {

      activity[0].set('status', "rejected");
    }
    
    activity[0].set('contentId', "deleted");
    
    activity[0].save().then(function(activity) {

      onDeleteUpdateEvent(request.object, function() {

        onDeleteUpdateManager(request, source, true, function() {

          onDeleteUpdateManager(request, destination, false, function() {

            response.success();
          });
        });
      });
    });
  });
});

var onDeleteUpdateEvent = function(request, callBack) {

  if (request.get('status') != 'accepted') return callBack();

  var type = request.get('type');
  
  if (type === "invite") {

    onDeleteUpdateEventHelper(request, 'destination', function() {
      callBack();
    });
    
  } else if (type === "access") {

    return onDeleteUpdateEventHelper(request, 'source', function() {
      callBack();
    });
    
  } else if (type === "friend" || type === "feature") {

    callBack();
  }
}

var onDeleteUpdateManager = function(request, user, isSource, callBack) {

  var status = request.object.get('status')
  
  var query = new Parse.Query(Parse.Object.extend("ActivityManager"));
  
  query.equalTo('owner', user);
  
  query.find().then(function(managers) {

    var activityManager = managers[0];
    
    var decrementKey = "";
    
    if (status == 'pending') {

      decrementKey = (isSource ? 'outgoingPendingRequestCount' : 'incomingPendingRequestCount');
      
    } else  {

      decrementKey = (isSource ? 'outgoingResolvedRequestCount' : 'incomingResolvedRequestCount');
    }
    
    activityManager.increment(decrementKey, -1);
    
    activityManager.save();
    
    callBack();
  });
}

var onDeleteUpdateEventHelper = function(request, user, callBack) {

  var event = request.get('event');
  
  event.fetch().then(function(event) {

    var guestList = event.relation('guestList');
    
    guestList.remove(request.get('destination'));
    
    event.increment('guestListCount', -1);
    
    event.increment('requestCount', -1);
    
    request.get(user).fetch().then(function(user) {

      return user.get('contentManager').fetch();
      
    }).then(function(contentManager) {

      var eventRelation = contentManager.relation('events');
      
      eventRelation.remove(event);
      
      contentManager.increment('eventCount', -1);
      
      event.save().then(function(event) {

        contentManager.save();
        
        callBack();
      });
    });
  });
  
}
/*
 * Save Friend Request, After_Save Request called after
 * @params destination
 */
 Parse.Cloud.define("sendFriendRequestToUser", function(req, resp) {
  
  var currentUser = req.user;
  
  var user = new Parse.Object("_User");

  user.id = req.params.destination;

  console.log("userid: " + currentUser.id);

  isFriend(currentUser, user).then(function(isFriend) { 

    if (isFriend) return Parse.Promise.as();

    var activityManager = currentUser.get("activityManager");

    return activityManager.fetch().then(function(activityManager) {

      var requestQuery = activityManager.relation("outgoingPendingRequests").query();

      requestQuery.equalTo("destination", user);

      return requestQuery.count();

    }).then(function(count) {

      if (count > 0) return Parse.Promise.as();

      var Request = Parse.Object.extend("Request");

      var request = new Request();

      request.set("source", currentUser);

      request.set("destination", user);

      request.set("type", "friend");

      request.set("status", "pending");

      request.set("hasBeenFetched", false);

      var date = new Date();

      date.setFullYear(date.getFullYear() + 10);

      request.set("expiresAt", date);

      return request.save();
    });
  }).then(function() {
    resp.success();
  }, function(error) { 
    resp.error("failed to send friend request"); 
  });
});

Parse.Cloud.define("sendGiftToUser", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var type = req.params.type;

  var destination = req.params.destination;
  
  var currentUser = req.user;
  
  var query = new Parse.Query(Parse.Object.extend("User"));
  
  var user; 

  query.get(destination).then(function(aUser) {

    user = aUser;

    var Request = Parse.Object.extend("Request");
    
    var request = new Request();
    
    request.set("source", currentUser);
    
    request.set("destination", user);
    
    request.set("type", type);
    
    request.set("status", "pending");
    
    request.set("hasBeenFetched", false);
    
    request.set("tabCreditAmount", req.params.amount);

    var date = new Date();
    
    date.setFullYear(date.getFullYear() + 10);
    
    request.set("expiresAt", date);
    
    return request.save();

  }).then(function(request) {

    if (type == "giftCredit") {

      return Parse.Cloud.run('updateTabCredit', { 'amount': -req.params.amount,
        'tabCreditId' : currentUser.get("tabCreditId") }, null);  

    } else {

      return TabCredit.getWalletItemWithId(req.params.walletItemId).then(function(walletItem) {

        walletItem.set("sentToUser", user);

        walletItem.set("didGift", true);

       return walletItem.save();

      }).then(function(walletItem) {
        
        request.set("walletItem", walletItem);

        if (type == "giftWallet") {

          return walletItem.get("incentive").fetch().then(function(incentive) {

            request.set("incentive", incentive);

            request.set("expiresAt", incentive.get("expiresAt"));

              return request.save();
          });

        } else {

          return walletItem.get("ticketDescriptor").fetch().then(function(ticket) {

            request.set("ticketDescriptor", ticket);

            request.set("expiresAt", ticket.get("endDate"));

              return request.save();
          });
        }
      });  
    }
  }).then(function(item) {
    resp.success(item);
  }, function(error) { 
    resp.error("failed to gift"); 
  });
});

Parse.Cloud.define("deleteOutgoingRequest", function(req, resp) {

    /*
    Parse.Cloud.useMasterKey();
    
    var requests = req.params.requests;
    
    Parse.Object.destroyAll(requests, )
    
    var query = new Parse.Query("Request");
    
    query.containedIn("user", requests);
    
    query.find().then(function(requests){
    
        
    });*/
});

Parse.Cloud.define("tagUsers", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var currentUser = req.user;

  var contentId = req.params.contentId;

  var query = new Parse.Query(Parse.Object.extend("User"));

  query.containedIn("objectId", req.params.userIds);

  var users;

  query.find().then(function(aUsers) {

    users = aUsers;

    var query = new Parse.Query(Parse.Object.extend("PublicContent"));

    return query.get(contentId);

  }).then(function(publicContent) {

    var requests = [];

    for (var i = 0; i < users.length; i++) {

      var Request = Parse.Object.extend("Request");

      var request = new Request();

      request.set("source", currentUser);

      request.set("destination", users[i]);

      request.set("type", "feature");

      request.set("status", "pending");

      request.set("hasBeenFetched", false);

      request.set("expiresAt", publicContent.get("expiresAt"));

      request.set("deleted", false);

      request.set("content", publicContent);

      requests.push(request);
    }

    return Parse.Object.saveAll(requests);
    
  }).then(function() { 
    resp.success();
  }, function(error) {
    resp.error();
  }); 
});

var handleRequest = function(request) {

  var type = request.get('type');

  if (type === "invite") {

    handleEvent(request, 'destination');
    
  } else if (type === "access") {

    handleEvent(request, 'source');

  } else if (type === "giftCredit") {

    handleGiftCredit(request);

  } else if (type === "giftWallet" || type === "giftTicket") {

    handleGiftWallet(request);

  } else if (type === "friend") {

    handleFriendRequest(request);
  }
}

var handleFriendRequest = function(request) {

  var source = request.get('source');
  var destination = request.get('destination');

  source.fetch().then(function(source) {

    return destination.fetch();

  }).then(function(destination) {

    var sourceFriends = source.relation('friends');

    isUserInRelation(sourceFriends, destination, function(isFriend) {

      if (isFriend) return;

      var destinationFriends = destination.relation('friends');

      sourceFriends.add(destination);
      destinationFriends.add(source);

      source.increment('friendCount');
      destination.increment('friendCount');

      return Parse.Object.saveAll([source, destination]).then(function() {

        var query1 = source.relation("userInteractions").query();

        query1.equalTo('user1', source);

        query1.equalTo("user2", destination);

        var query2 = source.relation("userInteractions").query();

        query2.equalTo("user1", destination);

        query2.equalTo("user2", source);

        var query = Parse.Query.or(query1, query2);

        return query.first();

      }).then(function(interaction) {

        if (interaction) {

          interaction.set("friendshipStartDate", new Date());

          return interaction.save();

        } else {

          var UserInteraction = Parse.Object.extend("UserInteraction");

          var userInteraction = new UserInteraction();
          userInteraction.set("user1", source);
          userInteraction.set("user2", destination);
          userInteraction.set("friendshipStartDate", new Date());
          userInteraction.set("score", 0);

          return userInteraction.save().then(function(userInteraction) {

            source.relation("userInteractions").add(userInteraction);
            destination.relation("userInteractions").add(userInteraction);

            return Parse.Object.saveAll([source, destination]);
          });
        }
      });
    });
  });
}

var handleEvent = function(request, user) {

  var event = request.get('event');
  
  event.fetch().then(function(event) {

    var guestList = event.relation('guestList');
    
    guestList.add(request.get(user));
    
    event.increment('guestListCount');
    
    request.get(user).fetch().then(function(user) {

      return user.get('contentManager').fetch();
      
    }).then(function(contentManager) {

      var eventRelation = contentManager.relation('events');
      
      eventRelation.add(event);
      
      contentManager.increment('eventCount');
      
      event.save().then(function(event) {

        contentManager.save();
      });
    });
  });
}

var handleGiftWallet = function(request) {

  Parse.Cloud.useMasterKey();

  var walletItem = request.get("walletItem");

  var source = request.get('source');
  
  var destination = request.get('destination');

  source.fetch().then(function(source) {

    return destination.fetch();

  }).then(function(destination) {

    return walletItem.fetch();

  }).then(function(walletItem) {

    return TabCredit.getTabCreditWithId(destination.get("tabCreditId"));

  }).then(function(destinationTab) {

    destinationTab.relation("wallet").add(walletItem);

    return destinationTab.save();

  }).then(function(destinationTab) {

    return TabCredit.getTabCreditWithId(source.get("tabCreditId"));

  }).then(function(sourceTab) {

    sourceTab.relation("wallet").remove(walletItem);

    walletItem.set("owner", destination);

    walletItem.set("didGift", false);

    walletItem.unset("sentToUser");

    return Parse.Object.saveAll([sourceTab, walletItem]);
  });
}

var handleGiftCredit = function(request) {

  Parse.Cloud.useMasterKey();

  var destination = request.get("destination");

  destination.fetch().then(function(destination) {

    return TabCredit.getTabCreditWithId(destination.get("tabCreditId"));

  }).then(function(destinationTab) {

    destinationTab.increment("amount", request.get("tabCreditAmount"));

    return destinationTab.save();
  });
}

var handleRejectedGift = function(request) {

  Parse.Cloud.useMasterKey();

  var type = request.get("type");

  if (type == "giftWallet" || type == "giftTicket") {

    var walletItem = request.get("walletItem");

    walletItem.fetch().then(function(walletItem) {

      walletItem.set("didGift", false);

      walletItem.unset("sentToUser");

      return walletItem.save();
    });

  } else if (type == "giftCredit") {

    var source = request.get("source");

    source.fetch().then(function(source) {

      return TabCredit.getTabCreditWithId(source.get("tabCreditId"));

    }).then(function(sourceTab) {

      sourceTab.increment("amount", request.get("tabCreditAmount"));

      return sourceTab.save();
    });
  }
}

var isUserInRelation = function(friendRelation, user, callBack) {

  var query = friendRelation.query();
  
  query.equalTo("objectId", user.id);
  
  query.find().then(function(user) {

    callBack((user.length > 0) ? true : false);
  });
}

var isFriend = function(currentUser, friend) {

  var query = currentUser.relation("friends").query();

  query.equalTo("objectId", friend.id);
  
  return query.count().then(function(count) {

    return (count > 0) ? true : false;

  }, function(error) { 

    Parse.Promise.error(error);
  });
}

