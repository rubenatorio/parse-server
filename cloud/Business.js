var Helper = require('./Helper.js');

Parse.Cloud.afterSave('Business', function(request, response) {

  var business = request.object;

  if(!business.existed()) {
 
    createContentManager(business).then(function() {

      return newSugrCube(business);

    }).then(function() {

      return business.save();
    });
  }
});

Parse.Cloud.beforeSave('BusinessEvent', function(request, response) {

  var start = request.object.get("startTime");

  var end = request.object.get("endTime");

  request.object.set("endsTomorrow", (end < start));

  response.success();
});


Parse.Cloud.beforeSave('Incentive', function(request, response) {

  var start = request.object.get("startTime");

  var end = request.object.get("endTime");

  request.object.set("endsTomorrow", (end < start));

  response.success();
});

Parse.Cloud.beforeDelete('Business', function(request, response) {

  var business = request.object;

  var cubeRelation = business.relation('sugrCubes');

  var query = cubeRelation.query();

  query.find().then(function(cubes) {

    Parse.Object.destroyAll(cubes);

    var categoryRelation = business.relation('businessCategories');

    var categoryQuery = categoryRelation.query();

    return categoryQuery.find();

  }).then(function(categories) {

    console.log("found categories: " + categories.length);

    for (var i = 0; i < categories.length; i++) {

      categories[i].increment('BusinessCount', -1);
    }

    return Parse.Object.saveAll(categories);

  }).then(function() {

    return Helper.destroyAllInQuery(business.relation('incentives').query());

  }).then(function() {

    return Helper.destroyAllInQuery(business.relation('businessEvents').query());;

  }).then(function() {

    var contentManager = business.get("contentManager");
    var statusManager = business.get("statusManager");

    return Parse.Object.destroyAll([statusManager, contentManager]);

  }).then(function() {
    response.success();
  });
});

Parse.Cloud.define("addSugrCubeToBusiness", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var businessID = req.params.businessId;

  var query = new Parse.Query(Parse.Object.extend("Business"));

  query.get(businessID).then(function(business) {

    return newSugrCube(business);

  }).then(function() {

    response.success();
  });
});

Parse.Cloud.define("sendPushToUserFeaturedBusiness", function(req, resp) {

  Parse.Cloud.useMasterKey();

  var user = new Parse.Object("User");

  user.id = req.params.userId;

  var payload = req.params.payload;

  var pushQuery = new Parse.Query(Parse.Installation);
    
  pushQuery.equalTo('user', user);
    
  Helper.sendPushWithData(pushQuery, payload);

  resp.success("Push Sent To User " + user.id);
});

var newSugrCube = function(business) {

  var SugrCube = Parse.Object.extend("SugrCube");

  var sugrCube = new SugrCube();

  sugrCube.set("femaleCount", 0);
  sugrCube.set("maleCount", 0);
  sugrCube.set("inRangeCount", 0);
  sugrCube.set("chillCount", 0);
  sugrCube.set("playCount", 0);
  sugrCube.set("rageCount", 0);
  sugrCube.set("shadowCount", 0);
  sugrCube.set("vipCount", 0);
  sugrCube.set("watchCount", 0);
  sugrCube.set("shadowCount", 0);
  sugrCube.set("shadowCount", 0);
  sugrCube.set("shadowCount", 0);
  sugrCube.set("owner", business);
  sugrCube.set("location", business.get('location'));

  return sugrCube.save().then(function(cube) {

    business.relation("sugrCubes").add(cube);

    return Parse.Promise.as();
  });
}

var createContentManager = function(business) {

  var BusinessContentManager = Parse.Object.extend("BusinessContentManager");

  var contentManager = new BusinessContentManager();

  contentManager.set("channelCount", 0);
  contentManager.set("contentViewCount", 0);
  contentManager.set("lastChannelUpdate", new Date());
  contentManager.set("lastChannelUpdateExpires", new Date());
  contentManager.set("business", business);
  contentManager.set("requestCount", 0);

  return contentManager.save().then(function() {

    business.set("contentManager", contentManager);

    return Parse.Promise.as();
  });
}
