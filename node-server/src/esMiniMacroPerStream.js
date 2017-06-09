'use strict';

var Common = require('./esCommon');
module.exports = new Common()

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
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

var isDQM = function(s_name) {
		if (!s_name.startsWith('DQM') || s_name=="DQMHistograms") return false;
		else return true;
}

module.exports.query = function (req, res) {

  var took = 0;
  var qname = 'minimacroperstream';
  var _this = this

  //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperstream request');
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

  if (qparam_type=='transfer') {
    var new_list = [];
    qparam_streamList.split(',').forEach(function(item) {
      if (item=="Error") return;
      new_list.push(item)
    });
    qparam_streamList = new_list.join(',')
  }

  var requestKey = 'minimacroperstream?='+qparam_runNumber+'&='+qparam_from+'&='+qparam_to+'&='+qparam_sysName+'&='+qparam_streamList+'&='+qparam_type;
  var ttl = global.ttls.minimacroperstream; //cached ES response ttl (in seconds)

  var streamListArray;
  var inner = [];
  var retObj = {
	"percents" : inner
  };

  //drilldown status
  var enable_drill = true;
  if (qparam_type === 'micromerge'){
    enable_drill = false;
  }

  //Get micromerge
  var q2micro = function(total_q1){

    var queryJSON;
    queryJSON = _this.queryJSON1;
    queryJSON.query.bool.must[0].parent_id = {"type":"stream-hist","id":qparam_runNumber};
    queryJSON.query.bool.must[1].range.ls={"from" : qparam_from,"to":qparam_to};


    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'stream-hist',
      body : JSON.stringify(queryJSON)
      }).then (function(body){
        try {
          took+=body.took
	  var max_non_DQM_doc_count=0;
          //var results = body.hits.hits; //hits for query
          var streams = body.aggregations.stream.buckets;
          var streamNames = [];
          for (var is=0;is<streams.length;is++) {
            streamNames.push(streams[is].key);
	  }
          for (var j=0;j<streamListArray.length;j++){
		var stream = streamListArray[j];
                if (stream == '') continue
                var processed=0;
                var errorEvents=0;
                var doc_count=0;
                var i = streamNames.indexOf(stream);
		if (i !== -1) {
		        processed = streams[i].processed.value;
		        errorEvents = streams[i].errorEvents.value;
		        doc_count = streams[i].doc_count;
                }
		//calc minimerge percents
		var percent,percent2;
		if (total_q1 == 0){
			if (doc_count == 0){
				percent = percent2 = 0;
			}else{
				percent = percent2 = 100;
			}
		}else{
			var p = 100*processed/total_q1;
			percent = Math.round(p*100)/100;
			var p2 = 100*(processed+errorEvents)/total_q1;
			percent2 = Math.round(p2*100)/100;
		}
		var color = percColor2(percent2,errorEvents);
		
		var entry = {
			"name" : stream,
			"y" : percent,
			"color" : color,
			"drilldown" : enable_drill
		};
		retObj.percents.push(entry);
	  }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
	console.log(JSON.stringify(queryJSON));
    });
  };//end q2micro

  //Get mini/macro merge
  var q2minimacro = function(total_q1){

    var queryJSON;
    queryJSON = _this.queryJSON2;
    queryJSON.query.bool.must[0].term.runNumber = qparam_runNumber;
    queryJSON.query.bool.must[1].range.ls={"from" : qparam_from,"to":qparam_to};

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: qparam_type,
      body : JSON.stringify(queryJSON)
      }).then (function(body){
        try {
          took+=body.took
	  var max_non_DQM_doc_count=0;
          //var results = body.hits.hits; //hits for query
          var streams = body.aggregations.stream.buckets;
          var streamNames = [];
          for (var is=0;is<streams.length;is++) {
	    var s_name =  streams[is].key
            streamNames.push(streams[is].key);
	    doc_count = streams[is].doc_count;
	    if (doc_count>max_non_DQM_doc_count) {
	      var proc = streams[is].processed.value//+streams[is].errorEvents.value;
	      if (!isDQM(s_name) && proc==total_q1) max_non_DQM_doc_count=doc_count;
	    }
	  }
          for (var j=0;j<streamListArray.length;j++){
		var stream = streamListArray[j];
                if (stream == '') continue
                var processed=0
		var errorEvents=0;
                var doc_count=0;
                var i = streamNames.indexOf(stream);
		if (i !== -1) {
		        processed = streams[i].processed.value;
		        //errorEvents = streams[i].errorEvents.value;
		        doc_count = streams[i].doc_count;
                }
		if (doc_count>max_non_DQM_doc_count)
		//calc minimerge percents
		var percent,percent2
		if (total_q1 == 0){
			if (doc_count == 0){
				percent = percent2 = 0;
			}else{
				percent = percent2 = 100;
			}
		}else{
			var p = 100*processed/total_q1;
			percent = Math.round(p*100)/100;
			//for color
			//var p2 = 100*(processed+errorEvents)/total_q1;
			//percent2 = Math.round(p2*100)/100;
		}
	
	        //processed for mini and macromerge contains error events. i.e. number information is not available
		//var color = percColor2(percent2,errorEvents>0);
		var color = percColor(percent);

                //for DQM, detect if fully merged based on document count
		if (percent<100 && percent>0 && isDQM(stream)) {
                  if (doc_count && doc_count==max_non_DQM_doc_count) {
		     //set olivedrab if this is complete even with partial threshold (based on doc_count)
		     color="olivedrab";
		  }
		}
		
		var entry = {
			"name" : stream,
			"y" : percent,
			"color" : color,
			"drilldown" : enable_drill
		};
		retObj.percents.push(entry);
	  }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
	console.log(JSON.stringify(queryJSON));
    });
  };//end q2minimacro

  var q2transfer = function(total_q1){

    var queryJSON;
    queryJSON = _this.queryJSON3;
    queryJSON.query.bool.must[0].term.runNumber = qparam_runNumber;
    queryJSON.query.bool.must[1].range.ls={"from" : qparam_from,"to":qparam_to};
    //queryJSON.query.bool.must.push({"term" : {"status":2}});

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: qparam_type,
      body : JSON.stringify(queryJSON)
      }).then (function(body){
        try {
          took+=body.took
	  var max_non_DQM_doc_count=0;
          //var results = body.hits.hits; //hits for query
          var streams = body.aggregations.stream.buckets;
          var streamNames = [];
          for (var is=0;is<streams.length;is++) {
	    var s_name =  streams[is].key
            streamNames.push(streams[is].key);
	    doc_count = streams[is].doc_count;
	    //detect a fully merged stream, no exceptions
	    if (doc_count>max_non_DQM_doc_count) {
	      var proc = streams[is].processed.value//+streams[is].errorEvents.value;
	      if (!isDQM(s_name) && proc==total_q1) max_non_DQM_doc_count=doc_count;
	    }
	  }
          for (var j=0;j<streamListArray.length;j++){
		var stream = streamListArray[j];
                if (stream == '') continue
                var processed=0,processed2=0;
		//var errorEvents=0,errorEvents2=0;
                var doc_count=0;
                var i = streamNames.indexOf(stream);
		if (i !== -1) {
		        processed = streams[i].processed.value;
		        //errorEvents = streams[i].errorEvents.value;
			processed2 = streams[i].status2.processed.value;
		        //errorEvents2 = streams[i].status2.errorEvents.value;
		        doc_count = streams[i].doc_count;
                }

		var percent,percent2
		if (total_q1 == 0){
			if (doc_count == 0){
				percent = percent2 = 0;
			}else{
				percent = percent2 = 100;
			}
		}else{
			var p = 100*processed/total_q1;
			percent = Math.round(p*100)/100;
			//for color
			//var p2 = 100*(processed+errorEvents)/total_q1;
			//percent2 = Math.round(p2*100)/100;
		}
	
	        //will set as olive if there are error events
		//var color = percColor2(percent2,errorEvents>0);
		var color = percColor(percent);

                //for DQM, detect if fully merged based on document count
		if (percent<100 && percent>0 && isDQM(stream)) {
                  if (doc_count && doc_count==max_non_DQM_doc_count) {
		     //set olivedrab if this is complete even with partial threshold (based on doc_count)
		     color="olivedrab";
		  }
		}

                //special transfer color
		if (color=="green" || color=="olivedrab") {
		        if (processed2 < processed) color="olive";
		        //if (processed2+errorEvents2 < processed+errorEvents) color="olive";
		}
		
		var entry = {
			"name" : stream,
			"y" : percent,
			"color" : color,
			"drilldown" : enable_drill
		};
		retObj.percents.push(entry);
	  }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
	console.log(JSON.stringify(queryJSON));
    });
  };//end q2transfer


  //Get total
  var q1 = function(){
    streamListArray = qparam_streamList.split(',');

    _this.queryJSON4.query.bool.must[1].parent_id.id = qparam_runNumber;
    _this.queryJSON4.query.bool.must[0].range.ls.from = qparam_from;
    _this.queryJSON4.query.bool.must[0].range.ls.to = qparam_to;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(_this.queryJSON4)
    }).then (function(body) {
      took+=body.took
      try {
        // var results = body.hits.hits; //hits for query
        var total = body.aggregations.events.value;
	var doc_count = body.hits.total;
        if (qparam_type==='micromerge')
          q2micro(total);
        else if (qparam_type==='transfer')
          q2transfer(total);
	else
          q2minimacro(total);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
      _this.excpEscES(res,error,requestKey);
      console.trace(error.message);
    });
  };//end q1macro

  if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
    q1(); //call q1 with q2 as its callback
  }
}

