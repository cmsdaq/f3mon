'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON = queryJSN;
  },

  query : function (req, res) {
    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runList request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //GET query string params
    var qparam_from = req.query.from;
    var qparam_to = req.query.to;
    var qparam_size = req.query.size;
    var qparam_sysName = req.query.sysName;
    if (qparam_from == null){qparam_from = 0;}
    if (qparam_to == null){qparam_to = 'now';}
    if (qparam_size == null){qparam_size = 1000;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}

    var requestKey = 'runList?from='+qparam_from+'&to='+qparam_to+'&size='+qparam_size+'&sysName='+qparam_sysName;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.runList; //cached ES response ttl (in seconds)

    if (requestValue=="requestPending"){
	    requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      //parameterize query fields
      queryJSON.size = qparam_size;
      queryJSON.query.range._timestamp.from = qparam_from;
      queryJSON.query.range._timestamp.to = qparam_to;

      //search ES
      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
	var results = body.hits.hits; //hits for query

	//format response content from query results, then send it
	if (results.length==0){
	  //send empty response if hits list is empty
	  f3MonCache.set(requestKey, ["empty",ttl], ttl);
	  var srvTime = (new Date().getTime())-eTime;
	  totalTimes.queried += srvTime;
	  console.log('runList (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.send();
	}else{
	  var lasttime = results[0].fields._timestamp;
	  var index;
	  var arr = [];
	  for (index = 0 ; index < results.length; index++){
	    arr[index] = results[index]._source;
	  }
	  var retObj = {
	    "lasttime" : lasttime,
	    "runlist" : arr
	  };
	  f3MonCache.set(requestKey, [retObj,ttl], ttl);
	  var srvTime = (new Date().getTime())-eTime;
	  totalTimes.queried += srvTime;
	  console.log('runList (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.set('Content-Type', 'text/javascript');
	  res.send(cb +' ('+JSON.stringify(retObj)+')');
        }
      },function (error){
	excpEscES(res,error);
        console.trace(error.message);
      });

    }else{	
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('runList (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      if (requestValue[0] === "empty"){
        res.send();
      }else{
	res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
      }
    }
  }
}

