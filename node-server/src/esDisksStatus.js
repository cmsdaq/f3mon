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

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getDisksStatus request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //loads query definition from file
    //var queryJSON = require (JSONPath+'disks.json');

    //GET query string params (needed to parameterize the query)
    var qparam_runNumber = req.query.runNumber;
    var qparam_sysName = req.query.sysName;

    //Setting default values for non-set request arguments
    //the following check must not check types because non-set URL arguments are in fact undefined, rather than null valued
    //therefore (nonset_arg == null) evaluates to Boolean TRUE, but (nonset_arg === null) is FALSE, which means that unset args DO NOT have null value (this pattern is used in most callbacks below)
    if (qparam_runNumber == null){qparam_runNumber = 36;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}


    var requestKey = 'getDisksStatus?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.getDisksStatus; //cached ES response ttl (in seconds) 

    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      //add necessary params to the query
      queryJSON.query.wildcard.activeRuns.value =  '*'+qparam_runNumber+'*';

      //submits query to the ES and returns formatted response to the app client
      client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body : JSON.stringify(queryJSON)
      }).then(function (body){
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
	totalTimes.queried += srvTime;
	console.log('getDisksStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
	res.send(cb +  ' (' +JSON.stringify(retObj)+')');
      }, function (error){
        //return default reponse in case of index missing
        if (error.message.indexOf("IndexMissingException")===0) {
          var retObj = {
                   "output":{"value":null},
                   "ramdisk":{"value":null},
                   "ramdiskused":{"value":null},
                   "data":{"value":null},
                   "dataused":{"value":null},
                   "outputused":{"value":null}
          }
	  console.log('getDisksStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.set('Content-Type', 'text/javascript');
	  res.send(cb +  ' (' +JSON.stringify(retObj)+')');
          return;
        }
        excpEscES(res,error);
        console.trace(error.message);
      });//end  client.search(...)
    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('getDisksStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

