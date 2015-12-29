//checking module
module.exports = function(){

  //decide whether a submitted post is legal
  this.validatePost = function(p){
    if(!p.content)return false;
    return true;
  };
}
