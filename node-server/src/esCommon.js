'use strict';

function Common() {};

Common.prototype.test = function () {console.log('Hello!')};

Common.prototype.setup = function (json1,json2,json3,json4) {
    //optional
    this.queryJSON1=json1;
    this.queryJSON2=json2;
    this.queryJSON3=json3;
    this.queryJSON4=json4;
    this.verbose = global.verbose;
    this.bulk_buffer = global.bulk_buffer;
}


//escapes client hanging upon ES request callback exception
Common.prototype.exCb = function(res,error,requestKey){
    //message can be augmented with info from error
    var msg = 'Internal Server Error (Callback Syntax Error).\nMsg:\n'+error.stack;
    console.log(error.stack)
    res.status(500).send(msg);

    var cachedPending = global.f3MonCacheTer.get(requestKey);
    if (cachedPending) {
      cachedPending.forEach(function(item) {
        item.res.status(500).send(msg);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      global.f3MonCacheTer.del(requestKey);
    }
}

//escapes client hanging upon an ES request error by sending http 500
Common.prototype.excpEscES = function(res,error,requestKey){
    //message can be augmented with info from error
    var msg = 'Internal Server Error (Elasticsearch query error during the request execution, expert should seek further info in the logs). Msg:'+error.message;
    res.status(500).send(msg);

    var cachedPending = global.f3MonCacheTer.get(requestKey);
    if (cachedPending) {
      cachedPending.forEach(function(item) {
        item.res.status(500).send(msg);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      global.f3MonCacheTer.del(requestKey);
    }
}

//escapes client hanging upon an Oracle request error by sending http 500
Common.prototype.excpEscOracle = function(res,error,requestKey){
    //message can be augmented with info from error
    var msg = 'Internal Server Error (Oracle DB query error during the request execution, an admin should seek further info in the logs). Msg:'+ JSON.stringify(error);
    res.status(500).send(msg);

    var cachedPending = global.f3MonCacheTer.get(requestKey);
    if (cachedPending) {
      cachedPending.forEach(function(item) {
        item.res.status(500).send(msg);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      global.f3MonCacheTer.del(requestKey);
    }
}


/*
//escapes client hanging upon a nodejs code exception/error by sending http 500
var excpEscJS = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Nodejs error)');
}
*/

//check new Boolean type of objects
Common.prototype.checkBool = function(bool) {
    return typeof bool === 'boolean' || 
          (typeof bool === 'object' && typeof bool.valueOf() === 'boolean');
}

Common.prototype.checkDefault = function(value,defaultValue) {
    //particular case when bool value is given by string as 'true' or 'false'
    if(typeof(defaultValue) === "boolean") {
      if (value==='true') return true;
      if (value==='false') return false;
    }
    //unset parameters are undefined (undefined == null is true, but undefined === null is false!)
    if (value === "" || value === null || value === undefined || value === 'false' || value==="null") return defaultValue;
    else return value;
}

Common.prototype.sendResult = function(req,res,requestKey,cb,cached,obj,qname,eTime,ttl,took) {
  //var srvTime = (new Date().getTime())-eTime;
  var srvTime = this.gethrms() - eTime;
  global.totalTimes.queried += srvTime;
  var responseObject;
  if (cached) {
    //console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
    responseObject = obj
  } else {
    var usettl = ttl;
    if (took!==undefined) { //adaptive ttl
      var tookSec = took/1000.;
      if (tookSec>ttl && tookSec<ttl*4) usettl+=tookSec;
    }
    responseObject = JSON.stringify(obj);//need to serialize of object is not cached
    if (global.useCaches)
      global.f3MonCache.set(requestKey, [responseObject,usettl], usettl);
    if (this.verbose) console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
  }
  var time_now = new Date().getTime();
  this.bulk_buffer.push({ip:req.connection.remoteAddress,useragent:req.headers['user-agent'],query:qname,cached_response:cached,date:time_now,took:srvTime})

  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  if (cb!==undefined)
    //res.send(cb +' ('+JSON.stringify(obj)+')');
    res.send(cb +' ('+responseObject+')');
  else
    //res.send(JSON.stringify(obj));
    res.send(responseObject);

  var _this = this;

  //send pending items
  if (!cached) {
    var cachedPending = global.f3MonCacheTer.get(requestKey);
    if (cachedPending !== undefined) {
      //console.log('responding to cached pending requests...')
      cachedPending.forEach(function(item) {
        _this.sendResult(item.req,item.res,requestKey,item.cb,true,responseObject,qname,item.eTime,ttl);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      global.f3MonCacheTer.del(requestKey);
    }
  }
}

Common.prototype.putInPendingCache = function(replyCache,requestKey,ttl) {

  //console.log('putting in pending cache...')
  var cachedval = global.f3MonCacheTer.get(requestKey)
  if (cachedval===undefined) 
    global.f3MonCacheTer.set(requestKey,[replyCache],ttl*10); //large(r) expiration time for this
  else
    cachedval.push(replyCache);
}

Common.prototype.respondFromCache = function(req,res,cb,eTime,requestKey,qname,ttl) {

    var requestValue = global.f3MonCache.get(requestKey);
    var pending=false
    if (requestValue=="requestPending"){
      pending=true
      requestValue = global.f3MonCacheSec.get(requestKey);
    }

    if (requestValue === undefined) {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
        return true;
      }
      if (global.useCaches)
        global.f3MonCache.set(requestKey, "requestPending", ttl);
      //response tells nothing is cached, continue querying
      return false;
    }
    else {
      //respond from cache
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
      return true;
    }
}

Common.prototype.gethrms = function() {
var hrTime = process.hrtime() ;
return hrTime[0] * 1000 + hrTime[1] / 1000000;
}

module.exports = Common;
