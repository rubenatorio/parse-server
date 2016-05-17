
var TabCredit = require('cloud/TabCredit.js');
var Stripe = require('stripe');
var stripeSecretKey = 'sk_test_4fRiCtuZlzOoGifq2fEWILtB';
Stripe.initialize(stripeSecretKey);

var baseUrl = "https://" + stripeSecretKey + "@api.stripe.com";

Parse.Cloud.define("purchaseItem", function(request, response) {

  Parse.Cloud.useMasterKey();

  var purchaseId = request.params.purchaseId;

  var query = new Parse.Query(Parse.Object.extend("Purchase"));

  var purchase;

  query.get(purchaseId).then(function(aPurchase) {

    purchase = aPurchase;

    return Stripe.Charges.create({
                    amount: request.params.amount * 100, // express dollars in cents
                    currency: 'usd',
                    source: request.params.cardId,
                    customer: request.user.get("stripeCustomerId")
                  });
  }).then(function(charge) { 

    purchase.set("chargeId", charge.id);

   return purchase.save();

  }).then(function(purchase) { 

    var incentive = purchase.get("incentive");

    if (incentive) {

      incentive.fetch().then(function(incentive) {

        incentive.increment("claimed");

        return incentive.save();

      }).then(function(incentive) { 

        var WalletItem = Parse.Object.extend("WalletItem");
        var walletItem = new WalletItem();

        var acl = new Parse.ACL();
        acl.setPublicReadAccess(false);
        acl.setPublicWriteAccess(false);
        walletItem.setACL(acl);

        walletItem.set("redeemed", false);
        walletItem.set("purchase", purchase);
        walletItem.set("incentive", incentive);
        walletItem.set("business", purchase.get("business"));
        walletItem.set("owner", purchase.get("user"));
        walletItem.set("didGift", false);

        walletItem.save().then(function(walletItem) {

          var tabQuery = new Parse.Query(Parse.Object.extend("TabCredit"));

            return tabQuery.get(request.user.get("tabCreditId"));

        }).then(function(tabCredit) { 
          
          tabCredit.relation("wallet").add(walletItem);

          return tabCredit.save();
        }).then(function() { 
          response.success(purchase);
        }, function(error) { 

          purchase.destroy().then(function() { response.error(error) });

        });  
      });
    } else {
      response.success(purchase);
    }
  }, function(error) { 
    purchase.destroy().then(function() { response.error(error) });
  });
});

Parse.Cloud.define("purchaseTicket", function(request, response) {

  Parse.Cloud.useMasterKey();

  var purchase;

  var walletItems = [];

  var purchaseId = request.params.purchaseId;

  var quantity = request.params.quantity;

  var query = new Parse.Query(Parse.Object.extend("Purchase"));

  query.get(purchaseId).then(function(aPurchase) {

    purchase = aPurchase;

    return Stripe.Charges.create({
                    amount: request.params.amount * 100, // express dollars in cents
                    currency: 'usd',
                    source: request.params.cardId,
                    customer: request.user.get("stripeCustomerId")
                  });
  }).then(function(charge) { 

    purchase.set("chargeId", charge.id);

    return purchase.save();

  }).then(function(purchase) { 
    
    var ticketDescriptor = purchase.get("ticketDescriptor");

    return ticketDescriptor.fetch();

  }).then(function(ticket) {

    if (ticket.get("purchased") >= ticket.get("quantity")) 
      ticket.set("soldOut", true);

    return ticket.save();

  }).then(function(ticket) { 

    for (var i = 0; i < quantity; i++) {

      var WalletItem = Parse.Object.extend("WalletItem");
      var walletItem = new WalletItem();

      var acl = new Parse.ACL();
      acl.setPublicReadAccess(false);
      acl.setPublicWriteAccess(false);
      walletItem.setACL(acl);

      walletItem.set("redeemed", false);
      walletItem.set("purchase", purchase);
      walletItem.set("ticketDescriptor", purchase.get("ticketDescriptor"));
      walletItem.set("business", purchase.get("business"));
      walletItem.set("owner", purchase.get("user"));
      walletItem.set("didGift", false);

      walletItems.push(walletItem);
    }

    return Parse.Object.saveAll(walletItems);

  }).then(function(walletItems) { 

    var tabQuery = new Parse.Query(Parse.Object.extend("TabCredit"));

    return tabQuery.get(request.user.get("tabCreditId"));

  }).then(function(tabCredit) { 

    tabCredit.relation("wallet").add(walletItems);

    return tabCredit.save();

  }).then(function(tabCredit) { 
    response.success(purchase);
  }, function(error) { 

    var ticketDescriptor = purchase.get("ticketDescriptor");

    ticketDescriptor.fetch().then(function(ticket) {
      ticket.increment("purchased", -quantity);
      return ticket.save();
    }).then(function(ticket) { 
      return purchase.destroy();
    });
  });
});

Parse.Cloud.define("checkoutWithCredit", function(request, response) {

  var purchaseId = request.params.purchaseId;

  var stripeAccountId = request.params.accountId;

  var query = new Parse.Query(Parse.Object.extend("Purchase"));

  query.get(purchaseId, {

    success: function(purchase) {

      var endpoint = baseUrl + "/v1/transfers";

      Parse.Cloud.httpRequest({
        url: endpoint,
        method: "POST",
        body: {
          amount: request.params.amount * 100,
          currency: "usd",
          destination: stripeAccountId
        }
      }).then(function(httpResponse) {

        purchase.set("chargeId", httpResponse.data.id);

        purchase.save();

        Parse.Cloud.run("updateTabCredit", { amount:-request.params.amount}).then(function(result) {

          response.success(result);

        }, function(error) {

          response.error(error);
        });

      }, function(error) {

        purchase.destroy();

        response.error(httpResponse);
      });
    },
    error: function(error) {

      response.error("Failed to retrieve purchase: " + error.message);
    }
  });
});

Parse.Cloud.define("saveCardToParse", function(request, response) {

  var customerId = request.user.get("stripeCustomerId");

  var url = "https://" + stripeSecretKey + "@api.stripe.com/v1/customers/"+ customerId + "/sources";

  var cardToken = request.params.cardToken;
  
  Stripe.Tokens.retrieve( cardToken, {

    success: function(token) {

      var creditCards = request.user.get("creditCards");

      var found = false;

      for (var i = 0; i < creditCards.length && !found; i++) {
        if (creditCards[i] === token.card.fingerprint) {
          found = true;
        }
      }

      if (!found) {

        creditCards.push(token.card.fingerprint);

        request.user.save();

        Parse.Cloud.httpRequest({
          url: url,
          method: "POST",
          body: {
            source: cardToken
          }
        }).then(function(httpResponse) {
          response.success(httpResponse.data);
        }, function(error) {
          response.error(error);
        });
      } else {

        response.success(cardToken);
      }
    }, error: function(httpResponse) {
      response.error(httpResponse.message);
    }
  });
});

Parse.Cloud.define("retrieveAllCards", function(request, response) {

  if (!request.user) {
    response.success();
    return;
  }

  var customerId = request.user.get("stripeCustomerId");

  if (!customerId) return createStripeCustomer(request.user, response);

  var url = "https://" + stripeSecretKey + "@api.stripe.com/v1/customers/" + customerId;

  Parse.Cloud.httpRequest({
    url: url,
    method: "POST"
  }).then(function(httpResponse) {
    response.success(httpResponse.data.sources.data);
  }, function(error) {
    response.error(error);
  });
});

//Parse.Cloud.define("retrieveAllCards", function(request, response) {
//
//    var user = request.user;
//
//    var customerId = user.get("stripeCustomerId");
//
//    var cards = [];
//    
//    var count = 0;
//    
//    var total = customerIds.length;
//    
//    for(var i = 0; i < customerIds.length; i++) {
//        
//        (function(clsn){
//            
//            var customerId = customerIds[i];
//         
//            getCustomerFromId(customerId, function(customer) {
//                       
//                              if (customer == null)  response.error(httpResponse.message);
//                cards.push(customer);
//
//                count++;
//
//                if (count > total - 1) response.success(cards);
//            });
//        }(i));
//    }
//});

Parse.Cloud.define("deleteCard", function(request, response) {

  Stripe.Customers.del( request.params.customerId, {
    success: function(customer) {
      response.success(customer);
    }, error: function(httpResponse) {
      response.error(httpResponse.message);
    }
  });
});

Parse.Cloud.define("accountDetails", function(request, response) {

  var endpoint = baseUrl + "/v1/accounts";

  Parse.Cloud.httpRequest({
    url: endpoint,
    method: "POST",
    body: {
      country:'US',
      managed:true
    }
  }).then(function(httpResponse) {
    response.success(httpResponse.data);
  }, function(error) {
    response.error(error);
  });
});


Parse.Cloud.define("transferTest", function(request, response) {

  response.success(Stripe);
  return;
  var endpoint = baseUrl + "/v1/balance";

  Parse.Cloud.httpRequest({
    url: endpoint
  }).then(function(httpResponse) {
    response.success(httpResponse.data);
  }, function(error) {
    response.error(error);
  });

  var endpoint = baseUrl + "/v1/transfers";

  Parse.Cloud.httpRequest({
    url: endpoint,
    method: "POST",
    body: {
      amount: 10,
      currency: "usd",
      destination: "acct_17QS0MBhjKmYcMu6"
    }
  }).then(function(httpResponse) {
    response.success(httpResponse.data);
  }, function(error) {
    response.error(error);
  });
});

exports.createStripeCustomer = function(user) {

  Stripe.Customers.create({
    description: user.id
  }).then(function(customer) {

    user.set("stripeCustomerId", customer.id);

    return user.save();
  });
}

var createStripeCustomer = function(user, response) {

  Stripe.Customers.create({
    description: user.id
  }).then(function(customer) {

    user.set("stripeCustomerId", customer.id);

    user.save().then(function(user) {

      response.success(user);
    });

  }, function(err) {
    response.error(err);
  });
}
var getCustomerFromId = function(customerId, callBack) {

  Stripe.Customers.retrieve( customerId, {

    success: function(customer) {

      callBack(customer);

    },
    error: function(httpResponse) {

      callBack(null);

    }
  });
}

var getAccountInformation = function(callBack) {


}