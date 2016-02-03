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

//percColor function
var percColor = function (percent){
		//console.log('called percColor with arg='+percent);
		var color = '';
		if (percent >= 100){
                        color = 'green';
                }else if (percent >= 50){
                        color = 'orange';
                }else{
                        color = 'red';
                }
		return color;
}


var percColor2 = function (percent,hasErrors){
		//console.log('called percColor with arg='+percent);
		var color = '';
		if (percent >= 100){
                        if (hasErrors)
                            color = "olivedrab";
                        else
                            color = 'green';
                }else if (percent >= 50){
                        color = 'orange';
                }else{
                        color = 'red';
                }
		return color;
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


console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperstream request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_sysName = req.query.sysName;
var qparam_streamList = req.query.streamList;
var qparam_type = req.query.type;


if (qparam_runNumber == null){qparam_runNumber = 390008;}
if (qparam_from == null){qparam_from = 1000;}
if (qparam_to == null){qparam_to = 2000;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}
if (qparam_streamList == null){qparam_streamList = 'A,B,DQM,DQMHistograms,HLTRates,L1Rates';} //review default initialization
if (qparam_type == null){qparam_type = 'minimerge';}

var requestKey = 'minimacroperstream?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&type='+qparam_type;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.minimacroperstream; //cached ES response ttl (in seconds)


var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('minimacroperstream (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get minimerge
var q2 = function(callback, total_q1){

   var queryJSON;
   if (qparam_type==='micromerge') {
     qparam_type='stream-hist';
     queryJSON = queryJSON1;
     queryJSON.query.bool.must[1].prefix._id = qparam_runNumber;
   }
   else {
     queryJSON = queryJSON2;
     queryJSON.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
   }

   queryJSON.query.bool.must[0].range.ls.from = qparam_from;
   queryJSON.query.bool.must[0].range.ls.to = qparam_to;

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: qparam_type,
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        //var results = body.hits.hits; //hits for query
        var streams = body.aggregations.stream.buckets;
        var streamNames = [];
        for (var is=0;is<streams.length;is++)
          streamNames.push(streams[is].key);
        for (var j=0;j<streamListArray.length;j++){
		var stream = streamListArray[j];
                if (stream == '') continue
                var processed;
                var doc_count;
                var i = streamNames.indexOf(stream);
		if (i == -1){
		        processed = 0;
		        doc_count = 0;
		} else {
		        processed = streams[i].processed.value;
		        doc_count = streams[i].doc_count;
                }
		//calc minimerge percents
		var percent;
		if (total_q1 == 0){
			if (doc_count == 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
			var p = 100*processed/total_q1;
			percent = Math.round(p*100)/100;
		}
		
		var color = percColor(percent);	
		
		var b = false;
		if (qparam_type === 'minimerge'){
			b = true;
		}

		var entry = {
			"name" : stream,
			"y" : percent,
			"color" : color,
			"drilldown" : b
		};
		retObj.percents.push(entry);
	}
        callback();
    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

};//end q2

//Get total
var q1 = function(callback){
  streamListArray = qparam_streamList.split(',');

  queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON3.query.filtered.query.range.ls.from = qparam_from;
  queryJSON3.query.filtered.query.range.ls.to = qparam_to;


  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON3)
    }).then (function(body){
       // var results = body.hits.hits; //hits for query
        var total = body.aggregations.events.value;
	var doc_count = body.hits.total;
        callback(sendResult, total);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

};//end q1

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);
 
 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('minimacroperstream (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}






  }
}

