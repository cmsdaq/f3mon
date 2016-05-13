'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON1;
var queryJSON2;
var queryJSON3;
var queryJSON4;

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

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN1,queryJSN2,queryJSN3,queryJSN4) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
    queryJSON3 = queryJSN3;
    queryJSON4 = queryJSN4;

  },

  query : function (req, res) {


console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperhost request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_stream = req.query.stream;
var qparam_sysName = req.query.sysName;
var qparam_type = req.query.type;
var qparam_streamList = req.query.streamList;

if (qparam_runNumber == null){qparam_runNumber = 390008;}
if (qparam_from == null){qparam_from = 1000;}
if (qparam_to == null){qparam_to = 2000;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}
if (qparam_stream == null){qparam_stream = 'A';}
if (qparam_streamList == null){qparam_streamList = 'A';}

var stream_id;
if (qparam_type==='macromerge')
  stream_id = qparam_streamList
else
  stream_id = qparam_stream

var requestKey = 'minimacroperhost?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&sysName='+qparam_sysName+'&streamid='+stream_id+'&type='+qparam_type;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.minimacroperbu; //cached ES response ttl (in seconds)

var inner = [];
var retObj = {
	"percents" : inner
};

var totals = {}; //obj to hold per bu event counters

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('minimacroperhost (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}


//Get minimerge
var q2 = function(callback){

   queryJSON1.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
   queryJSON1.query.bool.must[0].range.ls.from = qparam_from;
   queryJSON1.query.bool.must[0].range.ls.to = qparam_to;
   queryJSON1.query.bool.must[2].term.stream.value = qparam_stream;
   queryJSON1.query.bool.must[2].term.stream.value = qparam_stream;

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'minimerge',
    body : JSON.stringify(queryJSON1)
    }).then (function(body){
        try {
        //var results = body.hits.hits; //hits for query
        var hosts = body.aggregations.host.buckets;
        var hostNames = [];
        for (var ib=0;ib<hosts.length;ib++)
          hostNames.push(hosts[ib].key);
        for (var host in totals) {
          if (host == '') continue;
          if (totals.hasOwnProperty(host)) {
                var processed;
                var doc_count;
                var i = hostNames.indexOf(host);
		if (i == -1){
		        processed = 0;
		        doc_count = 0;
		} else {
		        processed = hosts[i].processed.value;
		        doc_count = hosts[i].doc_count;
                }
                var total = totals[host];
		//calc minimerge percents
		var percent;
		if (total == 0){
			if (doc_count == 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
			var p = 100*processed/total;
			percent = Math.round(p*100)/100;
		}
		
		var color = percColor(percent);	
		
		var entry = {
			"name" : host,
			"y" : percent,
			"color" : color,
			"drilldown" : false
		};
		retObj.percents.push(entry);
            }
	}
        callback();
        //} catch (e) {_this.exCb(res,e,requestKey)} 
        } catch (e) {exCb(res,e)}
    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

};//end q2


//Get macromerge
var q2macro = function(callback,total_q1){

   queryJSON2.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
   queryJSON2.query.bool.must[0].range.ls.from = qparam_from;
   queryJSON2.query.bool.must[0].range.ls.to = qparam_to;

   var streamListArray = qparam_streamList.split(',');
   var should_query = []
   for (var str=0;str<streamListArray.length;str++) {
     should_query.push( {"term" : { "stream" : streamListArray[str] }})
   }
   queryJSON2.query.bool.should = should_query;

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'macromerge',
    body : JSON.stringify(queryJSON2)
    }).then (function(body){
      try {
        //var results = body.hits.hits; //hits for query
        var hosts = body.aggregations.host.buckets;
        for (var i=0;i<hosts.length;i++) {
                var host = hosts[i].key;
                if (host === '') continue;
		var processed = hosts[i].processed.value;
		var doc_count = hosts[i].doc_count;
		//calc minimerge percents
		var percent;
		if (total_q1*streamListArray.length === 0){
			if (doc_count === 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
			var p = 100*processed/total_q1;
			percent = Math.round(p*100)/100;
		}
		
		var color = percColor(percent);	
		
		var entry = {
			"name" : host,
			"y" : percent,
			"color" : color,
			"drilldown" : false
		};
		retObj.percents.push(entry);
	}
        callback();
      //} catch (e) {_this.exCb(res,e,requestKey)}
      } catch (e) {exCb(res,e)}
    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

};//end q2


//Get totals from EoLS
var q1 = function(callback){

  queryJSON3.query.bool.must[1].term._parent = qparam_runNumber;
  queryJSON3.query.bool.must[0].range.ls.from = qparam_from;
  queryJSON3.query.bool.must[0].range.ls.to = qparam_to;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON3)
    }).then (function(body){
      try {
        //console.log(body.aggregations.host.buckets)
        var host_buckets = body.aggregations.host.buckets;
        for (var i=0;i<host_buckets.length;i++) {
	  totals[host_buckets[i].key] = host_buckets[i].events.value;
        }
	//var doc_count = body.hits.total;
        callback(sendResult);
      //} catch (e) {_this.exCb(res,e,requestKey)}
      } catch (e) {exCb(res,e)}
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

};//end q1

var q1macro = function(callback){

  queryJSON4.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON4.query.filtered.query.range.ls.from = qparam_from;
  queryJSON4.query.filtered.query.range.ls.to = qparam_to;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON4)
    }).then (function(body){
     try {
       // var results = body.hits.hits; //hits for query
        var total = body.aggregations.events.value;
	var doc_count = body.hits.total;
        callback(sendResult, total);
      //} catch (e) {_this.exCb(res,e,requestKey)}
      } catch (e) {exCb(res,e)}
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

 if (qparam_type == 'minimerge')
   q1(q2); //call q1 with q2 as its callback
 else if (qparam_type == 'macromerge')
   q1macro(q2macro);

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('minimacroperhost (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}






  }
}

