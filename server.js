module.paths.push('./nkc_modules'); //enable require-ment for this path

var moment = require('moment');

var settings = require('server_settings.js');
var helper_mod = require('helper.js')();
var validation = require('validation.js');

var nkc = require('express')(); //main router
var http = require('http').Server(nkc);

//CouchDB
var nano = require('nano')(
  'http://'+settings.couchdb.address+':'+settings.couchdb.port.toString());
var posts = nano.use("posts");
var chat = nano.use("chat");
var users = nano.use('users');
var counters = nano.use('counters');
var request = require('request');


//api serving
var api_handlers = require('api_handlers.js');
nkc.use('/api',api_handlers.route_handler);

//chatroom serving
var chat_handlers = require('chat_handlers.js')
nkc.use('/chat',chat_handlers.route_handler);//routing

//chatroom socket
var io = require('socket.io')(http);
var chat_io = io.of('/chat');// socket.io namespacing
chat_handlers.socket_handler(chat_io);//pass namespaced socket object into processing function

///------------------------------------------
///start server
var server = http.listen(settings.server.port, function () {
  var host = server.address().address;
  var port = server.address().port;
  dash();
  console.log("%s "+settings.server.name+' listening at %s port %s',
  dateString(), host, port);
});

//end process after pressing ENTER, for debug purpose
var stdin = process.openStdin();
stdin.addListener("data",function(d){
  if(d.toString().trim()=="")
  process.exit();
});
