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

  //remove!
  //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperhost request');
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
  var is_transfer = false;
  if (qparam_type=='transfer') is_transfer=true;
  if (qparam_type==='macromerge' || qparam_type=='transfer')
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

  var ls_max = qparam_to;

  //Get minimerge
  var q2 = function(){

   _this.queryJSON1.query.bool.must[1] = {"term":{"runNumber":qparam_runNumber}};

   _this.queryJSON1.query.bool.must[0].range.ls.from = qparam_from;
   _this.queryJSON1.query.bool.must[0].range.ls.to = ls_max;
   _this.queryJSON1.query.bool.must = [ _this.queryJSON1.query.bool.must[0],_this.queryJSON1.query.bool.must[1], {"term":{"stream":{"value":qparam_stream}}} ]

   global.client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: qparam_type,
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


    var n_lumis = ls_max - qparam_from + 1;

    var should_query = []
    var streamListArray = qparam_streamList.split(',');

    _this.queryJSON2.query.bool.must = [{"term":{"runNumber":qparam_runNumber}}]
    //set up aggregation
    _this.queryJSON2.aggs.sel.filter.range.ls = {"from":qparam_from,"to":ls_max};
    //build filter of selected streams. Event display is generated by DQM and does not belong here
    _this.queryJSON2.query.bool.must_not = [ {"term":{"type":"EventDisplay"}} ]
    for (var str=0;str<streamListArray.length;str++) {
      if (!is_transfer || streamListArray[str]!="Error") // for now Error is ignored with transfers
        should_query.push( {"term" : { "stream" : streamListArray[str] }})
    }
    _this.queryJSON2.query.bool.should = should_query;
    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: qparam_type,
      body : JSON.stringify(_this.queryJSON2)
      }).then (function(body){
        try {
          took+=body.took
          //var results = body.hits.hits; //hits for query
	  var host_map = {};
	  //var ret_list = [];
          var tot_streams_known=0;
	  var tot_doc_count=0;
          var hosts = body.aggregations.sel.host.buckets;
          for (var i=0;i<hosts.length;i++) {
                var host = hosts[i].key;
                if (host === '') continue;
		var processed = hosts[i].processed.value + hosts[i].errorEvents.value;
		var doc_count = hosts[i].doc_count;
		tot_doc_count+=doc_count;
		var doc_count_2 = hosts[i].status2.doc_count;

		if (qparam_type!="transfer") doc_count_2=doc_count;
		//calc minimerge percents
		var percent,p;
		//TODO:should check if this makes sense
		if (total_q1*streamListArray.length === 0) {
			if (doc_count === 0){
				percent = 0;
			}else{
				percent = 100;
			}
		}else{
		        if (doc_count) {
			  p = 100*(processed/(doc_count/n_lumis))/total_q1;
			}
			else p = 0;
			percent = Math.round(p*100)/100;
		}
		var color = percColor(percent);	
		//check for transfer-in-progress
		if (color=="green") {
		  if (doc_count_2<doc_count) color="olive";
		}
		
		var entry = {
			"name" : host,
			"y" : percent,
			"color" : color,
			"drilldown" : false
		};
		//console.log('host ' + host + ' ' + JSON.stringify([entry,doc_count,doc_count_2==doc_count]))
		host_map[host]=[entry,doc_count,doc_count_2==doc_count];
		//retObj.percents.push(entry);
	  }

          var host_list = body.aggregations.host_list.buckets;
	  var stream_check = {}
	  var do_run_host_check = true;
	  //check if one stream is handled by multiple hosts. in that case we can't use host_list aggregation
	  /*
          for (var i=0;i<host_list.length;i++) {
                var host_item = host_list[i];
		host_item.streams.buckets.forEach(function(stream) {
		  if (stream_check.hasOwnProperty(stream.key)) do_run_host_check=false;
		  stream_check[stream.key]=true;
		});
          }
	  */
          for (var i=0;i<host_list.length;i++) {
                var host_item = host_list[i];
		var host = host_item.key
		//console.log(JSON.stringify(host_item));

		var entry;
                var entry_arr;
                //if  (qparam_type=='transfer') {
                if  (!do_run_host_check) {
		  //no additional checks in transfer mode (cumulative stream list doesn't work because streams can move over multiple hosts)
		  if (host_map.hasOwnProperty(host))
		    entry = host_map[host][0];
		}
		else if (host_map.hasOwnProperty(host)) {
		  entry_arr = host_map[host];
		  entry = entry_arr[0];

		  var host_streams_known = host_item.streams.buckets.length;
		  tot_streams_known+=host_streams_known;
		  //requires lumisections to be sequentially filled in EvB (problem elsewhere if not)
                  var expected_docs = n_lumis*host_streams_known;
		  if (expected_docs!=entry_arr[1]) {
		    if (!expected_docs || !entry_arr[1]) {
		      entry.y=0;
		      entry.color="red";
		    }
		    else {
		      var p = entry.y * (entry_arr[1]/expected_docs);
		      entry.y = Math.round(p*100)/100;
		      entry.color=percColor(entry.y);
		    }
		  }
		  else {
		    var hasDQM=false;
		    host_item.streams.buckets.forEach(function (item) {
		      if (item.key.startsWith("DQM") && item.key!="DQMHistograms") hasDQM=true;
		    });
		    if (hasDQM && entry.color!="green" && entry.color!="olive")//entry.y==100?
		      if (entry_arr[2])
		        entry.color="green";
		      else
		        entry.color="olive";
		  }
		}
		else
		  entry = {
			"name" : host,
			"y" : 0,
			"color" : "red",
			"drilldown" : false
		  };

		//ret_list.push(entry);
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
    _this.queryJSON3.query.bool.must[0].range.ls.to = ls_max;

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

    _this.queryJSON4.query.bool.must[0].range.ls.from = qparam_from;
    _this.queryJSON4.query.bool.must[0].range.ls.to = ls_max;
    _this.queryJSON4.query.bool.must[1].parent_id.id = qparam_runNumber;

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


  //first find out the appropriate LS range so that completion is stable if chosen on the edge
  var q0 = function(callback){
    var queryJSON = { 
      "query": {
	"bool":{
	  "must": [
	    {
	      "range": {
		"ls": {"from":qparam_from,"to":qparam_to}
	      }
	    },
	    {
	      "parent_id": {
		"type":"eols","id":qparam_runNumber
	      }
	    }
	  ]
	}
      },
      "aggs": {
	"lsterms": {
	  "terms":{
	    "field":"ls","size":8,"order":{"_term":"desc"}
	  }
	}
      }
    }

    global.client.search({
      index: 'runindex_'+qparam_sysName+'_read',
      type: 'eols',
      body : JSON.stringify(queryJSON)
      }).then (function(body){
        try {
          took+=body.took
          // var results = body.hits.hits; //hits for query

	  //select max LS found from eols docs but filter out those that are transiently incomplete
	  var lsterms  = body.aggregations.lsterms.buckets;
	  if (lsterms.length) ls_max=lsterms[0].key;
	  if (lsterms.length>1)
	    if (lsterms[1].doc_count>lsterms[0].doc_count)
	      ls_max = lsterms[1].key;

          callback();
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
    });

  };//end q0

  if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
    if (qparam_type == 'minimerge')
      q0(q1); //call q1 with q2 as its callback
    else if (qparam_type == 'macromerge' || qparam_type=='transfer')
      q0(q1macro);
  }
}

