
Parse.Cloud.define('iosPush', function(req, res) {
  res.success('Hi Squad');
});

Parse.Cloud.define("iosPushTest", function(request, response) {

  var pushQuery = new Parse.Query(Parse.Installation);

	var user = new Parse.Object("User");

  	user.id = 'b2akDflhj1';

  pushQuery.equalTo('user', user); // targeting iOS devices only                                                                                                                                          

  Parse.Push.send({
    where: pushQuery, // Set our Installation query                                                                                                                                                              
    data: {
      alert: "Message: Here"
    }
  }, { success: function() {
      console.log("#### PUSH OK");
  }, error: function(error) {
      console.log("#### PUSH ERROR" + error.message);
  }, useMasterKey: true});

  response.success('sent');
});