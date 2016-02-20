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

var checkDefault = function(value,defaultValue) {
    if (value === "" || value === null || value === undefined || value === 'false' || value==="null") return defaultValue;
    else return value;
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
    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runList request');
    var eTime = new Date().getTime();
    var cb = checkDefault(req.query.callback,null);

    //GET query string params
    var qparam_sysName = checkDefault(req.query.sysName,"cdaq");
    var qparam_size = checkDefault(req.query.size,10);
    var qparam_from=checkDefault(req.query.from,"0");
    var qparam_to=checkDefault(req.query.to,"now");

    var requestKey = 'runList?sysName='+qparam_sysName+'&from='+qparam_from+'&to='+qparam_to+'&size='+qparam_size;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.runList; //cached ES response ttl (in seconds)

    if (requestValue=="requestPending"){
	    requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      var queryJSON = {
        "fields": ["_source","startTime"],
        "filter": {
          "missing": {
            "field": "endTime"
          }
        },
        "size": qparam_size,
        "sort": {"startTime": "desc"}
      }

      //parameterize query fields
      queryJSON.size = qparam_size;
      //optional query
      if (!(qparam_from==="0" && qparam_to==="now"))
        queryJSON["query"] = {"range":{"startTime":{"from":qparam_from,"to":qparam_to}}}

      //search ES
      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
	var results = body.hits.hits; //hits for query

	//format response content from query results, then send it
	var retObj;
	if (results.length==0){
	  retObj = {"runlist":[]}
	}else{
	  var arr = [];
	  for (var index = 0 ; index < results.length; index++){
	    arr[index] = results[index]._source;
	  }
	  retObj = {
	    "lasttime" : results[0].fields.startTime,
	    "runlist" : arr
	  };
        }
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
	totalTimes.queried += srvTime;
	console.log('runList (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        if (cb!==null)
	  res.send(cb +' ('+JSON.stringify(retObj)+')');
        else
	  res.send(JSON.stringify(retObj));
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
        res.header("Cache-Control", "no-cache, no-store");
        if (cb!==null) {
          res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
        }
        else
          res.send(JSON.stringify(requestValue[0]));
      }
    }
  }
}

