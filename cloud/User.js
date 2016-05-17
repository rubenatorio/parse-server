var Helper = require('./Helper.js');
var Payment = require('./Payment.js');
var TabCredit = require('./TabCredit.js');

Parse.Cloud.afterSave(Parse.User, function(request, response) {

  var user = request.object;

  if(!user.existed()) {

    updateNewUserData(user);

    generateBeaconId(request, response);

    createUserProfileData(user);

    createManager("ContentManager", "contentManager", user);

    createManager("ActivityManager", "activityManager", user);

    Payment.createStripeCustomer(user);

    TabCredit.createTabCreditForUser(user);
  }
});

var updateNewUserData = function(user) {

  user.set("socialGravity", 0);
  user.set("newUser", true);
  user.set("favoriteLocationCount", 0);
  user.set("sentItemsCount", 0);
  user.set("friendCount", 0);
  user.set("isHot", false);
  user.set("creditCards", []);
  user.set("isHigh", false);
  var json = '{"contentHornCount":[["Horns",[5,10,20,40,80,160],"You recieve this milestone once, your channel has recieved %@ horns.",["horns0.png","horns1.png","horns2.png","horns3.png","horns4.png","horns5.png"],[500,600,700,800,900,1000]],[[false,false,false,false,false,false],0]],"contentLikeCount":[["Likes",[15,20,40,80,160,320],"You recieve this milestone once, your channel has recieved %@ likes.",["likes0.png","likes1.png","likes2.png","likes3.png","likes4.png","likes5.png"],[500,600,700,800,900,1000]],[[false,false,false,false,false,false],0]],"contentLoveCount":[["Loves",[10,15,30,60,120,240],"You recieve this milestone once, your channel has recieved %@ loves.",["loves0.png","loves1.png","loves2.png","loves3.png","loves4.png","loves5.png"],[500,600,700,800,900,1000]],[[false,false,false,false,false,false],0]],"contentViewCount":[["Views",[100,200,400,800,1600,3200],"You recieve this milestone once, your channel has recieved %@ views.",["views0.png","views1.png","views2.png","views3.png","views4.png","views5.png"],[500,600,700,800,900,1000]],[[false,false,false,false,false,false],0]],"friendCount":[["Friends",[10,20,40,80,160,320],"You recieve this milestone once, you are friends with %@ other users.",["friends0.png","friends1.png","friends2.png","friends3.png","friends4.png","friends5.png"],[500,1000,2000,4000,8000,10000]],[[false,false,false,false,false,false],0]],"socialGravity":[["Influence",[50,60,70,80,90,100],"You recieve this milestone once, your influence has reached %@.",["influence0.png","influence1.png","influence2.png","influence3.png","influence4.png","influence5.png"],[500,1000,2000,4000,8000,10000]],[[false,false,false,false,false,false],0]],"totalContentCreated":[["Channel",[50,100,200,400,800,1600],"You recieve this milestone once, you have added %@ items to your channel.",["channel0.png","channel1.png","channel2.png","channel3.png","channel4.png","channel5.png"],[500,1000,2000,4000,8000,10000]],[[false,false,false,false,false,false],0]]}';
  user.set("milestoneData", JSON.parse(json));
  user.set("isUpdatingMilestone", false);
  user.set("milestoneLastUpdate", new Date());
  user.save();
}

function createManager(className, key, owner) {

  var managerClass = Parse.Object.extend(className);

  var manager = new managerClass();

  manager.set("owner", owner);

  manager.save().then(function(manager) {

    return owner.set(key, manager);
  });
}

Parse.Cloud.afterSave('SugrCube', function(request, response) {

  if(!request.object.existed()) {

    generateBeaconId(request, response);
  }
});

Parse.Cloud.beforeDelete(Parse.User, function(request, response) {

  Parse.Cloud.useMasterKey();

  var user = request.object;

  Helper.destroyObject(user.get("activityManager")).then(function() {

    return Helper.destroyObject(user.get("contentManager"));

  }).then(function() {

    return Helper.destroyObject(user.get("profileData"));

  }).then(function() {

    return user.relation("friends").query().find();

  }).then(function(friends) {

    for (var i = 0; i < friends.length; i++) {

      var friend = friends[i];

      friend.increment("friendCount", -1);
    }

    return Parse.Object.saveAll(friends);

  }).then(function() {

      return user.relation("memberships").query().find();

  }).then(function(memberships) {

    return Parse.Object.destroyAll(memberships);

  }).then(function() {

    var query = new Parse.Query(Parse.Object.extend("TabCredit"))

    query.equalTo("objectId", user.get("tabCreditId"));

    return query.first();

  }).then(function(tabCredit) {

    return Helper.destroyObject(tabCredit);

  }).then(function() {

    var query = new Parse.Query(Parse.Object.extend("WalletItem"))

    query.equalTo("owner", user);

    return query.find();

  }).then(function(items) {

    return Parse.Object.destroyAll(items);

  }).then(function() {

    var query = new Parse.Query(Parse.Installation);

    query.equalTo("user", user);

    return query.find();

  }).then(function(installations) {

    return Parse.Object.destroyAll(installations);

  }).then(function() {
    
    response.success();
  });    
});

var updateStats = function(user) {

    /*
    var query = new Parse.Query(Parse.Object.extend("GlobalStatistics"));
    
    query.first({
        
        success: function(globalstat) {
            
            globalStat.increment('total', -1);
            
            var gender = user.get("gender");
            
            globalStat.increment(gender == 'MALE' ? 'male', 'female');
           
        },
        error: function(object, error) {
            
            resp.error("GlobalStatistics object not found");
        }
    });
*/
}

var generateBeaconId = function(request, response) {

  Parse.Cloud.useMasterKey();

  var query = new Parse.Query(Parse.Object.extend("GlobalStatistics"));

  query.find().then(function(stats) {

    stats[0].increment("beaconIdCount");

    return stats[0].save();

  }).then(function(stat) {

    var beaconId = stat.get("beaconIdCount");

    request.object.set("beaconId", beaconId);

    return request.object.save();
  });
}

var createUserProfileData = function(user) {

  var UserProfileData = Parse.Object.extend("UserProfileData");

  var profileData = new UserProfileData();

  profileData.set("genderIndex", -1);
  profileData.set("ageIndex", -1);
  profileData.set("signIndex", -1);
  profileData.set("skinIndex", -1);
  profileData.set("preferenceIndex", -1);
  profileData.set("countryIndex", -1);
  profileData.set("label", "");
  profileData.set("owner", user);

  profileData.save().then(function(data) {

      user.set("profileData", data);
      user.set("profileDataSet", false);

      return user.save();
  });
}