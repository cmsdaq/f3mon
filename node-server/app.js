'use strict'; //all variables must be explicitly declared, be careful with 'this'
var express = require('express');
var app = express();
var php = require('node-php');
var http = require('http');
http.globalAgent.maxSockets=Infinity;

//old web
app.use("/sctest",php.cgi("web/ecd/sctest"));
app.use("/phpscripts",php.cgi("web/ecd/phpscripts"));
app.use("/ecd",php.cgi("web/ecd/ecd"));
app.use("/ecd-allmicrostates",php.cgi("web/ecd/ecd-allmicrostates"));
app.use("/f3mon",php.cgi("web/ecd/f3mon"));
app.use("/f3mon-test",php.cgi("web/ecd/f3mon-test"));

app.use(express.static('web'));

var elasticsearch = require('elasticsearch');
var JSONPath = './web/node-f3mon/api/json/'; //set in each deployment
var ESServer = 'es-cdaq';  //set in each deployment, if using a different ES service
var client = new elasticsearch.Client({
  host: ESServer+':9200',
  //log: 'trace'
  //log: 'debug'
  log : [{
	type : 'file', //outputs ES logging to a file in the app's directory
	levels : ['debug'] //can put more logging levels here
	}]
});

//redirecting console log to a file
var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream('./console.log', {flags : 'a'});
var log_stdout = process.stdout;

var initLogFile = function(){
	log_file.write(util.format('*new server run starts here*')+'\n');
        log_stdout.write(util.format('*new server run starts here*')+'\n'); //uncomment to also output to the console
}

initLogFile(); //nodejs logger

console.log = function (msg){
	log_file.write(util.format(msg)+'\n');
	log_stdout.write(util.format(msg)+'\n'); //uncomment to also output to the console
};


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
    console.log("received serverStatus request");

    var cb = req.query.callback;
    //console.log(cb);

    //query elasticsearch health and bind return function to reply to the server
    client.cluster.health().then(
      function(body) {
        //console.log(body['status']);
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify({'status':body['status']})+')');

      }, function (err) {
	excpEscES(res,err);
        console.log(err.message);
        //res.send();
      }
    );


});//end callback

//callback 4
app.get('/node-f3mon/api/getIndices', function (req, res) {
    console.log("received getIndices request");

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
          //console.log(alias_infos[alias_info]);
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
	excpEscES(res,error);
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
console.log('received getDisksStatus request');

var cb = req.query.callback;

//loads query definition from file
var queryJSON = require (JSONPath+'disks.json');

//GET query string params (needed to parameterize the query)
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;
if (qparam_runNumber == null){qparam_runNumber = 36;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

//add necessary params to the query
queryJSON.query.wildcard.activeRuns.value =  '*'+qparam_runNumber+'*';

//submits query to the ES and returns formatted response to the app client
client.search({
index: 'boxinfo_'+qparam_sysName+'_read',
type: 'boxinfo',
body : JSON.stringify(queryJSON)
	}).then(function (body){
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;
	res.set('Content-Type', 'text/javascript');
	res.send(cb +  ' (' +JSON.stringify(retObj)+')');
	 }, function (error){
	excpEscES(res,error);
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
	excpEscES(res,error);
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

var searcher = false;
if (qparam_search != ''){
	searcher = true;
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

var qsubmitted = queryJSON;
if (searcher){
	qsubmitted["filter"] = {"query":
				{"query_string":
				 {"query": '*'+qparam_search+'*'}}};
}
//console.log("test\n"+JSON.stringify(queryJSON));
//search ES
client.search({
index:'runindex_'+qparam_sysName+'_read',
type: 'run',
body: JSON.stringify(qsubmitted)
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
         }, function (error) {
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
        }, function (error) {
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
	excpEscES(res,error);
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
 *-initial version-
 * retrieves all entries from an index type (first step on bulk operations on these entries)
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
	excpEscES(res,error);
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

var retObj = {
                "lastTime" : null,
                "timeList" : null,
                "data" : ""
        };

var sendResult = function(){
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

var resSummary = false;
var legend = {};

//Get legend
var q1 = function(callback){
  //loads query definition from file
  var queryJSON = require (JSONPath+'ulegenda.json');
  
  queryJSON.query.filtered.query.term._parent = qparam_runNumber;

  client.search({
  index: 'runindex_'+qparam_sysName+'_read',
  type: 'microstatelegend',
  body : JSON.stringify(queryJSON)
  }).then (function(body){
	if (body.hits.total ===0){
		retObj.data = [];
		sendResult();
	}else{
		retObj.data = {};
        	var results = body.hits.hits; //hits for query
		var shortened = results[0]._source.names;
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
	//console.log(JSON.stringify(data));	
	callback(sendResult);
	}
	
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1


//Get states
var q2 = function(callback){

//console.log("\nexec. q2\n");
//console.log(JSON.stringify(data));

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
				retObj.data[name].push(arr);
			}
		}
		if (resSummary == true){
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
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });


}//end q2

q1(q2); //call q1 with q2 as its callback

});//end callback


//callback 14
app.get('/node-f3mon/api/runInfo', function (req, res) {
console.log('received runInfo request');

var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 700032;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var retObj = {};

var sendResult = function(){
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//last LS number
var q3 = function (callback){

var queryJSON = require (JSONPath+'lastls.json');

  queryJSON.query.term._parent = qparam_runNumber;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
	var results = body.hits.hits; //hits for query
	if (results.length === 0){
		retObj.lastLs = 0;
	}else{
		retObj.lastLs = results[0].sort;
	}
	callback();
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
}//end q3

//streams
var q2 = function (callback){

//loads query definition from file
var queryJSON = require (JSONPath+'streamsinrun.json'); //changed compared to the Apache/PHP version, now implements aggregation instead of faceting

  queryJSON.query.term._parent = qparam_runNumber;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'stream-hist',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        //var results = body.hits.hits; //hits for query
        var terms = body.aggregations.streams.buckets; //replacing facet implementation (facets->deprecated)
	var streams = [];
	for (var i=0;i<terms.length;i++){
		streams[i] = terms[i].key;
	}
	retObj.streams = streams;
        callback(sendResult);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });



}//end q2

//start and end time
var q1 = function (callback){

 //loads query definition from file
 var queryJSON = require (JSONPath+'runinfo.json');

  queryJSON.filter.term._id = qparam_runNumber;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'run',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	retObj = results[0]._source;
	callback(q3);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1

q1(q2)

});//end callback

//callback 15
app.get('/node-f3mon/api/minimacroperstream', function (req, res) {
console.log('received minimacroperstream request');

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
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get minimerge
var q2 = function(callback, total_q1){
  
   //loads query definition from file 
   var queryJSON = require (JSONPath+'minimacroperstream.json');

   queryJSON.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
   queryJSON.query.bool.must[0].range.ls.from = qparam_from;
   queryJSON.query.bool.must[0].range.ls.to = qparam_to;

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: qparam_type,
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        //var results = body.hits.hits; //hits for query
        var streams = body.aggregations.stream.buckets;
        for (var i=0;i<streams.length;i++){
		var stream = streams[i].key;
		if (stream == '' || streamListArray.indexOf(stream) == -1){
			continue;
		}
		var processed = streams[i].processed.value;
		var doc_count = streams[i].doc_count;

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
		
		/* //moved to function for reusability	
		var color = '';
		if (percent >= 100){
			color = 'green';
		}else if (percent >= 50){
			color = 'orange';
		}else{
			color = 'red';
		}*/
		
		var color = percColor(percent);	
		
		var b = false;
		if (qparam_type === 'minimerge'){
			b = true;
		}

		var entry = {
			"name" : stream,
			"y" : percent,
			"color" : color,
			"drilldown" : b
		};
		retObj.percents.push(entry);
	}
        callback();
    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

};//end q2

//Get total
var q1 = function(callback){
  streamListArray = qparam_streamList.split(',');

  //loads query definition from file 
  var queryJSON = require (JSONPath+'teolsperstream.json');
 
  queryJSON.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON.query.filtered.query.range.ls.from = qparam_from;
  queryJSON.query.filtered.query.range.ls.to = qparam_to;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
       // var results = body.hits.hits; //hits for query
        var total = body.aggregations.events.value;
	var doc_count = body.hits.total;
        callback(sendResult, total);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

};//end q1

q1(q2);

});//end callback

//callback 16
app.get('/node-f3mon/api/minimacroperbu', function (req, res) {
console.log('received minimacroperbu request');

var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_stream = req.query.stream;
var qparam_sysName = req.query.sysName;
var qparam_streamList = req.query.streamList;
var qparam_type = req.query.type;


if (qparam_runNumber == null){qparam_runNumber = 390008;}
if (qparam_from == null){qparam_from = 1000;}
if (qparam_to == null){qparam_to = 2000;}
if (qparam_stream == null){qparam_stream = 'A';}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}
if (qparam_streamList == null){qparam_streamList = 'A,B,DQM,DQMHistograms,HLTRates,L1Rates';} //review default initialization
if (qparam_type == null){qparam_type = 'minimerge';}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get mini or macro merge
var q2 = function (callback,totals_q1){

  //loads query definition from file 
  var queryJSON = require (JSONPath+'minimacroperbu.json');

  queryJSON.query.bool.must[1].prefix._id = 'run'+qparam_runNumber;
  queryJSON.query.bool.must[0].range.ls.from = qparam_from;
  queryJSON.query.bool.must[0].range.ls.to = qparam_to;
  queryJSON.query.bool.must[2].term.stream.value = qparam_stream;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: qparam_type,
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	var totalProc = {};
		
	for (var i=0;i<results.length;i++){
                var id = results[i]._id;
                var strpos = id.indexOf('bu');
                var bu = id.substring(strpos);
		var processed = results[i]._source.processed;
		if (totalProc[bu] == null){
                        totalProc[bu] = 0;
                }
                totalProc[bu] += processed;
	}

	for (var buname in totals_q1){
        	if (totals_q1.hasOwnProperty(buname)){
                	var total = totals_q1[buname];
			var proc = -1;
			if (totalProc[buname] == null){
				proc = 0;
			}else{
				proc = totalProc[buname];
			}

			//calc percents
			var percent;
			if (total == 0){
				if (proc == 0){
					percent = 0;
				}else{
					percent = 100;
				}
			}else{
				var p = 100*proc/total;
                        	percent = Math.round(p*100)/100;
			}
			var color = percColor(percent);

			var entry = {
                        "name" : buname,
                        "y" : percent,
                        "color" : color,
                        "drilldown" : false
                	};
                	retObj.percents.push(entry);
                }
	}
	callback();

    }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
    });

}//end q2

//Get total
var q1 = function (callback){
  streamListArray = qparam_streamList.split(',');

  //loads query definition from file 
  var queryJSON = require (JSONPath+'teolsperbu.json');
  
  queryJSON.size = 2000000;
  queryJSON.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON.query.filtered.query.range.ls.from = qparam_from;
  queryJSON.query.filtered.query.range.ls.to = qparam_to;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
  	var totals = {}; //obj to hold per bu event counters

	for (var i=0;i<results.length;i++){
		var id = results[i]._id;
		var total = results[i]._source.NEvents;
		var strpos = id.indexOf('bu');
		var bu = id.substring(strpos);
		if (totals[bu] == null){
			totals[bu] = 0;	
		}
		totals[bu] += total;
	}
        callback(sendResult, totals);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1

q1(q2);

});//end callback

//callback 17
app.get('/node-f3mon/api/streamhist', function (req, res) {
console.log('received streamhist request');

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
if (qparam_streamList == null){qparam_streamList = 'A,B,DQM,DQMHistograms,HLTRates,L1Rates';}
if (qparam_timePerLs == null){qparam_timePerLs = 23.4;}
if (qparam_useDivisor == null){qparam_useDivisor = false;}else{qparam_useDivisor = (req.query.useDivisor === 'true');}

var streamListArray = qparam_streamList.split(',');
if (qparam_lastLs<21){qparam_lastLs = 21;}
if (!qparam_useDivisor){qparam_timePerLs = 1;}
var x = (parseInt(qparam_to) - parseInt(qparam_from))/parseInt(qparam_intervalNum);
var interval = Math.round(x); 
if (interval == 0){interval = 1;}

//helper variables with cb-wide scope
var lastTimes = [];
var streamTotals;
var took = 0;
var streamNum;
var postOffSt;

var retObj = {
	"streams" : "",
	"took" : "",
	"lsList" : "",
        "minimerge" : "",
	"macromerge" : "",
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

	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get macromerge
var q5 = function (callback){
	//loads query definition from file
        var queryJSON = require (JSONPath+'minimacromerge.json');

	queryJSON.query.filtered.filter.and.filters[0].prefix._id = 'run' + qparam_runNumber;
	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

	client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'macromerge',
         body : JSON.stringify(queryJSON)
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
			var processed = lsList[i].processed.value;
			var total = streamTotals.events[ls]*streamNum;
			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;

			//calc macromerge percents
 			var percent;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
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
                        "x" : ls,
                        "y" : percent,
                        "color" : color
                        };
                        macromerge.percents.push(entry);
		}
		retObj.macromerge = macromerge;
		retObj.took = took;
		callback();
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q5


//Get minimerge
var q4 = function (callback){
	//loads query definition from file
        var queryJSON = require (JSONPath+'minimacromerge.json');

	queryJSON.query.filtered.filter.and.filters[0].prefix._id = 'run' + qparam_runNumber;
	queryJSON.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

	client.search({
	 index: 'runindex_'+qparam_sysName+'_read',
         type: 'minimerge',
         body : JSON.stringify(queryJSON)
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
			var processed = lsList[i].processed.value;
			var total = streamTotals.events[ls]*streamNum;
			var doc_count = streamTotals.doc_counts[ls];
			var mdoc_count = lsList[i].doc_count;

			//calc minimerge percents
 			var percent;
                        if (total == 0){
                                if (doc_count == 0 || mdoc_count == 0){
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
                        "x" : ls,
                        "y" : percent,
                        "color" : color
                        };
                        minimerge.percents.push(entry);
		}
		retObj.minimerge = minimerge;
		callback(sendResult);
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q4


//Get stream out
var q3 = function (callback){
	//loads query definition from file
	var queryJSON = require (JSONPath+'outls.json');

	queryJSON.query.filtered.filter.and.filters[0].prefix._id = qparam_runNumber;
	queryJSON.aggs.stream.aggs.inrange.filter.range.ls.from = qparam_from;
	queryJSON.aggs.stream.aggs.inrange.filter.range.ls.to = qparam_to;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.min = qparam_from;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.extended_bounds.max = qparam_to;
	queryJSON.aggs.stream.aggs.inrange.aggs.ls.histogram.interval = parseInt(interval);

   client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'stream-hist',
    body : JSON.stringify(queryJSON)
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
	
	for (var i=0;i<streams.length;i++){
		 if (streams[i].key == '' || streamListArray.indexOf(streams[i].key) == -1){
                        continue;
                }
		var sout = {
			"stream" : streams[i].key,
			"dataOut" : [],
			"fileSize" : [],
			"percent" : []
		};
		streamData.streamList.push(streams[i].key);
		
		var lsList = streams[i].inrange.ls.buckets;
		for (var j=0;j<lsList.length;j++){
			var ls = lsList[j].key+postOffSt;
			var total = streamTotals.events[ls];
			var doc_count = streamTotals.doc_counts[ls];
			
			//rounding with 2 dp precision
			var inval = Math.round(100*lsList[j].in.value)/100;
			var outval = Math.round(100*lsList[j].out.value)/100;
			var fsval = Math.round(100*lsList[j].filesize.value)/100;

			//calc stream percents
			var percent;
			if (total == 0){
				if (doc_count == 0){
					percent = 0;
				}else{
					percent = 100;
				}
			}else{
				var p = 100*inval/total;
                                percent = Math.round(p*100)/100;
			}

			//output
			if (qparam_timePerLs>1){
				outval = Math.round((outval/qparam_timePerLs)*100)/100;
				fsval = Math.round((fsval/qparam_timePerLs)*100)/100;
			}		
			
			var d = {"x":ls,"y":outval}; 
			var f = {"x":ls,"y":fsval};
			var p = {"x":ls,"y":percent};
			sout.dataOut.push(d);
			sout.fileSize.push(f);
			sout.percent.push(p);

		}//end for j
		streamData.data.push(sout);			
	}//end for i
	retObj.streams = streamData;
	retObj.took = took;
	retObj.lsList = streamTotals.lsList;
	
	//Filter DQM from streamlist
	var mmStreamList = [];
	for (var k=0;k<streamListArray.length;k++){
		var s = streamListArray[k];
		if ((!(s.substr(0,3)==='DQM')&&(s!=='Error'))||(s==='DQMHistograms')){
			mmStreamList.push(streamListArray[k]);
		}
	}
	streamNum = mmStreamList.length;
	
	callback(q5);
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
   });

}//end q3

//Get totals
var q2 = function (callback){
  //loads query definition from file
  var queryJSON = require (JSONPath+'teols.json');

  queryJSON.aggregations.ls.histogram.interval = parseInt(interval);
  queryJSON.aggregations.ls.histogram.extended_bounds.min = qparam_from;
  queryJSON.aggregations.ls.histogram.extended_bounds.max = qparam_to;
  queryJSON.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON.query.filtered.query.range.ls.from = qparam_from;
  queryJSON.query.filtered.query.range.ls.to = qparam_to;

 client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON)
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
		var ls = buckets[i].key;
                var events = buckets[i].events.value;
		var doc_count = buckets[i].doc_count;
		ret.events[ls] = events;
		ret.doc_counts[ls] = doc_count;
		//ret.events.push(ev_entry);	//old impl. using indxd array and intermediate obj for entry
		//ret.doc_counts.push(dc_entry); //same as above
		ret.lsList.push(ls);
	}
	streamTotals = ret;	
	callback(q4);
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
  
  //loads query definition from file 
  var queryJSON = require (JSONPath+'teols.json');
  
  queryJSON.aggregations.ls.histogram.interval = parseInt(navInterval);
  queryJSON.aggregations.ls.histogram.extended_bounds.min = 1;
  queryJSON.aggregations.ls.histogram.extended_bounds.max = qparam_lastLs;
  queryJSON.query.filtered.filter.prefix._id = 'run'+qparam_runNumber;
  queryJSON.query.filtered.query.range.ls.from = 1;
  queryJSON.query.filtered.query.range.ls.to = qparam_lastLs;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'eols',
    body : JSON.stringify(queryJSON)
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
	callback(q3);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1

q1(q2);

});//end callback

//callback 18
//queries runindex_cdaq/stream_label and populates a list with all stream names for a run
//(further filtering by ls interval is also possible to implement)
app.get('/node-f3mon/api/getstreamlist', function (req, res) {
console.log('received getstreamlist request');

var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
//var qparam_from = req.query.from;
//var qparam_to = req.query.to;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 124029;}
//if (qparam_from == null){qparam_from = 1;}
//if (qparam_to == null){qparam_to = 1;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

  var retObj = {
        "streamList" : []
  };

  var sendResult = function(){
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
       }
  var q = function(callback){
   var queryJSON = require (JSONPath+'streamlabel.json');

    queryJSON.query.bool.must[0].prefix._id = 'run'+qparam_runNumber;
    //queryJSON.query.filtered.query.range.ls.from = qparam_from;
    //queryJSON.query.filtered.query.range.ls.to = qparam_to;

    client.search({
     index: 'runindex_'+qparam_sysName+'_read',
     type: 'stream_label',
     body : JSON.stringify(queryJSON)
     }).then (function(body){
        var results = body.hits.hits; //hits for query
	var set = {};
	for (var i=0;i<results.length;i++){
		if (!set.hasOwnProperty(results[i]._source.stream)){
			retObj.streamList.push(results[i]._source.stream);
			set[results[i]._source.stream] = true;	//avoiding duplicates, if they occur
		}
	}
	callback();
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
}//end q

q(sendResult);
});//end callback

//initial configuration callback (edit values in config.json)
app.get('/node-f3mon/api/getConfig', function (req, res) {
  console.log('received getConfig request');

  var cb = req.query.callback;

  //loading configuration file
  var retObj = require (JSONPath+'config.json');
  res.set('Content-Type', 'text/javascript');
  res.send(cb +' ('+JSON.stringify(retObj)+')');

});

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
	excpEscES(res,error);
        console.trace(error.message);
  });
});//end idx-refr

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

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error)');
}

//escapes client hanging upon a nodejs code exception/error by sending http 500
var excpEscJS = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Nodejs error)');
}

//tester
app.get('/node-f3mon/api/testf', function (req, res) {
var finput = 'undef';
//col = percColor(req.query.c);
/*
var s = req.query.c;
if ((!(s.substr(0,3)==='DQM')&&(s!=='Error'))||(s==='DQMHistograms')){
                        res.send('passed');
                }else{res.send('failed');}
*/
res.send(finput);
});//end tester

//sets server listening for connections at port 3000
//var server = app.listen(3000);
//var server = app.listen(3000, function () {
var server = app.listen(80, function () {

 // test elasticsearch connection (test)
 client.ping();
 //client.cat.aliases({name: 'runindex*cdaq*'},function (error, response) { console.log(JSON.stringify(response.split('\n')));});
 
 //var host = server.address().address;
 //var host = '10.176.17.46';

 var port = server.address().port;
 console.log('Server listening at port:'+port);
 //console.log('Server listening at http://%s:%s', host, port);
 
 });
