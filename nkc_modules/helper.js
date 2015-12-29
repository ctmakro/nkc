//helper module
module.exports = function(){

  //reformat a post after retrieval
  this.postRepack = function(p){
    delete p._rev;
    return p;
    return {
      pid:p._id,
      uid:p.uid,
      tid:p.tid,
      timecreated:p.toc,
      content:p.content
    };
  };

  //request logger
  this.requestLog = function (req){
    var d=new Date();
    console.log("-------------------------------------------------------");
    console.log(
      d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),
      req.ip,req.method,req.originalUrl
    );
  };

  //error reporter
  this.report = function(description,error){
    if(error){
      console.log("err:",description);
      console.log(error);
      return({'error':description});
    }else{
      console.log("msg:",description);
      return({message:description});
    }
  };

}
