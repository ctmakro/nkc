var moment = require('moment');

var settings = require('./nkc_modules/server_settings.js');
var helpermod = require('./nkc_modules/helper.js')();
var checkermod = require('./nkc_modules/checks.js')();

var os = require('os');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var nano = require('nano')('http://'+settings.couchdb.address+':'+settings.couchdb.port.toString());
var posts = nano.use("posts");
var chat = nano.use("chat");
var counters = nano.use('counters');
var request = require('request');

///----------------------------------------
///GET /posts/* handler
app.get('/posts/:pid', function (req, res) {
  requestLog(req);//log

  var pid=req.params.pid;//retrieve pid as parameter

  //get the post from db
  posts.get(pid,{},function(err,body){
    if(!err)
    {//if nothing wrong
      report(pid.toString()+' is hit');
      var result=postRepack(body);
      res.json(report(result));
    }
    else {//if error happened
      res.json(report('pid not found within /posts/',err));
    }
  });
});

///------------------------------------------
/// POST /posts handler
app.post('/posts',function(req,res)
{
  requestLog(req);//log

  //receive post body
  var requestBody=[];
  req.on('error', function(err){
    report('error receiving body',err)
  }).on('data', function(chunk) {
    requestBody.push(chunk);
  }).on('end', function() {
    requestBody = Buffer.concat(requestBody).toString();
    //body fully received
    report('request body received');
    report(requestBody);

    var requestObject={};
    try {
      requestObject = JSON.parse(requestBody);
    }
    catch(err){
      res.json(report('error parsing json',err));//if body is not JSON, exit
      return;
    }
    report('json successfully parsed');

    //check if object is legal (contains enough fields)
    if(validatePost(requestObject)){
      //if okay, don't do a thing
    }else{
      res.json(report('bad field/illegal input',requestObject));
      return;
    }

    //obtain a pid by atomically incrementing the postcount document
    counters.atomic("counters",'counters','postcount',{},function(err,body)
    {
      if(!err)
      {
        report('postcount given:'+body.toString());

        //construct new post document
        var newpost={};
        newpost._id=body.toString();
        newpost.content=requestObject.content;
        newpost.toc=Date.now();

        //insert the document into db
        posts.insert(newpost,function(err,body)
        {
          if(!err)//if succeed
          {
            report('insert succeed');
            res.json(report({status:"succeed",id:newpost._id}));
          }
          else
          {
            res.json(report('error inserting',err));
          }
        });
      }
      else
      {//if unable to obtain
        res.json(report("failed to obtain atomically incrementing postcount",err));
      }
    });
  });
});

///----------------------------------------
///GET /thread/* handler
app.get('/thread/:tid', function (req, res) {
  requestLog(req);

  var tid=req.params.tid;//thread id

  if(tid=='12647'){res.send('dont try again pls');return;}

  posts.view('thread','thread',{startkey:[parseInt(tid),0],endkey:[parseInt(tid),11111111111]},
  function(err,body){
    if(!err)
    {//if nothing went wrong
      for(var i = 0, size = body.rows.length; i < size ; i++){
        var item = body.rows[i];
        body.rows[i]=postRepack(item.value);
      }
      res.json({'tid':tid,'posts':body.rows});
    }
    else {//if error happened
      console.log(tid,'is notfound within /thread/*, or other error');
      console.log(err);
      res.json({error:"notfound"});
    }
  });
});

///-----------------------------------------
///socket.io.chat section

function msgform(title,user,content)
{
  return JSON.stringify({'title':title,'user':user,'content':content});
}

//return copy of chatbox
app.get('/chat',function(req,res){
  requestLog(req);
  res.sendFile(__dirname + '/chat.html');
});

//on connection
io.on('connection',function(socket){
  var dstr = dateString();
  var addr = socket.request.connection.remoteAddress;

  report('chat.user '+addr.toString());//new socket connected

  //load chat history from database
  chat.view('history','history',{descending:true,limit:256},
  function(err,body){
    if(!err){
      //  send them back to user
      var i = body.rows.length;
      while(i--)
      {
        var doc = body.rows[i].value;
        socket.emit('msg',msgform(dateString(doc.t),doc.u,doc.c));
      }
    }

    //show welcome messages after loading db
    io.emit('msg',msgform(dstr,'#','来自 '+addr.toString()+' 已连接'));
    socket.emit('msg',msgform(dstr,'#','欢迎访问KC聊天室[施工中]\n\
    本聊天室保存所有历史记录，每次刷新载入之前256条\n\
    请在右下角填写您的昵称\n\
    科创网络局期待您的加入，我们准备好了工资福利，有意请联系论坛novakon同学'));
  });

  socket.on('disconnect',function(){
    report('chat.user.disconn '+addr.toString());
  });

  //on incoming message
  socket.on('msg',function(msg){
    var datenow = Date.now();
    var dstr=dateString(datenow);
    var msgobj={};
    try{
      msgobj = JSON.parse(msg);
    }
    catch(err){
      report('err parsing json[from socket]',err);
      return;
    }

    var content = msgobj.content;
    var sender = msgobj.user;

    if(content == '/info'){
      socket.emit('msg',msgform(dstr,'#',content));
      socket.emit('msg',msgform(dstr,'#',JSON.stringify(osinfo(),null,'\t')));
      return;
    }

    if(content.trim()==""){
      return;
    }

    //form the msg object to send to client
    var jsonmsg = msgform(dstr,sender,content);

    //send event 'msg' to every 'socket' within 'io'
    io.emit('msg',jsonmsg);
    report('chat->'+msg);

    //build a doc describing a chat message
    var chatdoc={t:datenow,u:sender,c:content,ad:addr};
    //log into db
    chat.insert(chatdoc,function(err,body){
      if(!err)
      {  //unlikely
      }
    });
  });
});

///----
///osinfo helper
function osinfo(){
  var kv={};
  Object.keys(os).map(function(method) {
    try{
      kv[method] = os[method]();
    }
    catch(err){
      report('err during \'os\' listing',err);
      kv[method] = os[method];
    }
  });
  return kv;
}

///------------------------------------------
///start server
var server = http.listen(1080, function () {
  var host = server.address().address;
  var port = server.address().port;
  dash();
  console.log("%s "+settings.server.name+' listening at %s port %s',dateString(), host, port);

  //console.log(JSON.stringify(osinfo(),null,'\t'));
});

//end process after pressing ENTER, for debug purpose
var stdin = process.openStdin();
stdin.addListener("data",function(d){
  if(d.toString().trim()=="")
  process.exit();
});
