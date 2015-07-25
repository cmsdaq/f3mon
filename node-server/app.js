'use strict'; //all variables must be explicitly declared, be careful with 'this'
var express = require('express');
var app = express();
app.use(express.static('web'));

var elasticsearch = require('elasticsearch');
var JSONPath = './web/node-f3mon/api/json/';
var ESServer = 'cu-01.cern.ch';
var client = new elasticsearch.Client({
  host: ESServer+':9200',
  log: 'trace'
});

//callback 1 (test)
app.get('/', function (req, res) {
  res.send('Hello World!');
});

//callback 2 (test)
app.get('/test', function (req, res) {
  setTimeout(function(){
    console.log("timeout expired");
    res.send('Hello World after sleep!');
  }, 10000);
    console.log("dispatched timeout");
});

//callback 3
app.get('/node-f3mon/api/serverStatus', function (req, res) {
    console.log("received serverStatus request!");

    var cb = req.query.callback;
    //console.log(cb);

    //query elasticsearch health and bind return function to reply to the server
    client.cluster.health().then(
      function(body) {
        //console.log(body['status']);
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify({'status':body['status']})+')');

      }, function (err) {
        console.log(err.message);
        //res.send();
      }
    );


});//end callback

//callback 4
app.get('/node-f3mon/api/getIndices', function (req, res) {
    console.log("received getIndices request!");

    var cb = req.query.callback;
    client.cat.aliases({
      name: 'runindex*read'}
    ).then(
      function (body) {
        //console.log('received response from ES :\n'+body+'\nend-response');
        var aliasList = [];

        var alias_infos = body.split('\n');
        //console.log(alias_infos);
        for(var alias_info in alias_infos) {
          if (!alias_infos[alias_info].length) continue;
          //console.log(alias_infos[alias_infos]);
          var info = alias_infos[alias_info].split(' ');
          var mySubsys = info[0].split("_")[1];
          var myAlias = info[0];
          aliasList.push({"subSystem":mySubsys,"index":myAlias})
        }
        //console.log('sending '+aliasList);
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify({'list':aliasList})+')');
      },
      function(error) {
      console.log(error)
    });

/*
    var cb = req.query.callback;
    client.search( {
      index : 'runindex*read',
      query
 
    }).then(
  */  
});//end callback

//callback 5
app.get('/node-f3mon/api/getDisksStatus', function (req, res) {
console.log('received getDisksStatus request!');

var cb = req.query.callback;

//loads query definition from file
var queryJSON = require (JSONPath+'disks.json');

//GET query string params (needed to parameterize the query)
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;
if (qparam_runNumber == null){qparam_runNumber = 36;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

//add necessary params to the query
//queryJSON.query.wildcard.activeRuns.value =  qparam_runNumber; //ignore runNumber parameter for now...

//submits query to the ES and returns formatted response to the app client
client.search({
index: 'boxinfo_'+qparam_sysName+'_read',
type: 'boxinfo',
body : JSON.stringify(queryJSON)
	}).then(function (body){
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;
	res.set('Content-Type', 'text/javascript');
	res.send(cb +  ' (' +JSON.stringify(retObj)+')'); }, function (error){
	console.trace(error.message);
	});//end  client.search(...)
});//end callback


//callback 6
app.get('/node-f3mon/api/runList', function (req, res){
console.log('received runList request');

var cb = req.query.callback;

//loads query definition from file
var queryJSON = require (JSONPath+'runlist.json');

//GET query string params
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_size = req.query.size;
var qparam_sysName = req.query.sysName;
if (qparam_from == null){qparam_from = 0;}
if (qparam_to == null){qparam_to = 'now';}
if (qparam_size == null){qparam_size = 1000;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

//parameterize query fields
queryJSON.size = qparam_size;
queryJSON.query.range._timestamp.from = qparam_from;
queryJSON.query.range._timestamp.to = qparam_to;

//search ES
client.search({
index: 'runindex_'+qparam_sysName+'_read',
type: 'run',
body: JSON.stringify(queryJSON)
	}).then (function(body){
	var results = body.hits.hits; //hits for query

	//format response content from query results, then send it
	if (results.length==0){
		//send empty response if hits list is empty
		res.send();
	}else{
		var lasttime = results[0].fields._timestamp;
		var index;
		var arr = [];
		for (index = 0 ; index < results.length; index++){
			arr[index] = results[index]._source;
		}
		var retObj = {
			"lasttime" : lasttime,
			"runlist" : arr
		};
		res.set('Content-Type', 'text/javascript');
		res.send(cb +' ('+JSON.stringify(retObj)+')');

	}
	},function (error){
        console.trace(error.message);
	});
});//end callback


//callback 7
app.get('/node-f3mon/api/runListTable', function (req, res) {
console.log('received runListTable request');

var cb = req.query.callback;

//loads query definition from file
var queryJSON = require (JSONPath+'rltable.json');

//GET query string params
var qparam_from = req.query.from;
var qparam_size = req.query.size;
var qparam_sortBy = req.query.sortBy;
var qparam_sortOrder = req.query.sortOrder;
var qparam_search = req.query.search;
var qparam_sysName = req.query.sysName;

if (qparam_from == null){qparam_from = 0;}
if (qparam_size == null){qparam_size = 100;}
if (qparam_sortBy == null){qparam_sortBy = '';}
if (qparam_sortOrder == null){qparam_sortOrder = '';}
if (qparam_search == null){qparam_search = '';}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

//console.log(qparam_sortBy);
//parameterize query fields
queryJSON.size =  qparam_size;
queryJSON.from = qparam_from;

if (qparam_search != ''){
	queryJSON.filter.query.query_string.query = '*'+qparam_search+'*';	
}

var missing = '_last';
if (qparam_sortOrder == 'desc'){
	missing = '_first';
}

if (qparam_sortBy != '' && qparam_sortOrder != ''){
	var inner = {
		"order" : qparam_sortOrder,
		"missing" : missing
	};
	var temp = {};
	temp[qparam_sortBy] = inner;
	var outer = [temp]; //follows rltable.json format for sort
	queryJSON.sort = outer;
}
console.log("test\n"+JSON.stringify(queryJSON));
//search ES
client.search({
index:'runindex_'+qparam_sysName+'_read',
type: 'run',
body: JSON.stringify(queryJSON)
	}).then (function(body){
	var results = body.hits.hits; //hits for query
	//format response content here
	var total = body.aggregations.total.value;
	var filteredTotal = body.hits.total;
	var arr = [];
        for (var index = 0 ; index < results.length; index++){
        	arr[index] = results[index]._source;
        }

	var retObj = {
		"iTotalRecords" : total,
		"iTotalDisplayRecords" : filteredTotal,
		"aaData" : arr
        };
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
	}, function (error){
	console.trace(error.message);
	});

});//end callback

//callback 8
app.get('/node-f3mon/api/riverStatus', function (req, res) {
console.log('received riverStatus request');

var cb = req.query.callback;

//GET query string params
var qparam_size = req.query.size;
var qparam_query = req.query.query;
if (qparam_size == null){qparam_size = 100;}
if (qparam_query == null){qparam_query = 'riverstatus';}

//loads query definition from file
var queryJSON = require (JSONPath+qparam_query+'.json');

//parameterize query fields 
queryJSON.size = qparam_size;

//search ES - Q1 (get status)
var q1 = function (callback) {
  queryJSON.filter.term._id = "_status" //param for Q1

  client.search({
  index:'_river',
  body: JSON.stringify(queryJSON)
        }).then (function(body){
	var results = body.hits.hits; //hits for query 1
	var statusList = []; //built in Q1, used in Q2
	for (var index = 0 ; index < results.length; index++){
		//impl. php substr() for negative length parameter l
		var l = 6;
		var suffix = results[index]._source.node.transport_address.substr(l);
		var ip = suffix.substring(0, suffix.length-l);
		var entry = {
			"key" : results[index]._type,
			"value" : ip
		};
		statusList[index] = entry;
        }
	callback(statusList);
  }, function (error){
	console.trace(error.message);
  });
}//end q1


//search ES - Q2 (get meta)
var q2 = function (statusList){

  queryJSON.filter.term._id = "_meta" //param for Q2

  client.search({
  index:'_river',
  body: JSON.stringify(queryJSON)
        }).then (function(body){
        var results = body.hits.hits; //hits for query 2
	
	var systemsArray = []; //part of output
	var runsArray = []; //part of output

        var stat = [];
        var host = [];
	var source = [];
	var system = [];
        var index = 0;

        var prepareLookup = function () {
          if (index < results.length) {

		var type = results[index]._type;
		source[index] = results[index]._source;

		//impl. php substr() for positive length parameter l
		var l = 9; //equals size of the string 'runIndex_'
		var suffix  = source[index].runIndex_read.substr(l);
		var strpos_minus_const = source[index].runIndex_read.indexOf("_read")-l;
		system[index] = suffix.substring(0, strpos_minus_const);

		//status = false means that the river exists but the instance is not running
		var entriesByKey = statusList.filter(function (o){
			return o.key == type;
		});

		//console.log('fltd_array:'+JSON.stringify(entriesByKey));
		var ip;
                host[index]="";
		if (entriesByKey.length>0){	
		        stat[index]=true;
			ip = entriesByKey[0].value;
			var b = true;
	                var idx = index;
			require('dns').reverse(ip, checkResult.bind({b:b,idx:idx}));	
                }
                else {
		        stat[index]=false;
                        host[index]="";
                        formatEntry(index);
                        index++;
                        prepareLookup();
                }
            }
            else {
              response();
            }
        };



        var checkResult = function (err, domains) {
            
		if(err) {
			b = false;
			console.log(err.toString());
			return;
		}	
		//console.log('possible hostnames for this ip: '+domains);
		if (domains.length>0&&this.b){
			host[this.idx] = domains[0]; //assign the first possible hostname
		}else{
			host[this.idx] = "";
		}
		//console.log('returned hostname: '+host);
                formatEntry(this.idx);
                index++;
                prepareLookup();
        }
         

        var formatEntry = function(idx) {
		if ((source[idx].hasOwnProperty("role"))&&(source[idx].role=="collector")){
			var o  = {
				"runNumber" : source[idx].runNumber,
				"status" : stat[idx],
				"host" : host[idx],
				"subSystem" : system[idx]
			};
			runsArray.push(o);
		}else{
			var o  = {
                                "subSystem" : system[idx],
				"status" : stat[idx],
				"host" : host[idx]
                        };
			systemsArray.push(o);
                }
        }
         
        var response = function() {
	
	  //formats response
	  var retObj = {
		"systems" : systemsArray,
		"runs" : runsArray
	  };

	  res.set('Content-Type', 'text/javascript');
          res.send(cb +' ('+JSON.stringify(retObj)+')');
	}

        prepareLookup(); //initial caller

  }, function (error){
        console.trace(error.message);
  });
}//end q2

//chaining of the two queries (output of Q1 is combined with Q2 hits to form the response) 
//q1 is executed and then passes to its callback, q2
q1(q2);

});//end callback

//callback 9
app.get('/node-f3mon/api/runRiverListTable', function (req, res) {
console.log('received runRiverListTable request');

var cb = req.query.callback;

var retObj = {
	"list" : "",
	"total" : ""
};

var ipAddresses = [];

//GET query string params
var qparam_from = req.query.from;
var qparam_size = req.query.size;
var qparam_sortBy = req.query.sortBy;
var qparam_sortOrder = req.query.sortOrder;
if (qparam_from == null){qparam_from = 0;}
if (qparam_size == null){qparam_size = 100;}
if (qparam_sortBy == null){qparam_sortBy = '';}
if (qparam_sortOrder == null){qparam_sortOrder = '';}

var sendResult = function(){
   res.set('Content-Type', 'text/javascript');
   res.send(cb +' ('+JSON.stringify(retObj)+')');
}

var indx = 0;

var prepareLookup = function (){
	if (indx < ipAddresses.length){
		var ip = ipAddresses[indx];
		if (ip == -1){
			indx++;
			prepareLookup();	
		}else{
			var idx = indx;
			require('dns').reverse(ip, checkResult.bind({idx:idx}));
		}	
	}else{
		sendResult();
	}

}//end prepareLookup

var checkResult = function (err, domains){
	if (err){
		console.log(err.toString());
		retObj.list[this.idx].host = ipAddresses[this.idx]; //escape with IP in case of unresolved
		return;
	}
	if (domains.length>0){
              retObj.list[this.idx].host  = domains[0]; //assign the first possible hostname
        }else{
              retObj.list[this.idx].host  = ipAddresses[this.idx]; //escape with IP in case of unresolved
        }
	indx++;
	prepareLookup();
}//end checkResult 


//search ES - Q2 (check status)
var q2 = function (callback, typeList, list){

  var queryJSON = require (JSONPath+'runrivertable-status.json');

  //set query parameter
  queryJSON.query.bool.must[1].terms._type = typeList;

  client.search({
    index: '_river',
    body: JSON.stringify(queryJSON)
        }).then (function(body){
        var results = body.hits.hits; //hits for query 2
    
    	for (var index=0;index<list.length;index++){
	   var stat = [];
           var itemName = list[index].name;
		for (var j=0;j<results.length;j++){
			if (results[j]._type == itemName){
				stat.push(results[j]);
			}
		}

	   if (stat.length>0){
		var ipstring = stat[0];
		ipstring = ipstring._source.node.transport_address;
		var ip;
		var start = ipstring.indexOf('/')+1;
		var suffix = ipstring.substr(start);
		var len = ipstring.indexOf(':')-ipstring.length; //always negative, remove chars from the end
		ip = suffix.substring(0, suffix.length+len);
		ipAddresses[index] = ip;
		list[index].status = true;
	   }else{
	        ipAddresses[index] = -1;
	   }
   	 }
	retObj.list = list;//passes list to callback-level scope, next functs will access it directly
	callback();

    }, function (error){
            console.trace(error.message);
     });


}//end q2


//search ES - Q1 (get meta)
var q1 = function (callback){

  var queryJSON = require (JSONPath+'runrivertable-meta.json');

  //set query parameters
  queryJSON.size = qparam_size;
  queryJSON.from = qparam_from;
  queryJSON.query.term._id.value = "_meta";

  if (qparam_sortBy != '' && qparam_sortOrder != ''){
	var inner = {
		"order" : qparam_sortOrder,
		"missing" : "main",
		"unmapped_type" : "string"	
	};
	var temp = {};
	temp[qparam_sortBy] = inner;
	var outer = [temp];
        queryJSON.sort = outer;
  }

  client.search({
  index:'_river',
  body: JSON.stringify(queryJSON)
        }).then (function(body){
        var results = body.hits.hits; //hits for query 1
	retObj.total = body.hits.total;
	var typeList = [];
	var list = [];
	for (var index = 0 ; index < results.length; index++){
		typeList.push(results[index]._type);
		var runindex = results[index]._source.runIndex_read.split('_');
		runindex = runindex[1];
		var o = {
			"name" : results[index]._type,
			"role" : results[index]._source.hasOwnProperty("role") ? results[index]._source.role : 'main',
			"status" : false,
			"subSystem" : runindex
		};
		list.push(o);
	}
	callback(prepareLookup,typeList, list);
  }, function (error){
        console.trace(error.message);
  });
}//end q1

q1(q2);

});//end callback


//callback 10
app.get('/node-f3mon/api/closeRun', function (req, res) {
console.log('received closeRun request');

var cb = req.query.callback;
var retObj = {
        "runDocument" : "",
        "riverDocument" : ""
};
//var source;
//var mapping = {};

//GET query string params
var qparam_query = req.query.query;
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;

if (qparam_query == null){qparam_query = 'runinfo';}
if (qparam_runNumber == null){qparam_runNumber = 180017;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var sendResult = function(){
   res.set('Content-Type', 'text/javascript');
   res.send(cb +' ('+JSON.stringify(retObj)+')');
}

var del = function(callback){
  client.indices.deleteMapping({
  index: '_river',
  type: 'runriver_'+qparam_runNumber
        }).then (function(body){
		retObj.riverDocument = body;
		callback();
         }, function (error, response) {
		retObj.riverDocument = error.body;
                console.trace(error.message);
		callback();
  });
}//end del

var put = function (callback, ret){
  
  client.index({
  index: 'runindex_'+qparam_sysName+'_write',
  type: 'run',
  id: qparam_runNumber,
  body: ret
        }).then (function(body){
		retObj.runDocument = body;
		callback(sendResult);
        }, function (error, response) {
        console.trace(error.message);
  });
}//end put


var q1= function(callback){
 //loads query definition from file
 var queryJSON = require (JSONPath+qparam_query+'.json');
 queryJSON.filter.term._id = qparam_runNumber;
 client.search({
   index: 'runindex_'+qparam_sysName+'_write',
   type: 'run',
   body: JSON.stringify(queryJSON)
         }).then (function(body){
		var results = body.hits.hits; //hits for query 
     	if (results.length == 0){
		res.send();
	}else{
		var time = new Date().toISOString(); //current timestamp
		var ret = results[0]._source;
                ret.endTime = time;
		callback(del,ret); //passing control to its callback (here:put)
	}
   }, function (error){
         console.trace(error.message);
   });
}//end q1

q1(put);

});//end callback


//callback 11
app.get('/node-f3mon/api/logtable', function (req, res) {
console.log('received logtable request');

var cb = req.query.callback;

//GET query string params
var qparam_from = req.query.from;
var qparam_size = req.query.size;
var qparam_sortBy = req.query.sortBy;
var qparam_sortOrder = req.query.sortOrder;
var qparam_search = req.query.search;
var qparam_startTime = req.query.startTime;
var qparam_endTime = req.query.endTime;
var qparam_sysName = req.query.sysName;

if (qparam_from == null){qparam_from = 0;}
if (qparam_size == null){qparam_size = 100;}
if (qparam_sortBy == null){qparam_sortBy = '';}
if (qparam_sortOrder == null){qparam_sortOrder = '';}
if (qparam_search == null){qparam_search = '*';}
if (qparam_startTime == null || qparam_startTime == 'false'){qparam_startTime = 0;}
if (qparam_endTime == null || qparam_endTime == 'false'){qparam_endTime = 'now';}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

//loads query definition from file
var queryJSON = require (JSONPath+'logmessages.json');

//parameterize query
queryJSON.size = qparam_size;
queryJSON.from = qparam_from;
queryJSON.query.filtered.filter.and[0].range._timestamp.from = qparam_startTime;
queryJSON.query.filtered.filter.and[0].range._timestamp.to = qparam_endTime;

if (qparam_search != ''){
	queryJSON.query.filtered.query.bool.should[0].query_string.query = qparam_search;
}

var missing = '_last';
if (qparam_sortOrder == 'desc'){
        missing = '_first';
}

if (qparam_sortBy != '' && qparam_sortOrder != ''){
        var inner = {
                "order" : qparam_sortOrder,
                "missing" : missing
        };
        var temp = {};
        temp[qparam_sortBy] = inner;
        var outer = temp;
        queryJSON.sort = outer;
}

client.search({
  index: 'hltdlogs_'+qparam_sysName,
  type: 'hltdlog',
  body: JSON.stringify(queryJSON)
        }).then (function(body){
        var results = body.hits.hits; //hits for query
	if (body.hits.length==0){
                //send empty response if hits list is empty
                 res.send();
        }else{
		var total = body.hits.total;
		var ret = [];
		for (var index = 0 ; index < results.length; index++){
			ret[index] = results[index]._source;
		}
		var retObj = {
			"iTotalRecords" : total,
			"iTotalDisplayRecords" : total,
			"aaData" : ret,
			"lastTime" : body.aggregations.lastTime.value
		};
		res.set('Content-Type', 'text/javascript');
		res.send(cb +' ('+JSON.stringify(retObj)+')');

	}                  
  }, function (error){
        console.trace(error.message);
  });



});//end callback


//callback 12
app.get('/node-f3mon/api/startCollector', function (req, res) {
console.log('received startCollector request');

var cb = req.query.callback;
var retObj = {
	"oldRiverDocument" : "",
	"newRiverMapping" : "",
	"newRiverDocument" : ""
};
var source;
var mapping = {};


//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 37;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var sendResult = function(){
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//start collector
var q4 = function(callback){
  client.index({
    index:'_river',
    type:'runriver_'+qparam_runNumber,
    id:'_meta',
    body:source
  }).then(function(body){
        retObj.newRiverDocument = body;
   	callback(); //calls sendResult to end the callback
  }, function (error){
	console.trace(error.message);
  });
}//end q4

//put dynamic mapping
var q3 = function(callback){
  client.indices.putMapping({
    index:'_river',
    type:'runriver_'+qparam_runNumber,
    body:mapping
  }).then(function(body){
	retObj.newRiverMapping = body;
 	callback(sendResult);
  }, function (error){
	console.trace(error.message);
  }); 
}//end q3

//deleting old instances
var q2 = function(callback){
 client.indices.deleteMapping({
  index:'_river',
  type:'runriver_'+qparam_runNumber
  }).then (function(body){
	retObj.oldRiverDocument = body;
	callback(q4);
  }, function (error){
   retObj.oldRiverDocument = error.body;
   console.trace(error.message);
   callback(q4);
  });

}//end q2

/*
//retrieves all entries from an index type (first step on bulk operations on these entries)
var getAllEntries = function(callback){
  client.search({
   index: '_river',
   type: 'runriver_'+qparam_runNumber,
   body: JSON.stringify({
	"query" : {
 		"match_all" : { }
		}
	})  }).then (function(body){
	var results = body.hits.hits;
	var ids = [];
	for (i=0;i<results.length;i++){
		ids[i] = results[i]._id;
	}
	//callback(...); //fill with callback function, if needed
  }, function (error){
        console.trace(error.message);
  });
}*/


//get parameters from the main river
var q1 = function (callback){
  var runIndex = 'runindex_'+qparam_sysName+'_read';
  client.search({
    index: '_river',
    type: 'runriver',
    body : JSON.stringify({
        "query" : {
                "term" : {
                        "runIndex_read" : {
                                "value" : runIndex
                                        }
                        }
                }
        }) }).then (function(body){
        var results = body.hits.hits; //hits for query
	//console.log(results.length);
        source = results[0]._source; //assigns value to callback-wide scope variable
        if (!source){
                res.send();
        }else{
                source.role = 'collector';
                source.runNumber = qparam_runNumber;
                source.startsBy = 'Web Interface';
		mapping["dynamic"] = true; //assigns value to callback-wide scope variable
		callback(q3);
        }

  },function (error){
       console.trace(error.message);
  });


}//end q1

q1(q2);

});//end callback


//callback 13
app.get('/node-f3mon/api/nstates-summary', function (req, res) {
console.log('received nstates-summary request');

var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_timeRange = req.query.timeRange;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 10;}
if (qparam_timeRange == null){qparam_timeRange = 60;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var q1 = function(callback){
  //loads query definition from file
  var queryJSON = require (JSONPath+'ulegenda.json');
  
  queryJSON.query.filtered.query.term._parent = qparam_runNumber;

  client.search({
  index: 'runindex_'+qparam_sysName+'_read',
  type: 'microstatelegend',
  body : JSON.stringify(queryJSON)
  }).then (function(body){
	var legend;
	var resSummary = false;
	//var data = [];	//Id1: data array format
	//var data = {}
	if (body.hits.total ===0){
		var data = []; 
		legend = false;
		var out = {
			"lastTime" : null,
			"timeList" : null,
			"data" : data
		};
		res.set('Content-Type', 'text/javascript');
                res.send(cb +' ('+JSON.stringify(out)+')');
	}else{
		var data = {};
        	var results = body.hits.hits; //hits for query
		//console.log('L?='+(results.length));	
		var shortened = results[0]._source.names;
		if (shortened.indexOf('33=')>-1){
			shortened = shortened.substr(0, shortened.indexOf('33='))+'33=Busy';	
			resSummary = true;
		}
		var rawLegend = shortened.trim().split(' ');
		var name;
		var legend = [];
		for (var i = 0; i<rawLegend.length;i++){
			var kv = rawLegend[i].split('=');
			//console.log('kv0='+kv[0]);
			if (kv[1]==''){
				continue;
				//name = kv[0];
			}else{
				name = kv[1];
			}
			var lEntry = {};
			lEntry[kv[0]] = name;
			legend.push(lEntry);
			//var dEntry = {}; //Id1: data array format
			//dEntry[name] = [];
			//data.push(dEntry);
			data[name] = [];
		}
	//console.log(JSON.stringify(data));	
	callback(legend, resSummary, data);
	}
	
  }, function (error){
        console.trace(error.message);
  });

}//end q1

var q2 = function(legend, resSummary, data){

//console.log("\nexec. q2\n");
//console.log(JSON.stringify(data));

 if (legend){
  //loads query definition from file
  var queryJSON = require (JSONPath+'nstates.json');

  queryJSON.query.bool.must[1].range._timestamp.from = 'now-'+qparam_timeRange+'s';
  queryJSON.query.bool.must[0].term._parent = qparam_runNumber;

  client.search({
  index: 'runindex_'+qparam_sysName+'_read',
  type: 'state-hist',
  body : JSON.stringify(queryJSON)

  }).then (function(body){
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
			if (key>32){
				busySum = busySum + value;
			}else{
				entriesList.push(name);
				var arr = [timestamp,value];
				//var e = {}; //Id1: data array format
				//e[name] = arr;
				//data.push(e);
				data[name] = arr;
			}
		}
		if (resSummary == true){
			entriesList.push('Busy');
			var arr = [timestamp,busySum];
			//var o = {};  //Id1: data array format
			//o["Busy"] = arr;
			//data.push(o);
			data["Busy"] = arr;
		}
		var properties = [];
		for (var pName in data){
			properties.push(data[pname]);
		}
		var diff = properties.not(entriesList).get();
		for (var k=0;k<diff.length;k++){
			var arr = [timestamp,null];
			//data[diff(k)].push(arr); //Id1: data array format
			data[diff(k)] = arr;
		}
	}
	var lastTime = null;
	if (results.length>0){
		lastTime = results[results.length-1].sort[0];
	}
	var retObj = {
		"lastTime" : lastTime,
		"timeList" : timeList,
		"data" : data
	};
	res.set('Content-Type', 'text/javascript');
	res.send(cb +' ('+JSON.stringify(retObj)+')');

  }, function (error){
        console.trace(error.message);
  });
 }else{
	var retObj = {
             "lastTime" : null,
             "timeList" : null,
             "data" : data
        };
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
 
 }


}//end q2

q1(q2); //call q1 with q2 as its callback

});//end callback

//idx refresh for one index
app.get('/node-f3mon/api/idx-refr', function (req, res) {
console.log('received idx-refr request');

//GET query string params
var qparam_indexAlias = req.query.indexAlias;
if (qparam_indexAlias == null){qparam_indexAlias = '';}

client.indices.refresh({
  index: qparam_indexAlias
  }).then (function(body){
	res.set('Content-Type', 'text/javascript');
        res.send('('+JSON.stringify(body)+')');
  }, function (error){
	res.set('Content-Type', 'text/javascript');
	res.send('Error! Check console for trace...');
        console.trace(error.message);
  });
});//end idx-refr


//sets server listening for connections at port 3000
var server = app.listen(3000, function () {

 // test elasticsearch connection (test)
 client.ping();
 //client.cat.aliases({name: 'runindex*cdaq*'},function (error, response) { console.log(JSON.stringify(response.split('\n')));});
 
 var host = server.address().address;
 var port = server.address().port;
 
 console.log('Server listening at http://%s:%s', host, port);
 
 });

