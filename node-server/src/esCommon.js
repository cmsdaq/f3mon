'use strict';

function Common() {};

Common.prototype.test = function () {console.log('Hello!')};

Common.prototype.setup = function (cache,cacheSec,cacheTer,client,clientESlocal,smdb,ttls,totalTimes,json1,json2,json3,json4) {
    this.f3MonCache = cache;
    this.f3MonCacheSec = cacheSec;
    this.f3MonCacheTer = cacheTer;
    this.client=client;
    this.clientESlocal=clientESlocal;
    this.smdb=smdb;
    this.ttls = ttls;
    this.totalTimes = totalTimes;
    //optional
    this.queryJSON1=json1;
    this.queryJSON2=json2;
    this.queryJSON3=json3;
    this.queryJSON4=json4;
}

//escapes client hanging upon an ES request error by sending http 500
Common.prototype.excpEscES = function(res,error,requestKey){
    //message can be augmented with info from error
    var msg = 'Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)';
    res.status(500).send(msg);

    var cachedPending = this.f3MonCacheTer.get(requestKey);
    if (cachedPending) {
      cachedPending.forEach(function(item) {
        item.res.status(500).send(msg);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      this.f3MonCacheTer.del(requestKey);
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
  var srvTime = (new Date().getTime())-eTime;
  this.totalTimes.queried += srvTime;
  if (took!==undefined) { //adaptive ttl
        var tookSec = took/1000.;
        if (tookSec>ttl) usettl=ttl+tookSec;
  }
  if (cached) {
    //console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
  } else {
    if (took!==undefined) { //adaptive ttl
      var tookSec = took/1000.;
      if (tookSec>ttl) ttl+=tookSec;
    }
    this.f3MonCache.set(requestKey, [obj,ttl], ttl);
    console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
  }

  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  if (cb!==undefined)
    res.send(cb +' ('+JSON.stringify(obj)+')');
  else
    res.send(JSON.stringify(obj));

  var _this = this;

  //send pending items
  if (!cached) {
    var cachedPending = this.f3MonCacheTer.get(requestKey);
    if (cachedPending) {
      //console.log('responding to cached pending requests...')
      cachedPending.forEach(function(item) {
        _this.sendResult(item.req,item.res,requestKey,item.cb,true,obj,qname,item.eTime,ttl);
      });
      //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
      this.f3MonCacheTer.del(requestKey);
    }
  }
}

Common.prototype.putInPendingCache = function(replyCache,requestKey,ttl) {

  //console.log('putting in pending cache...')
  var cachedval = this.f3MonCacheTer.get(requestKey)
  if (cachedval===undefined) 
    this.f3MonCacheTer.set(requestKey,[replyCache],ttl*10); //large(r) expiration time for this
  else
    cachedval.push(replyCache);
}

module.exports = Common;
