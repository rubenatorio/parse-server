var helper = require('./Helper.js');

Parse.Cloud.beforeDelete('Event', function(request, response) {

  var event = request.object;

  event.relation('requests').query().find().then(function(requests) {

    return Parse.Object.destroyAll(requests);

  }).then(function() { 

    response.success("Deleted Event " + event.id);

  }, function(error) { 
    
    response.error("error " + error);
  });
});

Parse.Cloud.beforeDelete('BusinessEvent', function(request, response) {

  var event = request.object;

  event.relation('incentives').query().find().then(function(incentives) {

    return Parse.Object.destroyAll(incentives);

  }).then(function() {

    return event.relation('ticketDescriptors').query().find();

  }).then(function(descriptors) {

    return Parse.Object.destroyAll(descriptors);

  }).then(function() {

    var descriptor = event.get('descriptor');
    
    descriptor.increment('currentEventCount', -1);
    
    var category = event.get("eventCategory");

    category.increment('eventCount', -1);

    var destriptorRelation = category.relation('descriptors');

    destriptorRelation.remove(descriptor);

    category.increment('descriptorCount', -1);

    return Parse.Object.saveAll([descriptor, category]);

  }).then(function() { 
    response.success("Deleted Event " + event.id);
  }, function(error) { 
    response.error("error " + error);
  });
});
