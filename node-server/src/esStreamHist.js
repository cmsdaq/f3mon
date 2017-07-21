'use strict';

var Common = require('./esCommon')
module.exports = new Common()

//var streamIncompleteCol = "purple";
var streamIncompleteCol = "pink";
//var streamIncompleteColStatus1 = "pink";
var streamIncompleteColMicro = "yellow";

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

  var streamListShouldQuery=[]
  var streamListShouldQueryNoErr=[]
  if (!qparam_allStreams) {
    streamListArray.forEach(function(item){
      streamListShouldQuery.push({"term":{"stream":item}})
      if (item!="Error")
        streamListShouldQueryNoErr.push({"term":{"stream":item}})
    });
  }

  var ttl = global.ttls.streamhist; //cached ES response ttl (in seconds)

  //helper variables with cb-wide scope
  var lastTimes = [];
  var tsList = {};
  var streamTotals;
  var streamBeforeTotal = 0;
  var streamBeforeTotal_b = 0;
  var took = 0;
  var streamNum=0;
  var streamNumWithDQM;
  var postOffSt;
  var maxls = 0;

  var retObj = {
	"streams" : "",
	"took" : "",
	"lsList" : "",
        "micromerge" : "",
        "minimerge" : "",
	"macromerge" : "",
	"transfer" : "",//
	"navbar" : "",
	"interval" : "",
	"lastTime" : ""
  };
  retObj.interval = interval;

  //Get transfer
  var q6 = function (_this){
        var queryJSON = _this.queryJSON4;
        //queryJSON4.query.bool.must=[{"term":{"runNumber":qparam_runNumber}},{"term":{"status":1}}]; //status 1: begin transfer, status 2: done transfer
        queryJSON.query.bool.must=[{"term":{"runNumber":qparam_runNumber}}]
        queryJSON.query.bool.must_not=[{"term":{"type":"EventDisplay"}},{"term":{"stream":"Error"}}]; //stream doc not filled yet

	//if not all streams are included, filter by explicit stream list
        if (!qparam_allStreams) {
          queryJSON.query.bool.should = streamListShouldQueryNoErr;
	  queryJSON.query.bool.minimum_should_match=1;
	}
	else {
	  delete queryJSON.query.bool.should;
	  delete queryJSON.query.bool.minimum_should_match;
	}

	//TODO: use colors
	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

        //console.log(JSON.stringify(queryJSON))
	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'transfer',
         body : JSON.stringify(queryJSON)
    	}).then (function(body){
          try {
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
                  lastTimes.push(results[0].sort[0]);
		}
		took += body.took;

		var transfer = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		
		var beforeLs = body.aggregations.sumbefore;

                var procNoDQMAccum = beforeLs.procNoDQM.processed.value
                var processedAccum = beforeLs.procAll.value
                var processedAccum2 = beforeLs.status2.procAll.value;
                //var processedAccumWithDQM_count = beforeLs.doc_count

                var totAcc = streamBeforeTotal;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

			var streamNum_noError = streamNum - streamErrorFound 
			var streamNumDQM_noError = streamNumWithDQM - streamErrorFound

                        var procNoDQM; //used when any of the non-DQM streams are selected in the legend (DQMHisgtograms is counted as non-DQM as it's merged 100%)
                        var processed; //used to show completion when only DQM streams are selected
			var processed2; //used to compare status 1 and 2, thus all DQM and non-DQM streams are counted in
                        var total;

                        if (qparam_accum) {//accumulation mode (handles all except document counts)
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = lsList[i].procAll.value + processedAccum;
                          processedAccum2 = processed2 = lsList[i].status2.procAll.value;
                          total = (streamTotals.events[ls] + totalsAccum)*(allDQM?streamNumDQM_noError:streamNum_noError);
                          totalsAccum += streamTotals.events[ls];
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = lsList[i].procAll.value;
                          processed2 = lsList[i].status2.procAll.value;
                          total = streamTotals.events[ls]*(allDQM?streamNumDQM_noError:streamNum_noError);
                        }

			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
			var dqmonly_count = lsList[i].procOnlyDQM.doc_count;

			var processedSel = allDQM ? processed:procNoDQM;

			//calc transfer percents and color
 			var percent,p;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
                                        percent = 0;
                                }else{
                                        percent = 100;
                                }
                        }else{
                                p = 100*processedSel/total;
                                if (p>=99.995 && p<100)
                                  percent = Math.round(p*1000)/1000;
                                else
                                  percent = Math.round(p*100)/100;
                        }
                        var color = percColor(percent);

                        if (allDQM && percent<100. && percent>50.) color = "olivedrab";

			//DQM incomplete coloring. relies on doc count from completed streams, so can't use it in allDQM mode
			//also not yet implemented in accumulation mode
			else if (!allDQM && !qparam_accum && total > 0 && percent>=100) {
			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  //only test this if some stream is completely written by all BUs and some other is not
			  if (maxBuckets.length && maxBuckets[0].doc_count) {
                            /*
			    var stream_max_docs = maxBuckets[0].doc_count;
			    //assumes streamError doc is not written. In case of the opposite, - streamErrorFound part should be removed
			    if (mdoc_count < stream_max_docs*Math.max(stream_labels.length - streamErrorFound, streamNumDQM_noError))
			      color=streamIncompleteCol;
                            */
			    //don't want error stream here, but it is not counted in DQM anyway
			    var max_docs = Math.max(streamNumWithDQM-streamNum,stream_labels_num-stream_labels_numNoDQM)*maxBuckets[0].doc_count;
			    if (max_docs>dqmonly_count)
			      //partial stream doc count with all BUs reporting some other stream complete
			      color=streamIncompleteCol;
			  }
			}

			//transfer status 1 and status 2 difference in event count (will be shown as olive) if otherwise OK
			if (color=="green" || color=="olivedrab") {
                          //if (processed2 < processed) color="olive";
                          if (processed2 < processed) color="#8A8A0A";
			}

                        var eolts = undefined;
                        if (tsList.hasOwnProperty(ls)) eolts=tsList[ls];

                        var entry = {
                        "x" : ls,
                        "y" : percent,
                        "eolts" : eolts,
                        "color" : color
                        };
                        transfer.percents.push(entry);
		}
		retObj.transfer = transfer;
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

  }//end q6


  //Get macromerge
  var q5 = function (_this){
        var queryJSON = _this.queryJSON1;
        queryJSON.query.bool.must=[{"term":{"runNumber":qparam_runNumber}}];

	//if not all streams are included, filter by explicit stream list
        if (!qparam_allStreams) {
          queryJSON.query.bool.should = streamListShouldQuery;
	  queryJSON.query.bool.minimum_should_match=1;
	}
	else {
	  delete queryJSON.query.bool.should;
	  delete queryJSON.query.bool.minimum_should_match;
	}

	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'macromerge',
         body : JSON.stringify(queryJSON)
    	}).then (function(body){
          try {
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
                  lastTimes.push(results[0].sort[0]);
		}
		took += body.took;

		var macromerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		
		var beforeLs = body.aggregations.sumbefore;

                var procNoDQMAccum = beforeLs.procNoDQM.processed.value
                var processedAccum = beforeLs.procAll.value;
                //var processedAccumWithDQM_count = beforeLs.doc_count

                var totalsAccum = streamBeforeTotal;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

                        var procNoDQM;
                        var processed;
                        var total;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = lsList[i].procAll.value + processedAccum;
                          total = (streamTotals.events[ls] + totalsAccum)*(allDQM?streamNumWithDQM:streamNum);
                          totalsAccum += streamTotals.events[ls];
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = lsList[i].procAll.value;
                          total = streamTotals.events[ls]*(allDQM?streamNumWithDQM:streamNum);
                        }

			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
			var dqmonly_count = lsList[i].procOnlyDQM.doc_count;

			//choose counter depending on mode (if DQM is ignored or not)
                        var processedSel = allDQM ? processed : procNoDQM;

			//calc macromerge percents
 			var percent,p;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
                                        percent = 0;
                                }else{
                                        percent = 100;
                                }
                        }else{
                                p = 100*processedSel/total;
                                if (p>=99.995 && p<100)
                                  percent = Math.round(p*1000)/1000;
                                else
                                  percent = Math.round(p*100)/100;
                        }
                        var color = percColor(percent);
                        if (allDQM && percent<100. && percent>50.) color = "olivedrab";

			//DQM incomplete coloring. relies on doc count from completed streams, so can't use it in allDQM mode
			//also not yet implemented in accumulation mode
			else if (!allDQM && !qparam_accum && total > 0 && percent>=100) {
			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  //only test this if some stream is completely written
			  if (maxBuckets.length && maxBuckets[0].doc_count) {
			    var max_docs = Math.max(streamNumWithDQM-streamNum,stream_labels_num-stream_labels_numNoDQM)*maxBuckets[0].doc_count;
			    if (max_docs>dqmonly_count)
			      //partial stream doc count with all BUs reporting some other stream complete
			      color=streamIncompleteCol;
			  }
			}

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
                //_this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
		q6(_this);
          } catch (e) {_this.exCb(res,e,requestKey)}
	}, function (error){
		_this.excpEscES(res,error,requestKey);
        	console.trace(error.message);
  	 });

  }//end q5


  //Get minimerge
  var q4 = function (_this){

        var queryJSON = _this.queryJSON1;
        queryJSON.query.bool.must=[{"term":{"runNumber":qparam_runNumber}}];

	//if not all streams are included, filter by explicit stream list
        if (!qparam_allStreams) {
          queryJSON.query.bool.should = streamListShouldQuery;
	  queryJSON.query.bool.minimum_should_match=1;
	}
	else {
	  delete queryJSON.query.bool.should;
	  delete queryJSON.query.bool.minimum_should_match;
	}

	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

	//console.log(JSON.stringify(queryJSON,null,2))
	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'minimerge',
         body : JSON.stringify(queryJSON)
    	}).then (function(body){
          try {
        	var results = body.hits.hits; //hits for query
		if (results.length>0){
		  lastTimes.push(results[0].sort[0]);
		}
		took += body.took;

		var minimerge = {
			"percents" : [],
			"took" : body.took
		};
		
		var lsList = body.aggregations.inrange.ls.buckets;
		var beforeLs = body.aggregations.sumbefore;

                //for keeping sum of events over LS bins
                var procNoDQMAccum = beforeLs.procNoDQM.processed.value
                var processedAccum = beforeLs.procAll.value
                var totalsAccum = streamBeforeTotal;

		//show fake 100% micro value if mini is already 100%
                var fakeMicro = false
                if (retObj.micromerge.percents.length==lsList.length) fakeMicro=true;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;
                        //procNoDQM - always use count without DQM
			//processed - if all streams are DQM, use count with DQM
			//NB: mini, macro and transfer documents actually sum what is processed+errorEvents in stream-hist, into processed field
			//errorEvents field instead contains the exit code mask from JSON file
                        var procNoDQM;
                        var processed;
                        var total;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = lsList[i].procAll.value + processedAccum;
                          total = (streamTotals.events[ls] + totalsAccum)*(allDQM?streamNumWithDQM:streamNum);
                          totalsAccum += streamTotals.events[ls];
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = lsList[i].procAll.value
                          total = streamTotals.events[ls]*(allDQM?streamNumWithDQM:streamNum);
                        }

			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
			var dqmonly_count = lsList[i].procOnlyDQM.doc_count;

			//choose counter depending on mode (if DQM is ignored or not)
                        var processedSel = allDQM ? processed : procNoDQM;

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

			//DQM incomplete coloring. relies on doc count from completed streams, so can't use it in allDQM mode
			//also not yet implemented in accumulation mode
			//TODO:implement for cumulative mode (need to add maxDocCount to "before" bin aggregation)
			else if (!allDQM && !qparam_accum && doc_count && total > 0 && percent>=100) {

			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  //only test this if some stream is completely written by all BUs and some other is not
			  if (maxBuckets.length && maxBuckets[0].doc_count==doc_count) {
			    var max_docs = Math.max(streamNumWithDQM-streamNum,stream_labels_num-stream_labels_numNoDQM)*maxBuckets[0].doc_count;
			    if (max_docs>dqmonly_count)
			      //partial stream doc count with all BUs reporting some other stream complete
			      color=streamIncompleteCol;
			  }

			}

                        var entry = {
                        "x" : ls,
                        "y" : percent,
                        "color" : color
                        };
                        minimerge.percents.push(entry);
                        if (fakeMicro) {
                          var tobj = retObj.micromerge.percents[i];
                          if ((tobj.color!=streamIncompleteColMicro || percent==100) && tobj.y<percent) {
                            tobj.y=percent;
			    if (tobj.color==streamIncompleteCol && color==streamIncompleteCol) {}//avoid recalc for this color code
                            else tobj.color=percColor2(percent,tobj.err);
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

    var queryJSON = _this.queryJSON2;
	//queryJSON2.query.filtered.filter.and.filters[0].prefix._id = qparam_runNumber;
	//queryJSON2.query.prefix._id = qparam_runNumber;
	queryJSON.query.bool.must[0].parent_id.id = parseInt(qparam_runNumber);

	//if not all streams are included, filter by explicit stream list
        if (!qparam_allStreams) {
          queryJSON.query.bool.should = streamListShouldQuery;
	  queryJSON.query.bool.minimum_should_match=1;
	}
	else {
	  delete queryJSON.query.bool.should;
	  delete queryJSON.query.bool.minimum_should_match;
	}

	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 

	queryJSON.aggs.stream.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.stream.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON.aggs.stream.aggs.sumbefore.filter.range.ls.to = qparam_from_before;

        if (qparam_accum) {
          queryJSON.aggs.stream.aggs.inrange.aggs.ls.aggs.out = {"sum": { "field": "out"}}
          queryJSON.aggs.stream.aggs.inrange.aggs.ls.aggs.filesize = {"sum": { "field": "filesize"}}
        }
        else {
          queryJSON.aggs.stream.aggs.inrange.aggs.ls.aggs.out = {"avg": { "field": "out"}}
          queryJSON.aggs.stream.aggs.inrange.aggs.ls.aggs.filesize = {"avg": { "field": "filesize"}}
       }

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'stream-hist',
      body : JSON.stringify(queryJSON)
    }).then (function(body){
      try {
      var results = body.hits.hits; //hits for query
      if (results.length>0){
                //is unix timestamp
		//lastTimes.push(results[0].fields.date);
		//lastTimes.push(results[0]._source.date);
		lastTimes.push(results[0].sort[0]);
      }
      took += body.took;
	
      var streams = body.aggregations.stream.buckets;
	
      var streamData = {
		"streamList" : [],
		"data" : []
      };

      var totSumIn={};
      //var totDocCountIn={};
      var totSumError={};
      //todo: query stream_label to know exact number of streams (not only found in this LS range)
      var nStreamsMicro=0;
      var lsPartialCompleteMap = {};

      //first pass: calculate stream rates. For micro completion, go over all streams and sum in per-LS counters.
      for (var i=0;i<streams.length;i++){
                //also filter out based on stream list from labels
		if (!qparam_allStreams && (streams[i].key == '' || streamListArray.indexOf(streams[i].key) == -1)){
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
                          //totDocCountIn[ls]=0;
                          totSumError[ls] = 0;
                        }
			var sumProcessed=0, sumError = 0;
		
                        if (qparam_accum) {

                          //for total %
                          totSumIn[ls] += sumProcessed = lsList[j].in.value + totStreamIn;
                          //totDocCountIn[ls] += lsList[j].doc_count + totStreamDocCountIn;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += sumError = lsList[j].error.value + totStreamErr;
                          //else
                          //  totSumError[ls] += totStreamErr;

			  totStreamIn = totStreamIn + lsList[j].in.value; 
			  //totStreamDocCountIn = totStreamDocCoountIn + lsList[j].doc_count;
			  totStreamOut = totStreamOut + lsList[j].out.value; 
			  totStreamfsOut = totStreamfsOut + lsList[j].filesize.value;
                        }
                        else {

                          //for total %
                          totSumIn[ls] += sumProcessed = lsList[j].in.value;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += sumError = lsList[j].error.value;

			  totStreamIn = lsList[j].in.value; 
			  //totStreamDocCountIn = lsList[j].doc_count;
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
			if (total) {
			  //mark if any stream is complete
			  var pserr = 100*(sumProcessed+sumError)/total;
			  if (pserr>99.995)
                            lsPartialCompleteMap[ls]=true;
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
		
        //second pass: calculate completion from per-LS counters 
	for (var i=0;i<lsList.length;i++){
		var ls = lsList[i];
		var processed = totSumIn[ls];
		//var processed_docs = totDocCountIn[ls];
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

                //override yellow if partially complete streams
		if (total>0 && percent>50. && percent<100 &&  lsPartialCompleteMap.hasOwnProperty(ls))
		  color=streamIncompleteColMicro;
		var entry = {
			"x" : ls,
			"y" : percent,
			"color" : color,
                        "err":err>0
		};
                if (nStreamsMicro>0) //streams must be present
		  micromerge.percents.push(entry);
        }

	retObj.streams = streamData;
	retObj.micromerge = micromerge;
	retObj.lsList = streamTotals.lsList;
	
	//Construct stream list from stream-hist docs (used if stream_label is not yet complete). DQM is not present.
	streamNumWithDQM = streamListArray.length;
	for (var k=0;k<streamListArray.length;k++){
		var s = streamListArray[k];
		if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM) {
		        streamNum++;
		}
	}
	
	q4(_this); //q4(q5)
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end q3

  //get stream_label list
  var stream_labels = [];
  var stream_labels_num=0;
  var stream_labels_numNoDQM=0;
  //var stream_labels_DQMonly=[];
  var streamErrorFound = false;

  var qstreams = function (_this){
    var queryJSON = {
      "size":1,
      "query":{
        "bool":{
	  "must":
            [{"parent_id":{"id":qparam_runNumber,"type":"stream_label"}}]
	  
	}
      },
      "aggs":{"streams":{"terms":{"field":"stream","size":200,"min_doc_count":1}}}
    }

    //if not all streams are included, filter by explicit stream list
    if (!qparam_allStreams) {
      queryJSON.query.bool.should = streamListShouldQuery;
      queryJSON.query.bool.minimum_should_match=1;
    }

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'stream_label',
      body : JSON.stringify(queryJSON)
    }).then (function(body){
      try {
        var results = body.aggregations.streams.buckets; //hits for query
	for (var i=0;i<results.length;i++) {
	  var s = results[i].key;
	  stream_labels.push(s);
	  if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM)
	    stream_labels_numNoDQM++;
	  if (s=="Error") streamErrorFound=true;

	  //if (results[i].key.startsWith("DQM") && !results[i].key.startsWith("DQMHistograms"))
	  //  stream_labels_DQMonly.push(results[i].key);
	}
	stream_labels_num=stream_labels.length;
        q3(_this);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end qstreams

  //Get totals
  var q2 = function (_this){

    var queryJSON = _this.queryJSON3;
    queryJSON.aggregations.ls.histogram.interval = interval;
    queryJSON.aggregations.ls.histogram.offset = 1;
    queryJSON.aggregations.ls.histogram.extended_bounds.min = qparam_from
    queryJSON.aggregations.ls.histogram.extended_bounds.max = qparam_to;
    queryJSON.aggregations.ls.histogram.offset = aggOffset; 
    queryJSON.query.bool.must[1].parent_id.id = qparam_runNumber;
    queryJSON.query.bool.must[0].range.ls.from = qparam_from;
    queryJSON.query.bool.must[0].range.ls.to = qparam_to;
    queryJSON.aggregations.sumbefore.filter.range.ls.to = 0;//not used, taken from previous agg

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON)
    }).then (function(body){
      try {
        var results = body.hits.hits; //hits for query
	if (results.length>0){
                //var eoltimes = new Date(results[0].fields.fm_date);
                //TODO: test sorted time vs timestamp option
                //var eoltimes = new Date(results[0]._source.fm_date);
        	//lastTimes.push(eoltimes.getTime());
                var eoltimes = new Date(results[0].sort[0]);
        	lastTimes.push(eoltimes);
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
		"doc_counts" : {}
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

        qstreams(_this);
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
 
    var queryJSON = _this.queryJSON3;
    queryJSON.aggregations.ls.histogram.interval = parseInt(navInterval);
    queryJSON.aggregations.ls.histogram.offset = 1;
    queryJSON.aggregations.ls.histogram.extended_bounds.min = 1;
    queryJSON.aggregations.ls.histogram.extended_bounds.max = nav_to;//qparam_lastLs;
    queryJSON.query.bool.must[1].parent_id.id = qparam_runNumber;
    queryJSON.query.bool.must[0].range.ls.from = 1;
    queryJSON.query.bool.must[0].range.ls.to = nav_to;
    queryJSON.aggregations.sumbefore.filter.range.ls.to = qparam_from_before;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON)
    }).then (function(body){
      try {
        var results = body.hits.hits; //hits for query
	if (results.length>0){
                //var eoltimes = new Date(results[0].fields.fm_date);
                var eoltimes = new Date(results[0]._source.fm_date);
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

  if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
    q1(this);
  }


}

