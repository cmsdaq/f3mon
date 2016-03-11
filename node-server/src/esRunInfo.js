'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON1;
var queryJSON2;

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

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN1,queryJSN2) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
  },

  query : function (req, res) {

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runInfo request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;
    //GET query string params
    var qparam_runNumber = checkDefault(req.query.runNumber,null);
    var qparam_sysName = checkDefault(req.query.sysName,"cdaq");
    var qparam_activeRuns  = checkDefault(req.query.activeRuns,false);

    var requestKey = 'runInfo?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName+'&active='+qparam_activeRuns;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.runInfo; //cached ES response ttl (in seconds)


    var retObj = {};

    var sendResult = function(){
	    f3MonCache.set(requestKey, [retObj,ttl], ttl);
	    var srvTime = (new Date().getTime())-eTime;
	    totalTimes.queried += srvTime;
	    console.log('runInfo (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	    res.set('Content-Type', 'text/javascript');
            res.header("Cache-Control", "no-cache, no-store");
            if (cb!==undefined)
	      res.send(cb +' ('+JSON.stringify(retObj)+')');
            else
	      res.send(JSON.stringify(retObj));
    }

    //last LS number
    var q4 = function (){

      queryJSON1.query.term._parent = qparam_runNumber;

      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
      body : JSON.stringify(queryJSON1)
      }).then (function(body){
	var results = body.hits.hits; //hits for query
	  if (results.length === 0){
	  retObj.lastLs = 0;
	}else{
	  //retObj.lastLs = results[0].sort[0];
	  retObj.lastLs = results[0]._source.ls;
	}
        sendResult();
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q3


    //streams from INI
    var q3 = function (){

      var queryJSONs = {
        "size": 1000,
        "query": {
          "prefix": {
            "_id": 'run'+qparam_runNumber
          }
        },
        "sort": {"stream": {"order": "asc"}}
      }
      client.search({
       index: 'runindex_'+qparam_sysName+'_read',
       type: 'stream_label',
       body : JSON.stringify(queryJSONs)
      }).then (function(body){
        var results = body.hits.hits; //hits for query
	var set = {};
        retObj['streamListINI'] = [];
	for (var i=0;i<results.length;i++) {
	  if (!set.hasOwnProperty(results[i]._source.stream)){
	    retObj.streamListINI.push(results[i]._source.stream);
	    set[results[i]._source.stream] = true;	//avoiding duplicates, if they occur
	  }
	}
        q4();
      }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
      });
    }


    //streams
    var q2 = function (){

      queryJSON2.query.term._parent = qparam_runNumber;

      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'stream-hist',
        body : JSON.stringify(queryJSON2)
      }).then (function(body){
        //var results = body.hits.hits; //hits for query
        var terms = body.aggregations.streams.buckets; //replacing facet implementation (facets->deprecated)
	var streams = [];
	for (var i=0;i<terms.length;i++){
		streams[i] = terms[i].key;
	}
	retObj.streams = streams;
        q3();
        callback(sendResult);
      }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q2

    //start and end time
    var q1 = function (){

      var queryJSON = {"size":1,"sort":{"startTime":"desc"}}
      if (qparam_runNumber!==null)
        queryJSON["filter"]={"term":{"_id": qparam_runNumber }}
      if (qparam_activeRuns)
        queryJSON["query"]= {"constant_score":{"filter":{"missing":{"field":"endTime"}}}};

      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body : JSON.stringify(queryJSON)
      }).then (function(body){
        var results = body.hits.hits; //hits for query
	if (results.length === 0){
          sendResult();
          return;
        }
	retObj = results[0]._source; 	//throws cannot read property error if result list is empty (no hits found) because results[0] is undefined
        if (qparam_runNumber===null) qparam_runNumber = results[0]._id;
	q2();
      }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
      });

    }//end q1

    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
     f3MonCache.set(requestKey, "requestPending", ttl);
 
     q1();

    }else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('runInfo (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        if (cb!==undefined)
          res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
        else
	  res.send(JSON.stringify(requestValue[0]));
    }
  }
}

