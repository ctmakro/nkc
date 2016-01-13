//chat request handlers
module.paths.push('./nkc_modules'); //enable require-ment for this path

var moment = require('moment');

var settings = require('server_settings.js');
var helper_mod = require('helper.js')();

var nano = require('nano')('http://'+settings.couchdb.address+':'+settings.couchdb.port.toString());
var posts = nano.use("posts");
var chat = nano.use("chat");
var users = nano.use("users");
var counters = nano.use('counters');
var request = require('request');

var express = require('express');
var chat = express.Router();

///------------
///logger, to be executed before all handlers below
chat.use(function(req,res,next){
  requestLog(req);
  next();
});

///-----------------------------------------
///socket.io.chat section

//chatroom HTML serving
chat.get('/',function(req,res){
  res.sendFile(__dirname + '/chat/chat.html');
});

//chatroom HTML serving
chat.get('/jquery-1.11.1.js',function(req,res){
  res.sendFile(__dirname + '/jquery/jquery-1.11.1.js');
});

module.exports = chat;
