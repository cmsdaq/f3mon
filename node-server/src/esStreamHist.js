'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var smdb;
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

  setup : function(cache,cacheSec,cl,smdb_,ttl,totTimes,queryJSN1,queryJSN2,queryJSN3) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    smdb = smdb_;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
    queryJSON3 = queryJSN3;
  },

  query : function (req, res) {


console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'streamhist request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_lastLs = req.query.lastLs;
var qparam_intervalNum = req.query.intervalNum;
var qparam_sysName = req.query.sysName;
var qparam_streamList = req.query.streamList;
var qparam_timePerLs = req.query.timePerLs;
var qparam_useDivisor = req.query.useDivisor;

if (qparam_runNumber == null){qparam_runNumber = 124029;}
if (qparam_from == null){qparam_from = 1;}
if (qparam_to == null){qparam_to = 1;}
if (qparam_lastLs == null){qparam_lastLs = 58;}
if (qparam_intervalNum == null){qparam_intervalNum = 28;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}
if (qparam_streamList == null){qparam_streamList = '';}
if (qparam_timePerLs == null){qparam_timePerLs = 23.4;}
if (qparam_useDivisor == null){qparam_useDivisor = false;}else{qparam_useDivisor = (req.query.useDivisor === 'true');}

if (parseInt(qparam_from)>parseInt(qparam_to)) {
  console.log('invalid range: from ' + qparam_from + " to " + qparam_to);
  qparam_from=qparam_to;
}


var streamListArray = qparam_streamList.split(',');
if (qparam_lastLs<21){qparam_lastLs = 21;}
if (!qparam_useDivisor){qparam_timePerLs = 1;}
var x = (parseInt(qparam_to) - parseInt(qparam_from))/parseInt(qparam_intervalNum);
var interval = Math.round(x); 
if (interval == 0){interval = 1;}

var allDQM=true;
streamListArray.forEach(function(s) {
  if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms')) allDQM=false;
});

var requestKey = 'streamhist?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&lastLs='+qparam_lastLs+'&intervalNum='+qparam_intervalNum+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&timePerLs='+qparam_timePerLs+'&useDivisor='+qparam_useDivisor;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.streamhist; //cached ES response ttl (in seconds)

//helper variables with cb-wide scope
var lastTimes = [];
var tsList = {};
var streamTotals;
var took = 0;
var streamNum;
var postOffSt;

var retObj = {
	"streams" : "",
	"took" : "",
	"lsList" : "",
        "micromerge" : "",
        "minimerge" : "",
	"macromerge" : "",
	"nransfer" : "",
	"navbar" : "",
	"interval" : "",
	"lastTime" : ""
};

var sendResult = function(){
	//set lastTime to max(lastTimes)
	var maxLastTime = Math.max.apply(Math, lastTimes);
	retObj.lastTime = maxLastTime;
	//console.log(JSON.stringify(lastTimes));
	retObj.interval = interval;

	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('streamhist (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get transfer (from cache only)
var q6 = function (callback) {

  var lsList = streamTotals.lsList;
  if( lsList.length==0) {callback();return;}

  var trReqObj = {"run": qparam_runNumber, "binary":true , "aggregate":true}
  var transferInfo = smdb.runTransferQuery(trReqObj,'internal-f3mon',null,false);
  if (transferInfo===null) {
    callback();
    return;
  }
  //for (var i=0;i<transferInfo.length;i++) {console.log(transferInfo[i]);}
  var transferInfoLen = transferInfo.length;

  var lsIndex = 0;
  var currentLs = lsList[lsIndex] - postOffSt;
  var nextLs=null;
  if( lsList.length>1)
    var nextLs = lsList[lsIndex+1] - postOffSt;
  if (currentLs<=0) {
    callback();
    return;
  }
  var beginIndex = currentLs-1;
  var step = 1;
  //search for beginning of the interval
  while (beginIndex < transferInfoLen && transferInfo[beginIndex].ls > currentLs) {
    beginIndex-=step;
    step*=2;
    if (beginIndex<=0) {beginIndex=0;break;}
  }

  transStatus = {"percents":[]};
  
  //lsobj = {"ls":tls,"cop":(copied!==null), "s":1, "c":0}
  var tsObj = undefined;
  var nC = undefined;
  var nS = undefined;

  for (var i=beginIndex;i<transferInfoLen;i++)
  {
        if (transferInfo[i].ls < currentLs) continue;
        tInfo = transferInfo[i];
        if (tInfo.ls == currentLs) {
          //new bin
          tsObj = {"x":currentLs,"y":0}
          nC = tInfo.copy;
          nS = tInfo.s;
          //console.log( nC +' '+nS)
        }
        else if (lsIndex+1>=lsList.length) { //exceeded eols LS count
          if (tsObj!==undefined) {
            tsObj.y = nC / nS;
            //console.log('pushingA '+tsObj.x +' ' + tsObj.y);
            transStatus.percents.push(tsObj);
            tsObj = undefined;
          }
          break;
        }
        //accumulate
        else if (tInfo.ls<nextLs) {
          if (tsObj===undefined) {
            tsObj = {"x":currentLs,"y":0}
            nC = tInfo.copy;
            nS = tInfo.s;
            //console.log('tsObj '+ tsObj.x);
          } else {
            nC += tINfo.copy;
            nS += tINfo.s;
          }
        }
        else { //exceeded of skipped over nextLs
          if (tsObj!==undefined) {
            tsObj.y = nC / nS;
            //console.log('pushingB '+tsObj.x +' ' + tsObj.y);
            transStatus.percents.push(tsObj);
            tsObj = undefined;
          }
          while (nextLs && tInfo.ls>=nextLs) {
              currentLs=nextLs;
              lsIndex+=1;
              if (lsIndex<lsList.length)
                nextLs=lsList[lsIndex]-postOffSt;
              else nextLs=null;
          }
          if (tInfo.ls==currentLs || (nextLs && tInfo.ls<nextLs)) {
            tsObj = {"x":currentLs,"y":0}
            nC = tInfo.copy;
            nS = tInfo.s;
          }
        }
        //exceeded either length
        if (i === transferInfoLen-1 && tsObj!==undefined) {
          tsObj.y = nC / nS;
          //console.log('pushingC '+tsObj.x +' ' + tsObj.y);
          transStatus.percents.push(tsObj);
          tsObj = undefined;
          break;
        }
  }
  transStatus.took=0;

  retObj.transfer=transStatus;
  callback();

}

//Get macromerge
var q5 = function (callback){

	queryJSON1.query.bool.must.prefix._id = 'run' + qparam_runNumber;
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

        queryJSON1.query.bool.should = []; //[{"bool":{"must_not":{"prefix":{"value":"DQM"}}}}];
        streamListArray.forEach(function(s) {
        if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM)
           queryJSON1.query.bool.should.push({"term":{"stream":{"value":s}}});
        });

	client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'macromerge',
         body : JSON.stringify(queryJSON1)
    	}).then (function(body){
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
			lastTimes.push(results[0].fields.fm_date[0]*1000);
		}
		took += body.took;

		var macromerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		
		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        var procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value;
			var processed = lsList[i].procAll.value;
			var total = streamTotals.events[ls]*streamNum;
			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
                        var processedSel;
                        if (allDQM) processedSel = processed;
                        else processedSel = procNoDQM;

			//calc macromerge percents
 			var percent;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
                                        percent = 0;
                                }else{
                                        percent = 100;
                                }
                        }else{
                                var p = 100*processedSel/total;
                                percent = Math.round(p*100)/100;
                        }
                        var color = percColor(percent);
                        if (allDQM && percent<100. && percent>50.) color = "olivedrab";

                        var eolts = undefined;
                        if (tsList.hasOwnProperty(ls)) eolts=tsList[ls];

                        var entry = {
                        "x" : ls,
                        "y" : percent,
                        "eolts" : eolts,
                        "color" : color
                        };
                        macromerge.percents.push(entry);
		}
		retObj.macromerge = macromerge;
		retObj.took = took;
		callback(); //sendResult()
                //uncomment instead of previous for transfer completeness strip (here and in q4)
		//callback(sendResult); //q6(sendResult)
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q5


//Get minimerge
var q4 = function (callback){

	queryJSON1.query.bool.must.prefix._id = 'run' + qparam_runNumber;
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

        queryJSON1.query.bool.should = []; //= [{"bool":{"must_not":{"prefix":{"value":"DQM"}}}}];
        streamListArray.forEach(function(s) {
         if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM)
           queryJSON1.query.bool.should.push({"term":{"stream":{"value":s}}});
        });
	client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'minimerge',
         body : JSON.stringify(queryJSON1)
    	}).then (function(body){
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
			lastTimes.push(results[0].fields.fm_date[0]*1000);
		}
		took += body.took;

		var minimerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		
		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        var procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value;
                        var processed = lsList[i].procAll.value;
			var total = streamTotals.events[ls]*streamNum;
			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
                        var processedSel;
                        if (allDQM) processedSel = processed;
                        else processedSel = procNoDQM;

			//calc minimerge percents
 			var percent;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
                                        percent = 0;
                                }else{
                                        percent = 100;
                                }
                        }else{
                                var p = 100*processedSel/total;
                                percent = Math.round(p*100)/100;
                        }
                        var color = percColor(percent);
                        if (allDQM && percent<100. && percent>50.) color = "olivedrab";

                        var entry = {
                        "x" : ls,
                        "y" : percent,
                        "color" : color
                        };
                        minimerge.percents.push(entry);
		}
		retObj.minimerge = minimerge;
		callback(sendResult); // q5(sendResult)
                //uncomment instead of previous for stream completeness info (here and in q5)
		//callback(q6); //q5(q6)
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q4


//Get stream out
var q3 = function (callback){

	//queryJSON2.query.filtered.filter.and.filters[0].prefix._id = qparam_runNumber;
	//queryJSON2.query.prefix._id = qparam_runNumber;
	queryJSON2.query.term._parent = parseInt(qparam_runNumber);
	queryJSON2.aggs.stream.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON2.aggs.stream.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'stream-hist',
    body : JSON.stringify(queryJSON2)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	if (results.length>0){
		lastTimes.push(results[0].fields._timestamp);
	}
	took += body.took;
	
	var streams = body.aggregations.stream.buckets;
	
	var streamData = {
		"streamList" : [],
		"data" : []
	};

        var totSumIn={};
        var totSumError={};
        var nStreamsMicro=0;


	for (var i=0;i<streams.length;i++){
		 if (streams[i].key == '' || streamListArray.indexOf(streams[i].key) == -1){
                        continue;
                }
                nStreamsMicro+=1;
		var sout = {
			"stream" : streams[i].key,
			"dataOut" : [],
			"fileSize" : [],
			"sizePerEvt" : []
		};
		streamData.streamList.push(streams[i].key);
		
		var lsList = streams[i].inrange.ls.buckets;
		for (var j=0;j<lsList.length;j++){
			var ls = lsList[j].key+postOffSt;
			var total = streamTotals.events[ls];
			var doc_count = streamTotals.doc_counts[ls];

                        if (totSumIn[ls]==null) {
                          totSumIn[ls]=0;
                          totSumError[ls] = 0;
                        }
			
			//rounding with 2 dp precision
			var inval = Math.round(100*lsList[j].in.value)/100;
			var outval = Math.round(100*lsList[j].out.value)/100;
			var fsval = Math.round(100*lsList[j].filesize.value)/100;
			var errval =0;
                        if (lsList[j].error!=undefined)
                          errval = Math.round(100*lsList[j].error.value)/100;

                        //for total %
                        totSumIn[ls] += inval;
                        totSumError[ls] += errval;

			//calc stream percents
			//var percent;
			var percentProc;
			if (total == 0){
				if (doc_count == 0){
					percent = 0;
				}else{
					percent = 100;
				}
			}else{
				//var p = 100*(inval+errval)/total;
                                //percent = Math.round(p*100)/100;
				var pnoerr = 100*inval/total;
                                percentProc = Math.round(pnoerr*100)/100;
			}

			//output
			if (qparam_timePerLs>1){
				outval = Math.round((outval/qparam_timePerLs)*100)/100;
				fsval = Math.round((fsval/qparam_timePerLs)*100)/100;
			}

                        var seval = 0;
                        if (outval>0) seval = Math.round(fsval/outval);

			var d = {"x":ls,"y":outval, 'p':percentProc}; 
			var f = {"x":ls,"y":fsval, 'p':percentProc};
			var se = {"x":ls,"y":seval, 'p':percentProc};
			//var p = {"x":ls,"y":percent};
			//var pproc = {"x":ls,"y":percent};
			sout.dataOut.push(d);
			sout.fileSize.push(f);
                        sout.sizePerEvt.push(se);
			//sout.pMicro.push(pproc);

		}//end for j
		streamData.data.push(sout);			
	}//end for i

        
        var micromerge = {
			"percents" : [],
			"took" : body.took
	};
		
	var lsList = streamTotals.lsList;
		
	for (var i=0;i<lsList.length;i++){
		var ls = lsList[i];
		var processed = totSumIn[ls];
                if (processed == undefined) processed=0;
		var err = totSumError[ls];
                if (err == undefined) err=0;
		var total = streamTotals.events[ls]*nStreamsMicro;
		var doc_count = streamTotals.doc_counts[ls];
		//var mdoc_count = lsList[i].doc_count;

		//calc minimerge percents
		var percent;
		if (total == 0){
			if (doc_count == 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
			var p = 100*(processed+err)/total;
			percent = Math.round(p*100)/100;
		}
		var color = percColor2(percent,err>0);
                if (total==0) color = "palegreen";

		var entry = {
			"x" : ls,
			"y" : percent,
			"color" : color
		};
		micromerge.percents.push(entry);
        }

	retObj.streams = streamData;
	retObj.took = took;
	retObj.micromerge = micromerge;
	retObj.lsList = streamTotals.lsList;
	
	//Filter DQM from streamlist
	var mmStreamList = [];
	for (var k=0;k<streamListArray.length;k++){
		var s = streamListArray[k];
		if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM){
			mmStreamList.push(streamListArray[k]);
		}
	}
	streamNum = mmStreamList.length;
	
	callback(q5); //q4(q5)
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
   });

}//end q3

//Get totals
var q2 = function (callback){

  queryJSON3.aggregations.ls.histogram.interval = parseInt(interval);
  queryJSON3.aggregations.ls.histogram.extended_bounds.min = qparam_from;
  queryJSON3.aggregations.ls.histogram.extended_bounds.max = qparam_to;
  queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON3.query.filtered.query.range.ls.from = qparam_from;
  queryJSON3.query.filtered.query.range.ls.to = qparam_to;

 client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON3)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	if (results.length>0){
        	lastTimes.push(results[0].fields._timestamp);
	}
	var buckets = body.aggregations.ls.buckets;
	var postOffset = buckets[buckets.length-1];
        postOffset = qparam_to - postOffset.key;
	postOffSt = postOffset; //pass to wider scope
	var ret = {
		"lsList" : [],
                "events" : {},		//obj repres. associative array (but order not guaranteed!)
                "files" : [],
		"doc_counts" : {}	//obj repres. associative array (but order not guaranteed!)
        };	

	took += body.took;
	for (var i=0;i<buckets.length;i++){
		var ls = buckets[i].key + postOffSt;
                var events = buckets[i].events.value;
		var doc_count = buckets[i].doc_count;
		ret.events[ls] = events;
		ret.doc_counts[ls] = doc_count;
		//ret.events.push(ev_entry);	//old impl. using indxd array and intermediate obj for entry
		//ret.doc_counts.push(dc_entry); //same as above
		ret.lsList.push(ls);
                tsList[ls] = buckets[i].time.value;
	}
	streamTotals = ret;	
	callback(q4); //q3(q4)
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
   });

}//end q2

//Navbar full range totals
var q1 = function (callback){
  var x = (parseInt(qparam_lastLs) - parseInt(1))/parseInt(qparam_intervalNum);
  var navInterval = Math.round(x);
  if (navInterval == 0){navInterval = 1;}
  
  queryJSON3.aggregations.ls.histogram.interval = parseInt(navInterval);
  queryJSON3.aggregations.ls.histogram.extended_bounds.min = 1;
  queryJSON3.aggregations.ls.histogram.extended_bounds.max = qparam_lastLs;
  queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON3.query.filtered.query.range.ls.from = 1;
  queryJSON3.query.filtered.query.range.ls.to = qparam_lastLs;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON3)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	if (results.length>0){
		lastTimes.push(results[0].fields._timestamp);
	}
	var ret = {
		"events" : [],
		"files" : []
	};
	took = body.took;
	var buckets = body.aggregations.ls.buckets;

	var postOffset = buckets[buckets.length-1];
	postOffset = qparam_lastLs - postOffset.key;

	if (buckets[0].key>0){
		var arr = [0,0];
		ret.events.push(arr);
		ret.files.push(arr);
	}
	
	for (var i=0;i<buckets.length;i++){
		var ls = buckets[i].key;
		var events = buckets[i].events.value;
		var files = buckets[i].files.value; 
		var add = ls + postOffset; 
		var arr_e = [add,events];
		var arr_f = [add,files];
		ret.events.push(arr_e);
                ret.files.push(arr_f);
	}
	retObj.navbar = ret;
	callback(q3); //q2(q3)
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
        console.log('streamhist (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}



  }
}

