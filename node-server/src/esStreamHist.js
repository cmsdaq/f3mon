'use strict';

var Common = require('./esCommon')
module.exports = new Common()

var streamIncompleteCol = "purple";
var streamIncompleteCol = "pink";

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

  var new_color_coding = true;

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
        var queryJSON1 = _this.queryJSON1;
        queryJSON1.query.bool.must=[{"term":{"runNumber":qparam_runNumber}},{"term":{"status":2}}]; //status 1: begin transfer, status 2: done transfer
	//TODO: use colors
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON1.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON1.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON1.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON1.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'transfer',
         body : JSON.stringify(queryJSON1)
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
                var processedAccum = allDQM ? beforeLs.procAll.value : beforeLs.procNoDQM.processed.value
                //var processedAccumWithDQM_count = beforeLs.doc_count

                var totAcc = 0;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;


                        var procNoDQM;
                        var processed;
                        var processedWithDQM_count;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = (allDQM ? lsList[i].procAll.value : lsList[i].procNoDQM.processed.value) + processedAccum;
                          //processedAccumWithDQM_count = processedWithDQM_count = lsList[i].doc_count + processedAccumWithDQM_count;
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = allDQM ? lsList[i].procAll.value : lsList[i].procNoDQM.processed.value
                          processedWithDQM_count = lsList[i].doc_count
                        }
			var streamNum_noError = streamNum - streamErrorFound 

                        var total;
                        if (qparam_accum)
                          total = (streamTotals.events[ls] + totAcc + streamBeforeTotal)*(streamNum_noError);
                        else 
                          total = streamTotals.events[ls]*(streamNum_noError);
                        totAcc += streamTotals.events[ls];

			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;
                        var processedSel;
                        var processedSel;
                        if (allDQM) processedSel = processed;
                        else processedSel = procNoDQM;

			//calc transfer percents
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

			else if (new_color_coding && total > 0 && doc_count && !qparam_accum && !allDQM) {
			  //bucket doc_count for stream with max documents
			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  if (maxBuckets.length) {
			    var stream_max_docs = maxBuckets[0].doc_count;
			    //assumes streamError doc is not written. In case of the opposite, - streamErrorFound part should be removed
			    if (streamNumWithDQM < stream_max_docs*Math.max(stream_labels.length - streamErrorFound, streamNum_noError))
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
        var queryJSON1 = _this.queryJSON1;
        queryJSON1.query.bool.must=[{"term":{"runNumber":qparam_runNumber}}];
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON1.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON1.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON1.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON1.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'macromerge',
         body : JSON.stringify(queryJSON1)
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
                var processedAccum = allDQM ? beforeLs.procAll.value : beforeLs.procNoDQM.processed.value
                //var processedAccumWithDQM_count = beforeLs.doc_count

                var totAcc = 0;

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

                        var procNoDQM;
                        var processed;
                        var processedWithDQM_count;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = (allDQM ? lsList[i].procAll.value : lsList[i].procNoDQM.processed.value) + processedAccum;
                          //processedAccumWithDQM_count = processedWithDQM_count = lsList[i].doc_count + processedAccumWithDQM_count;
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = allDQM ? lsList[i].procAll.value : lsList[i].procNoDQM.processed.value
                          processedWithDQM_count = lsList[i].doc_count
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

			else if (new_color_coding && total > 0 && doc_count && !qparam_accum && !allDQM) {
			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  if (maxBuckets.length) {
			    var stream_max_docs = maxBuckets[0].doc_count;
			    if (streamNumWithDQM < stream_max_docs*Math.max(stream_labels.length,streamNum))
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

        var queryJSON1 = _this.queryJSON1;
        queryJSON1.query.bool.must=[{"term":{"runNumber":qparam_runNumber}}];
	queryJSON1.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON1.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON1.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON1.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON1.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 
	queryJSON1.aggs.sumbefore.filter.range.ls.to = qparam_from_before;
	queryJSON1.aggs.inrange.aggs.ls.aggs.streamMaxDocCount.terms.size=8 //important: small term size returns inaccurate results. if this is a problem, increase this value.
	queryJSON1.aggs.sumbefore.aggs.streamMaxDocCount.terms.size=1 //currently not used

	//console.log(JSON.stringify(queryJSON1,null,2))
	global.client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'minimerge',
         body : JSON.stringify(queryJSON1)
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

                var procNoDQMAccum = beforeLs.procNoDQM.processed.value
                var processedAccum = allDQM ? beforeLs.procAll.value:beforeLs.procNoDQM.processed.value

                var totAcc = 0;

                var lsBUCount = {}

		//show fake 100% micro value if mini is already 100%
                var fakeMicro = false
                if (retObj.micromerge.percents.length==lsList.length) fakeMicro=true;
                //else console.log(fakeMicro)

		for (var i=0;i<lsList.length;i++){
			var ls = lsList[i].key+postOffSt;
                        if (qparam_accum && ls>maxls) continue;

                        var procNoDQM;
                        var processed;
                        if (qparam_accum) {
                          procNoDQMAccum = procNoDQM = lsList[i].procNoDQM.processed.value + procNoDQMAccum;
                          processedAccum = processed = (allDQM ? lsList[i].procAll.value:lsList[i].procNoDQM.processed.value) + processedAccum;
                        } else {
                          procNoDQM = lsList[i].procNoDQM.processed.value;
                          processed = allDQM ? lsList[i].procAll.value:lsList[i].procNoDQM.processed.value;
                        }
			//console.log('ls ' + JSON.stringify(lsList[i]))

                        var total;
                        if (qparam_accum)
                          total = (streamTotals.events[ls] + totAcc + streamBeforeTotal)*streamNum;
                        else 
                          total = streamTotals.events[ls]*streamNum;
                        totAcc += streamTotals.events[ls];

			var doc_count = streamTotals.doc_counts[ls];
			//console.log(doc_count)
			var mdoc_count = lsList[i].doc_count;
                        var processedSel;
                        if (allDQM) processedSel = processed;
                        else processedSel = procNoDQM;

                        var streams_only_partial = false;
			//if (ls==150) console.log(JSON.stringify(lsList[i],null,2));
			//if (ls==150) console.log('mdoc:'+doc_count + ' labels:' + stream_labels.length + ' streamNum:' + streamNumWithDQM)
			if (!qparam_accum) {//accum supported at this time
			  var maxBuckets = lsList[i].streamMaxDocCount.buckets;
			  //only test this if some stream is completely written by all BUs
			  if (maxBuckets.length && maxBuckets[0].doc_count==doc_count) {
			    var max_docs = doc_count*Math.max(streamNumWithDQM,stream_labels.length);
			    if (max_docs>lsList[i].doc_count)
			      streams_only_partial = true;
			  }
			}

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
			//partial stream doc count with all BUs reporting
			if (new_color_coding && total>0 && percent>0. && streams_only_partial) color=streamIncompleteCol;

                        var entry = {
                        "x" : ls,
                        "y" : percent,
                        "color" : color
                        };
                        minimerge.percents.push(entry);
                        //if (fakeMicro && false /* HACK */) {
                        if (fakeMicro) {
                          var tobj = retObj.micromerge.percents[i];
                          if (tobj.y<percent) {
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

    var queryJSON2 = _this.queryJSON2;
	//queryJSON2.query.filtered.filter.and.filters[0].prefix._id = qparam_runNumber;
	//queryJSON2.query.prefix._id = qparam_runNumber;
	queryJSON2.query.parent_id.id = parseInt(qparam_runNumber);

	queryJSON2.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON2.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON2.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON2.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON2.aggs.inrange.aggs.ls.histogram.interval = interval;
	queryJSON2.aggs.inrange.aggs.ls.histogram.offset = aggOffset; 

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
                          //totDocCountIn[ls]=0;
                          totSumError[ls] = 0;
                        }
		
                        if (qparam_accum) {

                          //for total %
                          totSumIn[ls] += lsList[j].in.value + totStreamIn;
                          //totDocCountIn[ls] += lsList[j].doc_count + totStreamDocCountIn;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += lsList[j].error.value + totStreamErr;
                          //else
                          //  totSumError[ls] += totStreamErr;

			  totStreamIn = totStreamIn + lsList[j].in.value; 
			  //totStreamDocCountIn = totStreamDocCoountIn + lsList[j].doc_count;
			  totStreamOut = totStreamOut + lsList[j].out.value; 
			  totStreamfsOut = totStreamfsOut + lsList[j].filesize.value;
                        }
                        else {

                          //for total %
                          totSumIn[ls] += lsList[j].in.value;
                          if (lsList[j].error!=undefined)
                            totSumError[ls] += lsList[j].error.value;

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

                var streams_only_partial = false;
		if (!qparam_accum) {//accum supported at this time
                    var lsList_all = body.aggregations.inrange.ls.buckets;
		    var maxBuckets = lsList_all[i].streamMaxDocCount.buckets;
                    //only test this if some stream is completely written by all BUs
		    if (maxBuckets.length) {
		      var max_docs=maxBuckets[0].doc_count*Math.max(streams.length,stream_labels.length);
		      if (max_docs>lsList_all[i].doc_count)
		        streams_only_partial = true;
		    }
		}
	
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
		//console.log('ls:'+ls+' ' +streamTotals.doc_counts[ls] + ' ' + lsDocCount[ls] + ' ' +Math.max(stream_labels.length,nStreamsMicro))
		if (new_color_coding && total>0 && percent>0. && streams_only_partial) color=streamIncompleteCol;

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
	
	//Filter DQM from streamlist
	var mmStreamList = [];
	for (var k=0;k<streamListArray.length;k++){
		var s = streamListArray[k];
		if (!(s.substr(0,3)==='DQM') || (s==='DQMHistograms') || allDQM) {
			mmStreamList.push(streamListArray[k]);
		}
	}
	streamNum = mmStreamList.length; // TODO: use Math.max( stream_label.length,mmStreamList.length)
	streamNumWithDQM = streamListArray.length;
	
	q4(_this); //q4(q5)
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end q3

  //get stream_label list
  var stream_labels = [];
  var streamErrorFound = false;

  var qstreams = function (_this){
    var queryJSON = {
      "size":1,
      "query":{"parent_id":{"id":qparam_runNumber,"type":"stream_label"}},"aggs":{"streams":{"terms":{"field":"stream","size":200,"min_doc_count":1}}}
    }

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'stream_label',
      body : JSON.stringify(queryJSON)
    }).then (function(body){
      try {
        var results = body.aggregations.streams.buckets; //hits for query
	for (var i=0;i<results.length;i++) {
	  stream_labels.push(results[i].key);
	  if (results[i].key=="Error") streamErrorFound=true;
	}
        q3(_this);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  }//end qstreams

  //Get totals
  var q2 = function (_this){

    var queryJSON3 = _this.queryJSON3;
    queryJSON3.aggregations.ls.histogram.interval = interval;
    queryJSON3.aggregations.ls.histogram.offset = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.min = qparam_from
    queryJSON3.aggregations.ls.histogram.extended_bounds.max = qparam_to;
    queryJSON3.aggregations.ls.histogram.offset = aggOffset; 
    queryJSON3.query.bool.must[1].parent_id.id = qparam_runNumber;
    queryJSON3.query.bool.must[0].range.ls.from = qparam_from;
    queryJSON3.query.bool.must[0].range.ls.to = qparam_to;
    queryJSON3.aggregations.sumbefore.filter.range.ls.to = 0;//not used, taken from previous agg

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON3)
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
 
    var queryJSON3 = _this.queryJSON3;
    queryJSON3.aggregations.ls.histogram.interval = parseInt(navInterval);
    queryJSON3.aggregations.ls.histogram.offset = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.min = 1;
    queryJSON3.aggregations.ls.histogram.extended_bounds.max = nav_to;//qparam_lastLs;
    queryJSON3.query.bool.must[1].parent_id.id = qparam_runNumber;
    queryJSON3.query.bool.must[0].range.ls.from = 1;
    queryJSON3.query.bool.must[0].range.ls.to = nav_to;
    queryJSON3.aggregations.sumbefore.filter.range.ls.to = qparam_from_before;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON3)
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

