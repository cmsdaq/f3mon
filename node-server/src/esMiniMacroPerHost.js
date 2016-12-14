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
  var qname = 'minimacroperhost';
  var _this = this

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

  var requestKey = 'minimacroperhost?='+qparam_runNumber+'&='+qparam_from+'&='+qparam_to+'&='+qparam_sysName+'&='+stream_id+'&='+qparam_type;
  var ttl = global.ttls.minimacroperbu; //cached ES response ttl (in seconds)

  var inner = [];
  var retObj = {
	"percents" : inner
  };

  var totals = {}; //obj to hold per bu event counters

  //Get minimerge
  var q2 = function(callback){

   _this.queryJSON1.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
   _this.queryJSON1.query.bool.must[0].range.ls.from = qparam_from;
   _this.queryJSON1.query.bool.must[0].range.ls.to = qparam_to;
   _this.queryJSON1.query.bool.must[2].term.stream.value = qparam_stream;
   _this.queryJSON1.query.bool.must[2].term.stream.value = qparam_stream;

   global.client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'minimerge',
    body : JSON.stringify(_this.queryJSON1)
    }).then (function(body){
      try {
        took+=body.took
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
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
      } catch (e) {_this.exCb(res,e,requestKey)} 
    }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  };//end q2


  //Get macromerge
  var q2macro = function(total_q1){

    _this.queryJSON2.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
    _this.queryJSON2.query.bool.must[0].range.ls.from = qparam_from;
    _this.queryJSON2.query.bool.must[0].range.ls.to = qparam_to;

    var streamListArray = qparam_streamList.split(',');
    var should_query = []
    for (var str=0;str<streamListArray.length;str++) {
      should_query.push( {"term" : { "stream" : streamListArray[str] }})
    }
    _this.queryJSON2.query.bool.should = should_query;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'macromerge',
      body : JSON.stringify(_this.queryJSON2)
      }).then (function(body){
        try {
          took+=body.took
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
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  };//end q2macro


  //Get totals from EoLS
  var q1 = function(callback){

    _this.queryJSON3.query.bool.must[1].parent_id.id = qparam_runNumber;
    _this.queryJSON3.query.bool.must[0].range.ls.from = qparam_from;
    _this.queryJSON3.query.bool.must[0].range.ls.to = qparam_to;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(_this.queryJSON3)
      }).then (function(body){
        try {
          took+=body.took
          //console.log(body.aggregations.host.buckets)
          var host_buckets = body.aggregations.host.buckets;
          for (var i=0;i<host_buckets.length;i++) {
	    totals[host_buckets[i].key] = host_buckets[i].events.value;
          }
	  //var doc_count = body.hits.total;
          q2();
        } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  };//end q1

  var q1macro = function(callback){

    _this.queryJSON4.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
    _this.queryJSON4.query.filtered.query.range.ls.from = qparam_from;
    _this.queryJSON4.query.filtered.query.range.ls.to = qparam_to;

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(_this.queryJSON4)
      }).then (function(body){
        try {
          took+=body.took
          // var results = body.hits.hits; //hits for query
          var total = body.aggregations.events.value;
 	  var doc_count = body.hits.total;
          q2macro(total);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  };//end q1macro

  if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
    if (qparam_type == 'minimerge')
      q1(); //call q1 with q2 as its callback
    else if (qparam_type == 'macromerge')
      q1macro();
  }
}

