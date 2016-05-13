'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

var exCb = function (res, error){
  var msg = 'Internal Server Error (Callback Syntax Error).\nMsg:\n'+error.stack;
  console.log(error.stack)
  res.status(500).send(msg);
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


//queries runindex_cdaq/stream_label and populates a list with all stream names for a run
//(further filtering by ls interval is also possible to implement by using the 'from' and 'to' arguments)
//console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getstreamlist request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
//var qparam_from = req.query.from;
//var qparam_to = req.query.to;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 124029;}
//if (qparam_from == null){qparam_from = 1;}
//if (qparam_to == null){qparam_to = 1;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var requestKey = 'getstreamlist?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.getstreamlist; //cached ES response ttl (in seconds)

  var retObj = {
        "streamList" : []
  };

  var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('getstreamlist (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send(cb +' ('+JSON.stringify(retObj)+')');
       }
  var q = function(callback){
    queryJSON.query.bool.must[0].prefix._id = 'run'+qparam_runNumber;
    //queryJSON.query.filtered.query.range.ls.from = qparam_from;
    //queryJSON.query.filtered.query.range.ls.to = qparam_to;

    client.search({
     index: 'runindex_'+qparam_sysName+'_read',
     type: 'stream_label',
     body : JSON.stringify(queryJSON)
     }).then (function(body){
        try {
        var results = body.hits.hits; //hits for query
	var set = {};
	for (var i=0;i<results.length;i++){
		if (!set.hasOwnProperty(results[i]._source.stream)){
			retObj.streamList.push(results[i]._source.stream);
			set[results[i]._source.stream] = true;	//avoiding duplicates, if they occur
		}
	}
	callback();
        //} catch (e) {_this.exCb(res,e,requestKey)}
        } catch (e) {exCb(res,e)}
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
}//end q

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
	f3MonCache.set(requestKey, "requestPending", ttl);

 	q(sendResult);
}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('getstreamlist (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}


  }
}

