var moment = require('moment');

var settings = require('./nkc_modules/server_settings.js');
var helpermod = require('./nkc_modules/helper.js')();
var checkermod = require('./nkc_modules/checks.js')();

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var nano = require('nano')('http://'+settings.couchdb.address+':'+settings.couchdb.port.toString());
var posts = nano.use("posts");
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

//return copy of chatbox
app.get('/chat',function(req,res){
  requestLog(req);
  res.sendFile(__dirname + '/chat.html');
});

function msgform(cont,titl){
  return JSON.stringify({title:titl,content:cont});
}

//on connection
io.on('connection',function(socket){
  var dstr = dateString();
  var addr = socket.request.connection.remoteAddress;

  report('chat.user '+addr.toString());//new socket connected

  io.emit('msg',msgform('# 来自 '+addr.toString()+' 已连接',dstr));
  socket.emit('msg',msgform('# 欢迎试用KC聊天室[施工中]',dstr));
  socket.emit('msg',msgform('# todo:历史记录',dstr));

  socket.on('disconnect',function(){
    report('chat.user.disconn '+addr.toString());
  });

  //on incoming message
  socket.on('msg',function(msg){
    var dstr=dateString();
    var msgobj={};
    try{
      msgobj = JSON.parse(msg);
    }
    catch(err){
      report('err parsing json[from socket]',err);
      return;
    }

    var content = msgobj.content;
    var sender = msgobj.name;

    //form the msg object to send to client
    var jsonmsg = msgform(content,dstr+" "+sender);

    //send event 'msg' to every 'socket' within 'io'
    io.emit('msg',jsonmsg);
    report('chat->'+msg);
  });

});

///------------------------------------------
///start server
var server = http.listen(1080, function () {
  var host = server.address().address;
  var port = server.address().port;
  dash();
  console.log("%s "+settings.server.name+' listening at %s port %s',dateString(), host, port);
});

//end process after pressing ENTER, for debug purpose
var stdin = process.openStdin();
stdin.addListener("data",function(d){
  if(d.toString().trim()=="")
  process.exit();
});
