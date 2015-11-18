'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;


//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
  },

  query : function (req, res) {
    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"serverStatus request");
    var eTime = new Date().getTime();
    var cb = req.query.callback;
    //console.log(cb);
    var requestKey = 'serverStatus';
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.serverStatus; //cached ES response ttl (in seconds) 

    if (requestValue=="requestPending"){
	requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      //query elasticsearch health and bind return function to reply to the server
      client.cluster.health().then(
       function(body) {
        //console.log(body['status']);
        var retObj = {'status':body['status']};
        f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
	totalTimes.queried += srvTime;
        console.log('serverStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(retObj)+')');

       }, function (err) {
        excpEscES(res,err);
        console.log(err.message);
       // res.send();
       }
      );
    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('serverStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

