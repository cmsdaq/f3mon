'use strict';

var Common = require('./esCommon')
module.exports = new Common()

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


module.exports.query = function (req, res) {

  var qname = 'streamhist'
  //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');
  var eTime = this.gethrms();
  var cb = req.query.callback;

  //GET query string params
  var qparam_runNumber = req.query.runNumber;
  var qparam_from = parseInt(req.query.from);
  var qparam_to = parseInt(req.query.to);
  var qparam_lastLs = parseInt(req.query.lastLs);
  var qparam_intervalNum = parseInt(req.query.intervalNum);
  var qparam_sysName = req.query.sysName;
  var qparam_streamList = req.query.streamList;
  var qparam_timePerLs = req.query.timePerLs;
  var qparam_useDivisor = req.query.useDivisor;
  var qparam_accum = req.query.accum;
  var qparam_allStreams = req.query.allStreams;

  if (qparam_runNumber == null){qparam_runNumber = 0;}
  if (qparam_from == null){qparam_from = 1;}
  if (qparam_to == null){qparam_to = 1;}
  if (qparam_lastLs == null){qparam_lastLs = 1;}
  if (qparam_intervalNum == null){qparam_intervalNum = 25;}
  if (qparam_sysName == null){qparam_sysName = 'cdaq';}
  if (qparam_streamList == null){qparam_streamList = '';}
  if (qparam_timePerLs == null){qparam_timePerLs = 23.31;}
  if (qparam_useDivisor == null){qparam_useDivisor = false;} else {qparam_useDivisor = (req.query.useDivisor === 'true');}
  if (qparam_allStreams == null) qparam_allStreams=false;
  if (qparam_allStreams == 'false') qparam_allStreams=false;

  //calculate interval length taking into account integer rounding
  var interval = Math.round((qparam_to - qparam_from)/qparam_intervalNum) || 1;
  //get bin edges (real interval that elastic decides to use) for interval and range //TODO:fix this using offset
  qparam_from = qparam_from - (qparam_from%interval)//gets rounded down to multiple of interval
  if (interval>1) qparam_from++;
  //if (interval===1) qparam_from++;
  qparam_to = qparam_to + interval -1 - ((qparam_to-1)%interval);//sum up to the one-before-next element ( 2nd -1 is aggOffset)

  //2nd pass to get better matched interval number
  var interval = Math.round((qparam_to - qparam_from)/qparam_intervalNum) || 1;
  qparam_from = qparam_from - (qparam_from%interval)
  if (interval>1) qparam_from++;
  qparam_to = qparam_to + interval - 1 - ((qparam_to-1)%interval);

  var aggOffset = 1;//binning offset for histogram aggregation (LS starts at 1)

  var qparam_from_before = 0;
  if (qparam_accum === null || qparam_accum===undefined || qparam_accum === false || qparam_accum==='false') {qparam_accum=false} else {
    qparam_accum=true;
    qparam_useDivisor=false;
    qparam_from_before=  qparam_from -1;
  }

  if (parseInt(qparam_from)>parseInt(qparam_to)) {
    console.log('invalid range: from ' + qparam_from + " to " + qparam_to);
    qparam_from=qparam_to;
  }

  var streamListArray = qparam_streamList.split(',');
  if (qparam_lastLs<21){qparam_lastLs = 21;}
  if (!qparam_useDivisor){qparam_timePerLs = 1;}


  var allDQM=true;
  streamListArray.forEach(function(s) {
    if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms')) allDQM=false;
  });

  var requestKey;
  if (!qparam_allStreams)
    requestKey = 'streamhist?'+qparam_runNumber+'&='+qparam_from+'&='+qparam_to
                   +'&='+qparam_lastLs+'&='+qparam_intervalNum+'&='+qparam_sysName
                   +'&='+qparam_streamList+'&='+qparam_timePerLs+'&='
                   +qparam_useDivisor+'&='+qparam_accum;
  else
    requestKey = 'streamhist?'+qparam_runNumber+'&='+qparam_from+'&='+qparam_to
                   +'&='+qparam_lastLs+'&='+qparam_intervalNum+'&='+qparam_sysName
                   +'&='+qparam_timePerLs+'&='+qparam_useDivisor+'&='+qparam_accum;

  var ttl = global.ttls.streamhist; //cached ES response ttl (in seconds)

  //helper variables with cb-wide scope
  var lastTimes = [];
  var tsList = {};
  var streamTotals;
  var streamBeforeTotal = 0;
  var streamBeforeTotal_b = 0;
  var took = 0;
  var streamNum;
  var postOffSt;
  var maxls = 0;

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
  retObj.interval = interval;

  //Get transfer (from cache only)
  var q6 = function (callback) {

    var lsList = streamTotals.lsList;
    if( lsList.length==0) {callback();return;}

    var trReqObj = {"run": qparam_runNumber, "binary":true , "aggregate":true}
    var transferInfo = global.smdb.runTransferQuery(trReqObj,'internal-f3mon',null,false,null);
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
      callback(); // sendResult
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
    callback();//sendResult(...)

  }

  //Get macromerge
  var q5 = function (_this){
        var queryJSON1 = _this.queryJSON1;
        queryJSON1.query.bool.must.prefix._id = 'run'+qparam_runNumber;
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON1.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON1.aggs.sumbefore.filter.range.ls.to = qparam_from_before;

        queryJSON1.query.bool.should = []; //[{"bool":{"must_not":{"prefix":{"value":"DQM"}}}}];
        streamListArray.forEach(function(s) {
          if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM)
            queryJSON1.query.bool.should.push({"term":{"stream":{"value":s}}});
        });

	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'macromerge',
         body : JSON.stringify(queryJSON1)
    	}).then (function(body){
          try {
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
                  var fm_date_val = results[0].fields.fm_date[0];
                  if (fm_date_val < 2000000000) lastTimes.push(results[0].fields.fm_date[0]*1000);
                  else lastTimes.push(results[0].fields.fm_date[0]);
		}
		took += body.took;

		var macromerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		
		var beforeLs = body.aggregations.sumbefore;

                var procNoDQMAccum = beforeLs.procNoDQM.processed.value + beforeLs.procDQMHisto.processed.value;
                var processedAccum = beforeLs.procAll.value

                var totAcc = 0;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

                        var procNoDQM;
                        var processed;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value + procNoDQMAccum;
                          processedAccum = processed = lsList[i].procAll.value + processedAccum;
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value;
                          processed = lsList[i].procAll.value;
                        }

                        var total;
                        if (qparam_accum)
                          total = (streamTotals.events[ls] + totAcc + streamBeforeTotal)*streamNum;
                        else 
                          total = streamTotals.events[ls]*streamNum;
                        totAcc += streamTotals.events[ls];

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
                                if (p>=99.995 && p<100)
                                  percent = Math.round(p*1000)/1000;
                                else
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
	        var maxLastTime = Math.max.apply(Math, lastTimes);
	        retObj.lastTime = maxLastTime;
                //reply
                _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
          } catch (e) {_this.exCb(res,e,requestKey)}
	}, function (error){
		_this.excpEscES(res,error,requestKey);
        	console.trace(error.message);
  	 });

  }//end q5


  //Get minimerge
  var q4 = function (_this){

        var queryJSON1 = _this.queryJSON1;
        queryJSON1.query.bool.must.prefix._id = 'run'+qparam_runNumber;
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON1.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON1.aggs.sumbefore.filter.range.ls.to = qparam_from_before;

        queryJSON1.query.bool.should = []; //= [{"bool":{"must_not":{"prefix":{"value":"DQM"}}}}];
        streamListArray.forEach(function(s) {
          if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM)
            queryJSON1.query.bool.should.push({"term":{"stream":{"value":s}}});
        });
	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'minimerge',
         body : JSON.stringify(queryJSON1)
    	}).then (function(body){
          try {
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
                  var fm_date_val = results[0].fields.fm_date[0];
                  if (fm_date_val < 2000000000) lastTimes.push(results[0].fields.fm_date[0]*1000);
                  else lastTimes.push(results[0].fields.fm_date[0]);
		}
		took += body.took;

		var minimerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		var beforeLs = body.aggregations.sumbefore;

                var procNoDQMAccum = beforeLs.procNoDQM.processed.value + beforeLs.procDQMHisto.processed.value;
                var processedAccum = beforeLs.procAll.value

                var totAcc = 0;
                var fakeMicro = false
                if (retObj.micromerge.percents.length==lsList.length) fakeMicro=true;
                //else console.log(fakeMicro)

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

                        var procNoDQM;
                        var processed;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value + procNoDQMAccum;
                          processedAccum = processed = lsList[i].procAll.value + processedAccum;
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value + lsList[i].procDQMHisto.processed.value;
                          processed = lsList[i].procAll.value;
                        }

                        var total;
                        if (qparam_accum)
                          total = (streamTotals.events[ls] + totAcc + streamBeforeTotal)*streamNum;
                        else 
                          total = streamTotals.events[ls]*streamNum;
                        totAcc += streamTotals.events[ls];

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
                                if (p>=99.995 && p<100)
                                  percent = Math.round(p*1000)/1000;
                                else
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
                        if (fakeMicro) {
                          var tobj = retObj.micromerge.percents[i];
                          if (tobj.y<percent) {
                            tobj.y=percent;
                            tobj.color=percColor2(percent,tobj.err);
                          }
                        }
		}
		retObj.minimerge = minimerge;
                q5(_this)
                //uncomment instead of previous for stream completeness info (here and in q5)
		//callback(q6); //q5(q6)
          } catch (e) {_this.exCb(res,e,requestKey)}
	}, function (error){
		_this.excpEscES(res,error,requestKey);
        	console.trace(error.message);
  	 });

  }//end q4


  //Get stream out
  var q3 = function (_this){

    var queryJSON2 = _this.queryJSON2;
	//queryJSON2.query.filtered.filter.and.filters[0].prefix._id = qparam_runNumber;
	//queryJSON2.query.prefix._id = qparam_runNumber;
	queryJSON2.query.term._parent = parseInt(qparam_runNumber);
	queryJSON2.aggs.stream.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON2.aggs.stream.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON2.aggs.stream.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON2.aggs.stream.aggs.sumbefore.filter.range.ls.to = qparam_from_before;

        if (qparam_accum) {
          queryJSON2.aggs.stream.aggs.inrange.aggs.ls.aggs.out = {"sum": { "field": "out"}}
          queryJSON2.aggs.stream.aggs.inrange.aggs.ls.aggs.filesize = {"sum": { "field": "filesize"}}
        }
        else {
          queryJSON2.aggs.stream.aggs.inrange.aggs.ls.aggs.out = {"avg": { "field": "out"}}
          queryJSON2.aggs.stream.aggs.inrange.aggs.ls.aggs.filesize = {"avg": { "field": "filesize"}}
       }

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'stream-hist',
      body : JSON.stringify(queryJSON2)
    }).then (function(body){
      try {
      var results = body.hits.hits; //hits for query
      if (results.length>0){
                //is unix timestamp
		lastTimes.push(results[0].fields.date);
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
                var totStreamIn = streams[i].sumbefore.in.value;
                var totStreamOut = streams[i].sumbefore.out.value;
                var totStreamfsOut = streams[i].sumbefore.filesize.value;
                var totStreamErr = 0;
                if (streams[i].sumbefore.error!==undefined) totStreamErr = streams[i].sumbefore.error.value;

                var totAcc = 0;

		for (var j=0;j<lsList.length;j++){
			var ls = lsList[j].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

		        var total;
                        if (qparam_accum)
                          total = streamTotals.events[ls] + totAcc + streamBeforeTotal;
                        else
                          total = streamTotals.events[ls];

                        totAcc += streamTotals.events[ls];

			var doc_count = streamTotals.doc_counts[ls];

                        if (totSumIn[ls]==null) {
                          totSumIn[ls]=0;
                          totSumError[ls] = 0;
                        }
		
                        if (qparam_accum) {

                          //for total %
                          totSumIn[ls] += lsList[j].in.value + totStreamIn;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += lsList[j].error.value + totStreamErr;
                          //else
                          //  totSumError[ls] += totStreamErr;

			  totStreamIn = totStreamIn + lsList[j].in.value; 
			  totStreamOut = totStreamOut + lsList[j].out.value; 
			  totStreamfsOut = totStreamfsOut + lsList[j].filesize.value;
                        }
                        else {

                          //for total %
                          totSumIn[ls] += lsList[j].in.value;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += lsList[j].error.value;

			  totStreamIn = lsList[j].in.value; 
			  totStreamOut = lsList[j].out.value; 
			  totStreamfsOut = lsList[j].filesize.value;
                        }
			//rounding with 2 dp precision
			//var inval = Math.round(100*totStreamIn)/100;
			var inval = totStreamIn;
			var outval = Math.round(100*totStreamOut)/100;
			var fsval = Math.round(100*totStreamfsOut)/100;

                        //TODO
			var errval =0;
                        if (lsList[j].error!=undefined)
                          errval = Math.round(100*lsList[j].error.value)/100;

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
                                if (pnoerr>=99.995 && pnoerr<100)
                                  percentProc = Math.round(pnoerr*1000)/1000;
                                else
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

		}//end for j
		streamData.data.push(sout);
	}//end for i

        
        var micromerge = {
			"percents" : [],
			"took" : body.took
	};
		
	var lsList = streamTotals.lsList;
        totAcc = 0;
		
	for (var i=0;i<lsList.length;i++){
		var ls = lsList[i];
		var processed = totSumIn[ls];
                if (processed == undefined) processed=0;
		var err = totSumError[ls];
                if (err == undefined) err=0;
		var total;
                if (qparam_accum)
                  total = (streamTotals.events[ls] + totAcc + streamBeforeTotal)*nStreamsMicro;
                else 
                  total = streamTotals.events[ls]*nStreamsMicro;
                totAcc+=streamTotals.events[ls];
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
                        if (p>=99.995 && p<100)
			  percent = Math.round(p*1000)/1000;
                        else
			  percent = Math.round(p*100)/100;
		}
		var color = percColor2(percent,err>0);
                if (total==0) color = "palegreen";

		var entry = {
			"x" : ls,
			"y" : percent,
			"color" : color,
                        "err":err>0
		};
		micromerge.percents.push(entry);
        }

	retObj.streams = streamData;
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
	
	q4(_this); //q4(q5)
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end q3

  //Get totals
  var q2 = function (_this){

    var queryJSON3 = _this.queryJSON3;
    queryJSON3.aggregations.ls.histogram.interval = interval;
    queryJSON3.aggregations.ls.histogram.offset = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.min = qparam_from
    queryJSON3.aggregations.ls.histogram.extended_bounds.max = qparam_to;
    queryJSON3.aggregations.ls.histogram.offset = aggOffset; 
    queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
    queryJSON3.query.filtered.query.range.ls.from = qparam_from;
    queryJSON3.query.filtered.query.range.ls.to = qparam_to;
    queryJSON3.aggregations.sumbefore.filter.range.ls.to = 0;//not used, taken from previous agg

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON3)
    }).then (function(body){
      try {
        var results = body.hits.hits; //hits for query
	if (results.length>0){
                var eoltimes = new Date(results[0].fields.fm_date);
        	lastTimes.push(eoltimes.getTime());
	}
	var buckets = body.aggregations.ls.buckets;

//        var postOffset = Math.round(interval/2-1); //set to show median of the interval
        postOffSt = Math.round(interval/2-1); //set to show median of the interval
//	var postOffset = buckets[buckets.length-1];
//        postOffset = qparam_to - postOffset.key;

	//postOffSt = postOffset; //pass to wider scope
	var ret = {
		"lsList" : [],
                "events" : {},		//obj repres. associative array (but order not guaranteed!)
                "bytes" : {},
                "files" : {},
		"doc_counts" : {}	//obj repres. associative array (but order not guaranteed!)
        };	

        var retInput = {
          "events":[],
          "bytes":[],
          "bytesPerEvt":[]
        }

	took += body.took;
        var ls_accum   = streamBeforeTotal;
        var ls_accum_b   = streamBeforeTotal_b;
	for (var i=0;i<buckets.length;i++){
		var ls = buckets[i].key + postOffSt;
                var events = buckets[i].events.value;
                var bytes = buckets[i].bytes.value;
		var doc_count = buckets[i].doc_count;
		ret.events[ls] = events;
		//ret.bytes[ls] = bytes;
		ret.doc_counts[ls] = doc_count;
                if (doc_count>0) {
                  if (qparam_accum) {
                    ls_accum+=events;
                    ls_accum_b+=bytes;
                    retInput.events.push([ls,Math.round((ls_accum/(qparam_timePerLs))*100)/100]);
                    retInput.bytes.push([ls,Math.round((ls_accum_b/(qparam_timePerLs))*100)/100]);
                  } 
                  else {
                    retInput.events.push([ls,Math.round((events/(qparam_timePerLs*interval))*100)/100]);
                    retInput.bytes.push([ls,Math.round((bytes/(qparam_timePerLs*interval))*100)/100]);
                    if (events>0) retInput.bytesPerEvt.push([ls,Math.round(bytes/events)]);
                  }
                }
		ret.lsList.push(ls);
                tsList[ls] = buckets[i].time.value;
	}
	streamTotals = ret;
        retObj["input"]=retInput;

        q3(_this);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end q2

  //Navbar full range totals
  var q1 = function (_this){
    var x = (qparam_lastLs - parseInt(1))/parseInt(qparam_intervalNum);
    var navInterval = Math.round(x);
    if (navInterval == 0){navInterval = 1;}
 
    var nav_to = qparam_lastLs + navInterval -1 - (qparam_lastLs%navInterval);//sum up to the one-before-next element interval
 
    var queryJSON3 = _this.queryJSON3;
    queryJSON3.aggregations.ls.histogram.interval = parseInt(navInterval);
    queryJSON3.aggregations.ls.histogram.offset = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.min = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.max = nav_to;//qparam_lastLs;
    queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
    queryJSON3.query.filtered.query.range.ls.from = 1;
    queryJSON3.query.filtered.query.range.ls.to = nav_to;//qparam_lastLs;
    queryJSON3.aggregations.sumbefore.filter.range.ls.to = qparam_from_before;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON3)
    }).then (function(body){
      try {
        var results = body.hits.hits; //hits for query
	if (results.length>0){
                var eoltimes = new Date(results[0].fields.fm_date);
		lastTimes.push(eoltimes.getTime());
	}
	var ret = {
		"events" : [],
		"bytes" : [],
		"files" : []
	};
	took = body.took;
        maxls = body.aggregations.maxls.value;
        streamBeforeTotal = body.aggregations.sumbefore.events.value;
        streamBeforeTotal_b = body.aggregations.sumbefore.bytes.value;
	var buckets = body.aggregations.ls.buckets;

        var postOffset = Math.round(navInterval/2-1); //set to show median of the interval
	if (buckets.length) {
          if (postOffset>0) { //add 1 to navigator if needed
            var arr = [1,0];
            ret.events.push(arr);
            ret.bytes.push(arr);
            ret.files.push(arr);
          }
        }
        var lastBinMedian = 0;
	for (var i=0;i<buckets.length;i++){
		var ls = buckets[i].key;
		var events = buckets[i].events.value;
		//var bytes = buckets[i].bytes.value; 
		var files = buckets[i].files.value; 
                if (ls+postOffset>qparam_lastLs)
                  var add = qparam_lastLs;
                else
		  var add = ls + postOffset;
                lastBinMedian = add;
		var arr_e = [add,events];
		//var arr_b = [add,bytes];
		var arr_f = [add,files];
		ret.events.push(arr_e);
                //ret.bytes.push(arr_b);
                ret.files.push(arr_f);
	}

      //add max LS to navigator if not present
      if (lastBinMedian && lastBinMedian<qparam_lastLs) {
        var arr = [qparam_lastLs,0];
        ret.events.push(arr);
        ret.bytes.push(arr);
        ret.files.push(arr);
      }

      retObj.navbar = ret;
      //callback(q3); //q2(q3)
      q2(_this);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
      _this.excpEscES(res,error,requestKey);
      console.trace(error.message);
    });

  }//end q1

  var requestValue = global.f3MonCache.get(requestKey);
  var pending=false;

  if (requestValue=="requestPending") {
    //console.log('pending...')
    requestValue = global.f3MonCacheSec.get(requestKey);
    pending=true;
  }

  if (requestValue === undefined) {
    if (pending) {
      this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
      return;
    }
    global.f3MonCache.set(requestKey, "requestPending", ttl);
    q1(this);
  }else{
    this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
  }


}

