var twilioAccountSid = 'AC18a31aefa53e3f31c98fa4db07778e6e';
var twilioAuthToken = 'b4537e8778714b9d2b1ccc63888a3f64';
var twilioPhoneNumber = '4144228417';
var secretPasswordToken = 'SHONNYDICKS';

var language = "en";
var languages = ["en", "es", "ja"];

var twilio = require('twilio')(twilioAccountSid, twilioAuthToken);

Parse.Cloud.define("sendCode", function(req, res) {
	var phoneNumber = req.params.phoneNumber;
	phoneNumber = phoneNumber.replace(/\D/g, '');

	var lang = req.params.language;
  if(lang !== undefined && languages.indexOf(lang) != -1) {
		language = lang;
	}

	if (!phoneNumber || (phoneNumber.length != 10 && phoneNumber.length != 11)) return res.error('Invalid Parameters');
	Parse.Cloud.useMasterKey();
                   
	var query = new Parse.Query(Parse.User);
	query.equalTo('username', phoneNumber + "");
	query.first().then(function(result) {
		var min = 1000; var max = 9999;
		var num = Math.floor(Math.random() * (max - min + 1)) + min;

		if (result) {
			result.setPassword(secretPasswordToken + num);
            result.save().then(function() {
                return sendCodeSms(phoneNumber, num, language);
            }).then(function() {
                res.success(num);
            }, function(err) {
                res.error(err);
            });
		} else {
            
			var user = new Parse.User();
			user.setUsername(phoneNumber);
			user.setPassword(secretPasswordToken + num);
			user.save().then(function() {
				res.success(num);
			});
		}
	}, function (err) {
		res.error(err);
	});
});

Parse.Cloud.define("logIn", function(req, res) {
	Parse.Cloud.useMasterKey();

	var phoneNumber = req.params.phoneNumber;
	phoneNumber = phoneNumber.replace(/\D/g, '');

	if (phoneNumber && req.params.codeEntry) {
		Parse.User.logIn(phoneNumber, secretPasswordToken + req.params.codeEntry).then(function (user) {
			res.success(user._sessionToken);
		}, function (err) {
			res.error(err);
		});
	} else {
		res.error('Invalid parameters.');
	}
});

function sendCodeSms(phoneNumber, code, language) {
	var prefix = "+1";
	if(typeof language !== undefined && language == "ja") {
		prefix = "+81";
	}

	var promise = new Parse.Promise();
	twilio.sendSms({
		to: prefix + phoneNumber.replace(/\D/g, ''),
		from: twilioPhoneNumber.replace(/\D/g, ''),
		body: 'sugr access code: ' + code
	}, function(err, responseData) {
		if (err) {
			console.log(err);
			promise.reject(err.message);
		} else {
			promise.resolve();
		}
	});
	return promise;
}
