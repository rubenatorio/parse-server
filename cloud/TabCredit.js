
//{ useMasterKey: true } required

Parse.Cloud.define("updateTabCredit", function(request, response) {

  getTabCreditWithId(request.params.tabCreditId).then(function(tabCredit) {

    tabCredit.increment("amount", request.params.amount);

    return tabCredit.save({ useMasterKey: true });

  }).then(function(tabCredit) {
    response.success(tabCredit);
  }, function(error) { 
    response.error("failed to save WalletItem"); 
  });
});

// Parse.Cloud.define("updateAllTabCredit", function(req, resp) {

//  Parse.Cloud.useMasterKey();

//  var query = new Parse.Query(Parse.User);

//  query.find().then(function(users) {

//     var count = 0;
   
//    var total = users.length;
//    for (var i = 0; i < users.length; i++) {     

//      (function(clsn){
           
//            var user = users[i];
        

//            if (!user.get("tabCredit")) {

//               createTabCreditForUser(user, function(error) {
                      
//                              if (error)  response.error(httpResponse.message);

//                count++;

//                if (count > total - 1) response.success(users.length);
//             });

//            } else {
//               count++;

//                if (count > total - 1) response.success(users.length);
//            }
//        }(i));     
//    }
//  });
// });

Parse.Cloud.define("getTabCreditFromCurrentUser", function(request, response) {

  var tabCreditId = request.user.get("tabCreditId");

  getTabCreditWithId(tabCreditId).then(function(tabCredit) {
    response.success(tabCredit);
  }, function(error) { 
    response.error("failed to fetch TabCredit"); 
  });
});

Parse.Cloud.define("getWalletForUser", function(request, response) {

  var tabCreditId = request.user.get("tabCreditId");

  getTabCreditWithId(tabCreditId).then(function(tabCredit) {

    return tabCredit.relation("wallet").query().find({ useMasterKey: true });

  }).then(function(wallet) {
    response.success(wallet);
  }, function(error) { 
    response.error("failed to save WalletItem"); 
  });
});

Parse.Cloud.define("redeemWalletItem", function(request, response) {

  getWalletItemWithId(request.params.walletItemId).then(function(walletItem) {

    walletItem.set("redeemed", true);

    return walletItem.save({ useMasterKey: true })
    
  }).then(function(walletItem) {
    response.success(walletItem);
  }, function(error) { 
    response.error("failed to save WalletItem"); 
  });
});

exports.createTabCreditForUser = function(user) {

  var TabCredit = Parse.Object.extend("TabCredit");
  var tabCredit = new TabCredit();

  var acl = new Parse.ACL();
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  tabCredit.setACL(acl);

  tabCredit.set("user", user);
  tabCredit.set("amount", 0);

  tabCredit.save({ useMasterKey: true }).then(function(tabCredit) {

    user.set("tabCreditId", tabCredit.id);
    
    return user.save();
  });  
}

var getWalletItemWithId = exports.getWalletItemWithId = function(walletItemId) {

  var query = new Parse.Query(Parse.Object.extend("WalletItem"));

  return query.get(walletItemId, { useMasterKey: true }).then(function(walletItem) {
    return walletItem;
  }, function(error) { 
    Parse.Promise.error(error);
  });
}

var getTabCreditWithId = exports.getTabCreditWithId = function(tabCreditId) {

  var query = new Parse.Query(Parse.Object.extend("TabCredit"));

  return query.get(tabCreditId, { useMasterKey: true }).then(function(tabCredit) {
    return tabCredit;
  }, function(error) { 
    Parse.Promise.error(error);
  });
}
