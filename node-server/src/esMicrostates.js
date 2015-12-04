'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON1;
var queryJSON2;
var queryJSON3;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN1,queryJSN2,queryJSN3) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
    queryJSON3 = queryJSN3;
  },

  query : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'nstates-summary request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //GET query string params
    var qparam_sysName = req.query.sysName;
    var qparam_runNumber = req.query.runNumber;
    var qparam_numIntervals = req.query.numIntervals;
    var qparam_timeRange = req.query.timeRange;
    var qparam_maxTime = req.query.maxTime;
    var qparam_minLs=req.query.minLs;
    var qparam_maxLs=req.query.maxLs;
    var qparam_format=req.query.format;

    if (qparam_runNumber === null){qparam_runNumber = 0;}
    else { qparam_runNumber = parseInt(req.query.runNumber);}
    if (qparam_sysName === null){qparam_sysName = 'cdaq';}
    if (qparam_numIntervals === null){qparam_numIntervals = 50;}
    else {qparam_numIntervals = parseInt(req.query.numIntervals);}
    if (qparam_format===null) qparam_format='highcharts'

//"numIntervals":"10","runNumber":"262742","sysName":"cdaq","timeRange":"300"}

    if (qparam_timeRange == null){qparam_timeRange = "302";}
    if (qparam_maxTime == null){qparam_maxTime = "now-2s";}

    //switch to non-live mode
    if (qparam_minLs!==undefined && qparam_maxLs!==undefined) {
        qparam_timeRange=null;
        qparam_maxTime=null;
    }
    
    var minTs=null;
    var maxTs=null; 

    var hcformat=true;
    if (qparam_format==='nvd3') hcformat=false;

    //if (qparam_numIntervals == null){qparam_numIntervals = "1000";}

    var requestKey;
    var requestKeySuffix = '&'+qparam_timeRange
                           +'&'+qparam_maxTime
                           +'&'+qparam_numIntervals
                           +'&'+qparam_sysName;
                           +'&'+qparam_minLs
                           +'&'+qparam_maxLs
                           +'&'+qparam_format
    //make hash out of string
    var requestKey = 'nstates-summary?runNumber=' + qparam_runNumber +requestKeySuffix;//+ requestKeySuffix.reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
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

    var idxmap = {};

    //var properties = [];
    var q1 = function(callback) {

      queryJSON3.query.bool.must.term._parent = qparam_runNumber;
      queryJSON3.query.bool.should[0].term.ls = qparam_minLs;
      queryJSON3.query.bool.should[1].term.ls = qparam_maxLs;
      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
        body : JSON.stringify(queryJSON3)
      }).then (function(body){
        if (body.hits.total===0) {
          retObj.data = [];
          sendResult();
        }
        else {  
          minTs = body.aggregations.lsmin.value;
          maxTs = body.aggregations.lsmax.value+23400;//add 1 LS
          q2(q3);
        }
      }, function (error){
              excpEscES(res,error);
              console.trace(error.message);
      });

    } //end q1


    //Get legend
    var q2 = function(callback) {
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
          if (hcformat) retObj.data = {};
          else retObj.data = [];
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
              if (hcformat)
	        retObj.data[shortened[i]] = [];
              else {
                idxmap[shortened[i]]=retObj.data.length
	        retObj.data.push({'key':shortened[i],'values':[]});
              }
            }
	    legend[special]='hltOutput';
	    legend[reserved]='Busy';
            if (hcformat) {
	      retObj.data['hltOutput'] = [];
	      retObj.data['Busy'] = [];
            }
            else {
              idxmap['hltOutput']=retObj.data.length;
              retObj.data.push({'key':'hltOutput','values':[]})
              idxmap['Busy']=retObj.data.length;
              retObj.data.push({'key':'Busy','values':[]})
            }

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

    }//end q2


    //Get states
    var q3 = function(callback){
        queryJSON2.query.bool.must[0].term._parent = parseInt(qparam_runNumber);

        if (qparam_maxTime!==null) {
          if (qparam_maxTime.substr(0,3)==('now')) {
	    queryJSON2.query.bool.must[1].range._timestamp.to = qparam_maxTime;
	    queryJSON2.query.bool.must[1].range._timestamp.from = 'now-'+parseInt(qparam_timeRange)+'s';
          }
          else { //unix timestamp
	    queryJSON2.query.bool.must[1].range._timestamp.to = parseInt(qparam_maxTime);
	    queryJSON2.query.bool.must[1].range._timestamp.from = Math.Round(parseInt(qparam_maxTime)-(1000*parseInt(qparam_timeRange)));
          }
          queryJSON2.aggs.dt.date_histogram.interval=(parseInt(qparam_timeRange)/parseInt(qparam_numIntervals))+'s'
        }
        else {
          //LS time interval
          queryJSON2.query.bool.must[1].range._timestamp.to = maxTs;
          queryJSON2.query.bool.must[1].range._timestamp.from = minTs;
          queryJSON2.aggs.dt.date_histogram.interval=(((maxTs-minTs))/(1000.*parseInt(qparam_numIntervals)))+'s'
        }


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

            if (hcformat)
              for (var ikey in retObj.data)
                retObj.data[ikey].push([timestamp,0]);//null?
            else
              for (var iidx=0; iidx<retObj.data.length;iidx++)
                retObj.data[iidx].values.push([timestamp,0])

	    for (var index=0;index<entries.length;index++) {
              var ukey = entries[index].key;
              if (!legend.hasOwnProperty(ukey)) {
                console.log('warning: key ' + ukey + ' out of range');
                continue;
              }
              var name = legend[ukey];
	      var value = entries[index].counts.value;
              if (hcformat)
                retObj.data[name][i][1] = value;
              else
                retObj.data[idxmap[name]].values[i][1]=value;

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

    }//end q3

    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      if (qparam_minLs!=null && qparam_maxLs!==null) {
        q1(q2);
      }
      else {
        q2(q3); //call q1 with q2 as its callback
      }

    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

