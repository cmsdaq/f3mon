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


console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperbu request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_stream = req.query.stream;
var qparam_sysName = req.query.sysName;
var qparam_streamList = req.query.streamList;
var qparam_type = req.query.type;


if (qparam_runNumber == null){qparam_runNumber = 390008;}
if (qparam_from == null){qparam_from = 1000;}
if (qparam_to == null){qparam_to = 2000;}
if (qparam_stream == null){qparam_stream = 'A';}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}
if (qparam_streamList == null){qparam_streamList = 'A,B,DQM,DQMHistograms,HLTRates,L1Rates';} //review default initialization
if (qparam_type == null){qparam_type = 'minimerge';}

var requestKey = 'minimacroperbu?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&stream='+qparam_stream+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&type='+qparam_type;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.minimacroperbu; //cached ES response ttl (in seconds)


var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('minimacroperbu (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//TODO: implement q1 and q2 with "appliance" field aggs

//Get mini or macro merge
var q2 = function (callback,totals_q1){

  if (queryJSON1.size>9000) queryJSON1.size=9000;
  queryJSON1.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
  queryJSON1.query.bool.must[0].range.ls.from = qparam_from;
  queryJSON1.query.bool.must[0].range.ls.to = qparam_to;
  queryJSON1.query.bool.must[2].term.stream.value = qparam_stream;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: qparam_type,
    body : JSON.stringify(queryJSON1)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	var totalProc = {};
		
	for (var i=0;i<results.length;i++){
                var id = results[i]._id;
                var strpos = id.indexOf('bu');
                var bu = id.substring(strpos);
		var processed = results[i]._source.processed;
		if (totalProc[bu] == null){
                        totalProc[bu] = 0;
                }
                totalProc[bu] += processed;
	}

        var mykeys = [];
        for (var mykey in totals_q1) {
          if (totals_q1.hasOwnProperty(mykey)) {
            mykeys.push(mykey);
          }
        }
        mykeys.sort();
        var keylen = mykeys.length;
        for (var i = 0; i < keylen; i++) {
          var buname = mykeys[i];
                var total = totals_q1[buname];
		var proc = -1;
		if (totalProc[buname] == null){
			proc = 0;
		}else{
			proc = totalProc[buname];
		}

		//calc percents
		var percent;
		if (total == 0){
			if (proc == 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
			var p = 100*proc/total;
                       	percent = Math.round(p*100)/100;
		}
		var color = percColor(percent);

		var entry = {
                  "name" : buname,
                  "y" : percent,
                  "color" : color,
                  "drilldown" : false
                };
                retObj.percents.push(entry);
	}
	callback();

    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

}//end q2

//Get total
var q1 = function (callback){
  streamListArray = qparam_streamList.split(',');

  queryJSON2.size = 9000;
  queryJSON2.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON2.query.filtered.query.range.ls.from = qparam_from;
  queryJSON2.query.filtered.query.range.ls.to = qparam_to;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON2)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
  	var totals = {}; //obj to hold per bu event counters

	for (var i=0;i<results.length;i++){
		var id = results[i]._id;
		var total = results[i]._source.NEvents;
		var strpos = id.indexOf('bu');
		var bu = id.substring(strpos);
		if (totals[bu] == null){
			totals[bu] = 0;	
		}
		totals[bu] += total;
	}
        callback(sendResult, totals);
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
 
 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('minimacroperbu (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

  }
}

