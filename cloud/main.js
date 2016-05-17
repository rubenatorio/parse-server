
Parse.Cloud.define('iosPush', function(req, res) {
  res.success('Hi Squad');
});

Parse.Cloud.define("iosPushTest", function(request, response) {

  var pushQuery = new Parse.Query(Parse.Installation);

	var user = new Parse.Object("User");

  	user.id = 'b2akDflhj1';

  pushQuery.equalTo('user', user); // targeting iOS devices only                                                                                                                             
  
  Parse.Push.send({
  	where: pushQuery,
  	data: {  alert: "Message: Here" }
  }, { useMasterKey: true })
  .then(function() {
  	response.success('sent');
  }, function(error) {
  	response.error(error);
  });
});