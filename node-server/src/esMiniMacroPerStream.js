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


module.exports.query = function (req, res) {

  var took = 0;
  var qname = 'minimacroperstream';
  var _this = this

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

  //Get minimerge
  var q2 = function(total_q1){

    var queryJSON;
    if (qparam_type==='micromerge') {
      qparam_type='stream-hist';
      queryJSON = _this.queryJSON1;
      queryJSON.query.bool.must[1].prefix._id = qparam_runNumber;
    }
    else {
      queryJSON = _this.queryJSON2;
      queryJSON.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
    }

    queryJSON.query.bool.must[0].range.ls.from = qparam_from;
    queryJSON.query.bool.must[0].range.ls.to = qparam_to;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: qparam_type,
      body : JSON.stringify(queryJSON)
      }).then (function(body){
        try {
          took+=body.took
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
		
		var b = true;
		if (qparam_type === 'micromerge'){
			b = false;
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
    });
  };//end q2

  //Get total
  var q1 = function(){
    streamListArray = qparam_streamList.split(',');

    _this.queryJSON3.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
    _this.queryJSON3.query.filtered.query.range.ls.from = qparam_from;
    _this.queryJSON3.query.filtered.query.range.ls.to = qparam_to;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(_this.queryJSON3)
    }).then (function(body) {
      took+=body.took
      try {
        // var results = body.hits.hits; //hits for query
        var total = body.aggregations.events.value;
	var doc_count = body.hits.total;
        q2(total);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
      _this.excpEscES(res,error,requestKey);
      console.trace(error.message);
    });
  };//end q1macro

  var requestValue = global.f3MonCache.get(requestKey);
  var pending=false
  if (requestValue=="requestPending") {
    pending=true
    requestValue = global.f3MonCacheSec.get(requestKey);
  }
  if (requestValue === undefined) {
    if (pending) {
      this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
      return;
    }
    global.f3MonCache.set(requestKey, "requestPending", ttl);
    q1(); //call q1 with q2 as its callback
  }
  else
    this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
}

