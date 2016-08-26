'use strict';

var queryJSON1;
var queryJSON2;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(queryJSN1,queryJSN2) {
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
  },

  query : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'nstates-summary request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //GET query string params
    var qparam_runNumber = req.query.runNumber;
    var qparam_timeRange = req.query.timeRange;
    var qparam_sysName = req.query.sysName;

    if (qparam_runNumber == null){qparam_runNumber = 10;}
    if (qparam_timeRange == null){qparam_timeRange = 60;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}

    var requestKey = 'nstates-summary?runNumber='+qparam_runNumber+'&timeRange='+qparam_timeRange+'&sysName='+qparam_sysName;
    var requestValue = global.f3MonCache.get(requestKey);
    var ttl = global.ttls.nstatesSummary; //cached ES response ttl (in seconds)


    var retObj = {
	    "lastTime" : null,
	    "timeList" : null,
	    "data" : ""
    };

    var sendResult = function(){
	    global.f3MonCache.set(requestKey, [retObj,ttl], ttl);
	    var srvTime = (new Date().getTime())-eTime;
	    global.totalTimes.queried += srvTime;
	    console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	    res.set('Content-Type', 'text/javascript');
            res.header("Cache-Control", "no-cache, no-store");
	    res.send(cb +' ('+JSON.stringify(retObj)+')');
    }

    var resSummary = false;
    var legend = {};
    var reserved;
    var special;
    var output;
    var ustatetype = "state-hist";

    //Get legend
    var q1 = function(callback){
      queryJSON1.query.filtered.query.term._parent = qparam_runNumber;

      global.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'microstatelegend',
        body : JSON.stringify(queryJSON1)
      }).then (function(body){
      try {
      if (body.hits.total ===0){
        retObj.data = [];
        sendResult();
      }else{
        retObj.data = {};
        var result = body.hits.hits[0]; //hits for query
        reserved = result._source.reserved;
	special = result._source.special;
	output = result._source.output;
	if (reserved===undefined || special===undefined || output===undefined || result._source.stateNames===undefined) {
	var shortened = result._source.names;
	if (shortened.indexOf('33=')>-1){
	shortened = shortened.substr(0, shortened.indexOf('33='))+'33=Busy';
	resSummary = true;
	}
	var rawLegend = shortened.trim().split(' ');
	var name;
	for (var i = 0; i<rawLegend.length;i++){
	var kv = rawLegend[i].split('=');
	if (kv[1]==''){
		continue;
		//name = kv[0];  //accept empty legend??
	}else{
		name = kv[1];
	}
	legend[kv[0]] = name;
	//var dEntry = {}; //Id1: data array format
	//dEntry[name] = [];
	//data.push(dEntry);
	retObj.data[name] = [];
	}
	}
	else {
		var shortened = result._source.stateNames;
		for (var i = 0 ; i< special ; i++) {
			legend[i]=shortened[i];
			retObj.data[shortened[i]] = [];
		}
		legend[special]='hltOutput';
		retObj.data['hltOutput'] = [];
		legend[reserved]='Busy';
		retObj.data['Busy'] = [];
		ustatetype = "state-hist-summary";
	}
	//console.log(JSON.stringify(data));	
	callback(sendResult);
      }
      } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
	      excpEscES(res,error,requestKey);
	      console.trace(error.message);
      });

    }//end q1


    //Get states
    var q2 = function(callback){

	    queryJSON2.query.bool.must[1].range.date.from = 'now-'+qparam_timeRange+'s';
	    queryJSON2.query.bool.must[0].term._parent = qparam_runNumber;

	    global.client.search({
              index: 'runindex_'+qparam_sysName+'_read',
              type: ustatetype,
              body : JSON.stringify(queryJSON2)

            }).then (function(body){
              try {
              var results = body.hits.hits; //hits for query
              var timeList = [];
		
	      for (var i=0;i<results.length;i++){
		var timestamp = results[i].sort[0];
		var entries = results[i]._source.hmicro.entries;
		timeList.push(timestamp);
		var entriesList = [];
		var busySum = 0;
		
		for (var j=0;j<entries.length;j++){
			var key = entries[j].key;
			var value = entries[j].count;
			var name = legend[key];
			if (key>32 && resSummary === true){
				busySum = busySum + value;
			}else{
				entriesList.push(name);
				var arr = [timestamp,value];
				//var e = {}; //Id1: data array format
				//e[name] = arr;
				//data.push(e);
				retObj.data[name].push(arr);
			}
		}
		if (resSummary === true){
			entriesList.push('Busy');
			var arr = [timestamp,busySum];
			//var o = {};  //Id1: data array format
			//o["Busy"] = arr;
			//data.push(o);
			retObj.data["Busy"].push(arr);
		}

		//discovering array keys
		var properties = [];
		for (var pName in retObj.data){
			if (retObj.data.hasOwnProperty(pName)){
				properties.push(pName);
			}
		}

		//implementing array diff (properties minus entriesList)
		var diff = [];
		var helperMap = {};
		for (var h=0;h<entriesList.length;h++){
			helperMap[entriesList[h]] = true;
		}
		for (var m=0;m<properties.length;m++){
			if (!helperMap.hasOwnProperty(properties[m])){
				diff.push(properties[m]);
			}
		}

		//var diff = properties.not(entriesList).get(); //diff impl. with jQuery

		for (var k=0;k<diff.length;k++){
			var arr = [timestamp,null];
			//data[diff[k]].push(arr); //Id1: data array format
			retObj.data[diff[k]].push(arr);
		}
	}
	
	retObj.timeList = timeList;
	if (results.length>0){
		var lastTime = results[results.length-1].sort[0];
		retObj.lastTime = lastTime;
	}
	callback();
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
	    excpEscES(res,error,requestKey);
	    console.trace(error.message);
      });

    }//end q2

    if (requestValue=="requestPending"){
      requestValue = global.f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      global.f3MonCache.set(requestKey, "requestPending", ttl);

      q1(q2); //call q1 with q2 as its callback

    }else{
      var srvTime = (new Date().getTime())-eTime;
      global.totalTimes.cached += srvTime;
      console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.header("Cache-Control", "no-cache, no-store");
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

