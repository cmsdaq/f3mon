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

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'nstates-summary request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //GET query string params
    var qparam_sysName = req.query.sysName;
    var qparam_runNumber = req.query.runNumber;
    var qparam_timeRange = req.query.timeRange;
    var qparam_maxTime = req.query.maxTime;
    var qparam_numIntervals = req.query.numIntervals;

    if (qparam_runNumber == null){qparam_runNumber = 0;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}
    if (qparam_timeRange == null){qparam_timeRange = "232";}
    if (qparam_maxTime == null){qparam_maxTime = "now-2s";}
    if (qparam_numIntervals == null){qparam_numIntervals = "3";}
    //if (qparam_numIntervals == null){qparam_numIntervals = "1000";}

    //qparam_timeRange = qparam_timeRange*10;

    var requestKey;
    requestKey = 'nstates-summary?runNumber='+qparam_runNumber+'&timeRange='+qparam_timeRange+'&qparam_maxTime='+qparam_maxTime+'&qparam_numIntervals='+qparam_numIntervals+'&sysName='+qparam_sysName;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.nstatesSummary; //cached ES response ttl (in seconds)


    var retObj = {
	    "lastTime" : null,
	    "timeList" : null,
	    "data" : ""
    };

    var sendResult = function(){
	    f3MonCache.set(requestKey, [retObj,ttl], ttl);
	    var srvTime = (new Date().getTime())-eTime;
	    totalTimes.queried += srvTime;
	    console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	    res.set('Content-Type', 'text/javascript');
	    res.send(cb +' ('+JSON.stringify(retObj)+')');
    }

    var legend = {};
    var reserved;
    var special;
    var output;
    var ustatetype = "state-hist-summary";

    //var properties = [];

    //Get legend
    var q1 = function(callback){
      queryJSON1.query.filtered.query.term._parent = qparam_runNumber;

      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'microstatelegend',
        body : JSON.stringify(queryJSON1)
      }).then (function(body){
        if (body.hits.total ===0){
          retObj.data = [];
          sendResult();
        }else{
          retObj.data = {};
          var result = body.hits.hits[0]; //hits for query
          reserved = result._source.reserved;
	  special = result._source.special;
	  output = result._source.output;
          if (result._source.stateNames===undefined) {
            retObj.data = [];
            sendResult();
          }
	  else {
	    var shortened = result._source.stateNames;
	      for (var i = 0 ; i< special ; i++) {
	 	legend[i]=shortened[i];
		  retObj.data[shortened[i]] = [];
		}
		legend[special]='hltOutput';
		retObj.data['hltOutput'] = [];
		legend[reserved]='Busy';
		retObj.data['Busy'] = [];


		//discovering array keys
		//var properties = [];
		//for (var pName in retObj.data)
		//	properties.push(pName);


		ustatetype = "state-hist-summary";
	    callback(sendResult);
	  }
        }
      }, function (error){
	      excpEscES(res,error);
	      console.trace(error.message);
      });

    }//end q1


    //Get states
    var q2 = function(callback){
        queryJSON2.query.bool.must[0].term._parent = parseInt(qparam_runNumber);
        if (qparam_maxTime.substr(0,3)==('now')) {
	  queryJSON2.query.bool.must[1].range._timestamp.to = qparam_maxTime;
	  queryJSON2.query.bool.must[1].range._timestamp.from = 'now-'+qparam_timeRange+'s';
        }
          else { //unix timestamp
	    queryJSON2.query.bool.must[1].range._timestamp.to = parseInt(qparam_maxTime);
	    queryJSON2.query.bool.must[1].range._timestamp.from = Math.Round(parseInt(qparam_maxTime)-(1000*parseInt(qparam_timeRange)));
        }
        queryJSON2.aggs.dt.date_histogram.interval=(parseInt(qparam_timeRange)/parseInt(qparam_numIntervals))+'s'

	client.search({
          index: 'runindex_'+qparam_sysName+'_read',
          type: ustatetype,
          body : JSON.stringify(queryJSON2)

        }).then (function(body){
          var results = body.aggregations.dt.buckets; //date bin agg for query
          var timeList = [];
		
	  for (var i=0;i<results.length;i++){
	    var timestamp = results[i].key;
            timeList.push(timestamp)
            //console.log(results[i]);
	    var entries = results[i].entries.keys.buckets;
	    //var entriesList = [];

                
            for (var ikey in retObj.data) {
              retObj.data[ikey].push([timestamp,0]);//null?
            }
	    for (var index=0;index<entries.length;index++) {
              var ukey = entries[index].key;
              if (!legend.hasOwnProperty(ukey)) {
                console.log('warning: key ' + ukey + ' out of range');
                continue;
              }
              var name = legend[ukey];
	      var value = entries[index].counts.value;
              retObj.data[name][i][1] = value;
            }
          }

          retObj.timeList = timeList;	
	  if (results.length>0)
	    retObj.lastTime = results[results.length-1].key;

	  callback();
        }, function (error) {
	    excpEscES(res,error);
	    console.trace(error.message);
      });

    }//end q2

    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      q1(q2); //call q1 with q2 as its callback

    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

