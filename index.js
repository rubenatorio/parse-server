// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var os = require("os");

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://'+ os.hostname() +':27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'MK5KVBqIzhhM5tIwX9hrKnQLLKpHeJ9O0VHS4Fqp',
  masterKey: process.env.MASTER_KEY || 'G1QPMwxoMOfCNALvY7RrQkk9Z2X2yin7kQkemghg', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  clientKey: process.env.CLIENT_KEY || 'b6HOOvr7DCIZDCp7mXIZvnQCTx6XAzvPnbC4yDUO',
  restAPIKey: process.env.REST_KEY || 'VIcqjZWIKDJPsNh4JjqQaCFkFzxH10bjVyaUXKi7',
  javascriptKey: process.env.JAVASCRIPT_KEY || 'CLStTSaozrHYjthLXzZkqoUCsJcgnFVQtb5rjtyu',
  dotNetKey: process.env.DOT_NET_KEY || 'f2wCuTCkZrtD0pZUWj2MsiPs45MLB5L6pyQYmEqa',
  fileKey: process.env.FILE_KEY || 'aad3fa7e-9167-4818-8643-78edc359fbd1',
  verbose: true,
  push: {
    ios: [
      {
        pfx: './push/sugr-development.p12', // Dev PFX or P12
        bundleId: 'systems.invariant.sugr',
        production: false // Dev
      },
      {
        pfx: './push/sugr-production.p12', // Prod PFX or P12
        bundleId: 'systems.invariant.sugr',  
        production: true // Prod
      }
    ]
  },
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  }
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('Make sure to star the parse-server repo on GitHub!');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('sugr-local running on ' + os.hostname() +':' + port);
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
