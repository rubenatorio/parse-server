
Parse.Cloud.beforeDelete('Activity', function(request, response) {

  var activity = request.object;

  removeActivity(activity, activity.get('destination')).then(function () {

    return removeActivity(activity, activity.get('source'));

  }).then(function () {

      response.success();
  });
});

var removeActivity = function(activity, owner) {

  var query = new Parse.Query(Parse.Object.extend("ActivityManager"));

  query.equalTo('owner', owner);

  return query.find().then(function(manager) {

    var activityRelation = manager[0].relation('activity');

    activityRelation.remove(activity);

    manager[0].increment('activityCount', -1);

    return manager[0].save();

  }, function(error) { 
    Parse.Promise.error(error);
  });
}

Parse.Cloud.beforeSave('ActivityManager', function(request, response) {

  var activityManager = request.object;

  if (activityManager.isNew()) {

    activityManager.set("outgoingPendingRequestCount", 0);
    activityManager.set("outgoingResolvedRequestCount", 0);
    activityManager.set("incomingPendingRequestCount", 0);
    activityManager.set("incomingResolvedRequestCount", 0);
    activityManager.set("incomingMessagesCount", 0);
    activityManager.set("outgoingMessagesCount", 0);
    activityManager.set("activityCount", 0);
    activityManager.set("activityScore", 0);
    activityManager.set("totalActivity", 0);
    
    response.success();

  } else {

    var relationKeys = ["activity", "outgoingPendingRequests", "outgoingResolvedRequests", 
    "incomingPendingRequests", "incomingResolvedRequests", 
    "incomingMessages", "outgoingMessages"];

    var countKeys = ["activityCount", "outgoingPendingRequestCount", "outgoingResolvedRequestCount", 
    "incomingPendingRequestCount", "incomingResolvedRequestCount", 
    "incomingMessagesCount", "outgoingMessagesCount"];

    var count = 0;

    var total = countKeys.length;

    for (var i = 0; i < total; i++) {     

      (function(clsn){

        updateCountFromRelation(activityManager, relationKeys[i], countKeys[i], function(counts) {

          count++;

          if (count > total - 1) {
            response.success();
          }
        });
      }(i));     
    }
  }
});

var updateCountFromRelation = function(activityManager, relationKey, countKey, fn) {

  var query = activityManager.relation(relationKey).query();

  if (relationKey == "incomingPendingRequests") {

    var query2 = query;

    query2.lessThan("expiresAt", new Date());

    query2.find().then(function (requests){

      return Parse.Object.destroyAll(requests);
    });
  }

  if (relationKey == "incomingMessages") {

    query.notEqualTo("status", "read");
  }

  query.count().then(function (count) {

    activityManager.set(countKey, count);

    fn(count);
  });
}