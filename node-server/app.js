var tic = new Date().getTime();

'use strict'; //all variables must be explicitly declared, be careful with 'this'
var express = require('express');
var app = express();
var php = require('node-php');
var oracledb = require('oracledb'); //module that enables db access
oracledb.outFormat = oracledb.OBJECT //returns query result-set row as a JS object (equiv. to OCI_ASSOC param in php oci_fetch_array call)
oracledb.maxRows = 50000; //approx 2000 lumis x 25 streams
var http = require('http');
http.globalAgent.maxSockets=Infinity;

//old web
app.use("/sctest",php.cgi("web/ecd/sctest"));
app.use("/phpscripts",php.cgi("web/ecd/phpscripts"));
app.use("/ecd",php.cgi("web/ecd/ecd"));
app.use("/ecd-allmicrostates",php.cgi("web/ecd/ecd-allmicrostates"));
//app.use("/f3mon",php.cgi("web/ecd/f3mon"));
app.use("/php-f3mon",php.cgi("web/ecd/php-f3mon"));
app.use("/f3mon-test",php.cgi("web/ecd/f3mon-test"));

app.use(express.static('web'));

var elasticsearch = require('elasticsearch');

//server listening port passes as an argument, otherwise it is by default 3000
var serverPort = 3000;

if (process.argv[2]!=null){
	serverPort = process.argv[2];
}
var owner=process.argv[3];

var JSONPath = './web/f3mon/api/json/'; //set in each deployment
var ESServer = 'localhost';  //set in each deployment, if using a different ES service
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


//hook stderr and print unhandled (main loop) exceptions into a file
var stderrFS = fs.openSync('./stderr.log', 'a+');
unhook_err = hook_writestream(process.stderr, function(string, encoding, fd) {
		//fs.writeSync(stderrFS,string, encoding);
		fs.writeSync(stderrFS,string);
		});
function hook_writestream(stream, callback) {
	var old_write = stream.write;

	stream.write = (function(write) {
			return function(string, encoding, fd) {
			write.apply(stream, arguments);
			callback(string, encoding, fd);
			};
			})(stream.write);

	return function() {
		stream.write = old_write;
	};
}
var exceptionHandler = null;
var errCount=0;
process.on('uncaughtException', exceptionHandler = function(err) {
        var toc = new Date().toISOString();
	console.error('Caught fatal exception! Time: '+toc);
	console.error(err)
	console.error('Stack: '+err.stack)
        process.removeListener("uncaughtException", exceptionHandler);
	unhook_err();
	fs.closeSync(stderrFS);
        if (errCount<100) errCount=errCount+1;
        else throw err;
	});

//map of queries in JSON format
//this map is loaded with all queries (structure in JSON) at startup, then callbacks use these queries instead of launching independent I/Os in the json directory
var loadedJSONs = {};

//loads queries
var initializeQueries = function (){
	var namesArray = fs.readdirSync(JSONPath); //lists file name in json dir
	//console.log (JSON.stringify(namesArray));
	for (var i=0;i<namesArray.length;i++){
		var localObj = require (JSONPath+namesArray[i]);
		loadedJSONs[namesArray[i]] = localObj;
	}
	//console.log(JSON.stringify(loadedJSONs["teols.json"]));
}

//used by callbacks to retrieve queries stored in memory
var getQuery = function (name){
	return loadedJSONs[name];
}

initializeQueries(); //load query declarations in memory for faster access

//*Server Cache*
//each ES query response will be cached under a key of the form: requestName+"?"+first_arg_name+"="+first_arg_val+"&"+second_arg_name+"="+second_arg_val+...
//if args missing from the requesting url, then default arg values will be used (key is thus defined under the initial if statements of each callback)
//cache get(key) will return 'undefined' for missing or expired entry (expiration is determined by each callback's ttl, defined in ttls array) as of version 3.0.0 of node-cache
//if get(key) does not return 'undefined', then it returns the cached response
//any response, either cached or fresh, should be sent back including the *current* request's cb code (so NEVER cache the cb variable) 

//cache init
var NodeCache = require('node-cache');
var f3MonCache = new NodeCache(); //global cache container

//secondary cache holds expired objects with the same ttl while server executes queries
var f3MonCacheSec = new NodeCache();

f3MonCache.on("expired", function(key,obj){
	if (obj!=="requestPending"){
		f3MonCacheSec.set(key,obj,obj[1]);
	}
});

//ttls per type of request in seconds (this can also be loaded from a file instead of hardcoding)
var ttls = getQuery("ttls.json").ttls;

var toc = new Date().getTime();
console.log('application startup time: '+(toc-tic)+' ms');



//*F3MON CALLBACKS BELOW* (using Elasticsearch)

app.get('/node-f3mon', function (req, res) 
{
  res.redirect('/f3mon');
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
app.get('/f3mon/api/serverStatus', function (req, res) {
    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"serverStatus request");
    var eTime = new Date().getTime();
    var cb = req.query.callback;
    //console.log(cb);
    var requestKey = 'serverStatus';
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.serverStatus; //cached ES response ttl (in seconds) 

    if (requestValue=="requestPending"){
	requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      //query elasticsearch health and bind return function to reply to the server
      client.cluster.health().then(
       function(body) {
        //console.log(body['status']);
        var retObj = {'status':body['status']};
        f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
	totalTimes.queried += srvTime;
        console.log('serverStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(retObj)+')');

       }, function (err) {
        excpEscES(res,err);
        console.log(err.message);
       // res.send();
       }
      );
   }else{
	var srvTime = (new Date().getTime())-eTime;
	totalTimes.cached += srvTime;
        console.log('serverStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
   }


});//end callback

//callback 4
app.get('/f3mon/api/getIndices', function (req, res) {
    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"getIndices request");
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    var requestKey = 'getIndices';
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.getIndices; //cached ES response ttl (in seconds) 

    if (requestValue=="requestPending"){
        requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

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
        var retObj = {'list':aliasList};
        f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('getIndices (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(retObj)+')');
      },
      function(error) {
	excpEscES(res,error);
      console.log(error)
    });
   }else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('getIndices (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
   }
/*
    var cb = req.query.callback;
    client.search( {
      index : 'runindex*read',
      query
 
    }).then(
  */  
});//end callback

//callback 5
app.get('/f3mon/api/getDisksStatus', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getDisksStatus request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//loads query definition from file
//var queryJSON = require (JSONPath+'disks.json');
var queryJSON = getQuery("disks.json");

//GET query string params (needed to parameterize the query)
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;

//Setting default values for non-set request arguments
//the following check must not check types because non-set URL arguments are in fact undefined, rather than null valued
//therefore (nonset_arg == null) evaluates to Boolean TRUE, but (nonset_arg === null) is FALSE, which means that unset args DO NOT have null value (this pattern is used in most callbacks below)
if (qparam_runNumber == null){qparam_runNumber = 36;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}


var requestKey = 'getDisksStatus?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.getDisksStatus; //cached ES response ttl (in seconds) 

if (requestValue=="requestPending"){
 requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);

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
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('getDisksStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
	res.send(cb +  ' (' +JSON.stringify(retObj)+')');
	 }, function (error){
	excpEscES(res,error);
	console.trace(error.message);
	});//end  client.search(...)
}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('getDisksStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback


//callback 6
app.get('/f3mon/api/runList', function (req, res){
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runList request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//loads query definition from file
//var queryJSON = require (JSONPath+'runlist.json');
var queryJSON = getQuery("runlist.json");

//GET query string params
var qparam_from = req.query.from;
var qparam_to = req.query.to;
var qparam_size = req.query.size;
var qparam_sysName = req.query.sysName;
if (qparam_from == null){qparam_from = 0;}
if (qparam_to == null){qparam_to = 'now';}
if (qparam_size == null){qparam_size = 1000;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var requestKey = 'runList?from='+qparam_from+'&to='+qparam_to+'&size='+qparam_size+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.runList; //cached ES response ttl (in seconds)

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}


if (requestValue == undefined) {
  f3MonCache.set(requestKey, "requestPending", ttl);

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
		f3MonCache.set(requestKey, ["empty",ttl], ttl);
		var srvTime = (new Date().getTime())-eTime;
        	totalTimes.queried += srvTime;
                console.log('runList (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
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
		f3MonCache.set(requestKey, [retObj,ttl], ttl);
                var srvTime = (new Date().getTime())-eTime;
                totalTimes.queried += srvTime;
        	console.log('runList (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
		res.set('Content-Type', 'text/javascript');
		res.send(cb +' ('+JSON.stringify(retObj)+')');

	}
	},function (error){
	excpEscES(res,error);
        console.trace(error.message);
	});

}else{	
        var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
     	console.log('runList (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
	if (requestValue[0] === "empty"){
      		res.send();
	}else{
		res.set('Content-Type', 'text/javascript');
                res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
	}
}


});//end callback


//callback 7
app.get('/f3mon/api/runListTable', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runListTable request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//loads query definition from file
//var queryJSON = require (JSONPath+'rltable.json');
var queryJSON = getQuery("rltable.json");

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

var requestKey = 'runListTable?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy+'&sortOrder='+qparam_sortOrder+'&search='+qparam_search+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.runListTable; //cached ES response ttl (in seconds)


if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
  f3MonCache.set(requestKey, "requestPending", ttl);

  //console.log(qparam_sortBy);
  //parameterize query fields
  queryJSON.size =  qparam_size;
  queryJSON.from = qparam_from;

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

  if (qparam_search != ''){
	var searchText = qparam_search;
	if (qparam_search.indexOf("*") === -1){
		searchText = '*'+qparam_search+'*';
	}
	qsubmitted["filter"] = {"query":
				{"query_string":
				 {"query": searchText}}};
  }else{
	delete qsubmitted["filter"];
  }
  //console.log(JSON.stringify(qsubmitted));
 
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
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
        var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('runListTable (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
	}, function (error){
	excpEscES(res,error);
	console.trace(error.message);
	});

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('runListTable (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}



});//end callback

//callback 8
app.get('/f3mon/api/riverStatus', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'riverStatus request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_size = req.query.size;
var qparam_query = req.query.query;
if (qparam_size == null){qparam_size = 100;}
if (qparam_query == null){qparam_query = 'riverstatus';}

var requestKey = 'riverStatus?size='+qparam_size+'&query='+qparam_query;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.riverStatus; //cached ES response ttl (in seconds)

//loads query definition from file
//var queryJSON = require (JSONPath+qparam_query+'.json');
var queryJSON = getQuery(qparam_query+".json");
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
	  f3MonCache.set(requestKey, [retObj,ttl], ttl);
	  var srvTime = (new Date().getTime())-eTime;
          totalTimes.queried += srvTime;
	  console.log('riverStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.set('Content-Type', 'text/javascript');
          res.send(cb +' ('+JSON.stringify(retObj)+')');
	}

        prepareLookup(); //initial caller

  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
}//end q2

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {

  f3MonCache.set(requestKey, "requestPending", ttl);

  //chaining of the two queries (output of Q1 is combined with Q2 hits to form the response) 
  //q1 is executed and then passes to its callback, q2
  q1(q2);
}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
	console.log('riverStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}
});//end callback

//callback 9
app.get('/f3mon/api/runRiverListTable', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runRiverListTable request');
var eTime = new Date().getTime();
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

var requestKey = 'runRiverListTable?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy+'&sortOrder='+qparam_sortOrder;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.runRiverListTable; //cached ES response ttl (in seconds)


var sendResult = function(){
   f3MonCache.set(requestKey, [retObj,ttl], ttl);
   var srvTime = (new Date().getTime())-eTime;
   totalTimes.queried += srvTime;
   console.log('runRiverListTable (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
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

  //var queryJSON = require (JSONPath+'runrivertable-status.json');
  var queryJSON = getQuery("runrivertable-status.json");
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

  //var queryJSON = require (JSONPath+'runrivertable-meta.json');
  var queryJSON = getQuery("runrivertable-meta.json");

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

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
  f3MonCache.set(requestKey, "requestPending", ttl);

  //chaining of the two queries (output of Q1 is combined with Q2 hits to form the response) 
  //q1 is executed and then passes to its callback, q2
  q1(q2);
}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
	console.log('runRiverListTable (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback


//callback 10
app.get('/f3mon/api/closeRun', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'closeRun request');

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
 //var queryJSON = require (JSONPath+qparam_query+'.json');
 var queryJSON = getQuery(qparam_query+".json");
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
app.get('/f3mon/api/logtable', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'logtable request');
var eTime = new Date().getTime();
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
if (qparam_sysName == null || qparam_sysName == 'false'){qparam_sysName = 'cdaq';}

var requestKey = 'logtable?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy+'&sortOrder='+qparam_sortOrder+'&search='+qparam_search+'&startTime='+qparam_startTime+'&endTime='+qparam_endTime+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.logtable; //cached ES response ttl (in seconds)

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}


if (requestValue == undefined) {
  f3MonCache.set(requestKey, "requestPending", ttl);

  //loads query definition from file
  //var queryJSON = require (JSONPath+'logmessages.json');
  var queryJSON = getQuery("logmessages.json");

  //parameterize query
  queryJSON.size = qparam_size;
  queryJSON.from = qparam_from;
  queryJSON.query.filtered.filter.and[0].range._timestamp.from = qparam_startTime;
  queryJSON.query.filtered.filter.and[0].range._timestamp.to = qparam_endTime;

  if (qparam_search != ''){
	var searchText = '';
	if (qparam_search.indexOf("*") === -1){
                searchText = '*'+qparam_search+'*';
        }else{
                searchText = qparam_search;
        }
	queryJSON.query.filtered.query.bool.should[0].query_string.query = searchText;
  }else{
	queryJSON.query.filtered.query.bool.should[0].query_string.query = '*';
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
   index: 'hltdlogs_'+qparam_sysName+'_read',
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
		f3MonCache.set(requestKey, [retObj,ttl], ttl);
		var srvTime = (new Date().getTime())-eTime;
                totalTimes.queried += srvTime;
   		console.log('logtable (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
		res.set('Content-Type', 'text/javascript');
		res.send(cb +' ('+JSON.stringify(retObj)+')');

	}                  
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('logtable (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback


//callback 12
app.get('/f3mon/api/startCollector', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'startCollector request');

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
        source = results[0]._source; //throws cannot read property error if result list is empty (no hits found) because results[0] is undefined 
        if (source == null || !source){
                res.send();
        }else{
                source["role"] = 'collector';
                source["runNumber"] = qparam_runNumber;
                source["startsBy"] = 'Web Interface';
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
app.get('/f3mon/api/nstates-summary', function (req, res) {
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
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.nstatesSummary; //cached ES response ttl (in seconds)


var retObj = {
                "lastTime" : null,
                "timeList" : null,
                "data" : ""
        };

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
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
  //loads query definition from file
  //var queryJSON = require (JSONPath+'ulegenda.json');
  var queryJSON = getQuery("ulegenda.json");
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
  //var queryJSON = require (JSONPath+'nstates.json');
  var queryJSON = getQuery("nstates.json");
  queryJSON.query.bool.must[1].range._timestamp.from = 'now-'+qparam_timeRange+'s';
  queryJSON.query.bool.must[0].term._parent = qparam_runNumber;

  client.search({
  index: 'runindex_'+qparam_sysName+'_read',
  type: ustatetype,
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
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });


}//end q2

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);

 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('nstates-summary (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}


});//end callback


//callback 14
app.get('/f3mon/api/runInfo', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runInfo request');
var eTime = new Date().getTime();
var cb = req.query.callback;

//GET query string params
var qparam_runNumber = req.query.runNumber;
var qparam_sysName = req.query.sysName;

if (qparam_runNumber == null){qparam_runNumber = 700032;}
if (qparam_sysName == null){qparam_sysName = 'cdaq';}

var requestKey = 'runInfo?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.runInfo; //cached ES response ttl (in seconds)


var retObj = {};

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('runInfo (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//last LS number
var q3 = function (callback){

//var queryJSON = require (JSONPath+'lastls.json');
var queryJSON = getQuery("lastls.json");
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
//var queryJSON = require (JSONPath+'streamsinrun.json'); //changed the Apache/PHP version, now implements aggregation instead of faceting
var queryJSON = getQuery("streamsinrun.json");
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
 //var queryJSON = require (JSONPath+'runinfo.json');
  var queryJSON = getQuery("runinfo.json");
  queryJSON.filter.term._id = qparam_runNumber;

  client.search({
    index: 'runindex_'+qparam_sysName+'_read',
    type: 'run',
    body : JSON.stringify(queryJSON)
    }).then (function(body){
        var results = body.hits.hits; //hits for query
	retObj = results[0]._source; 	//throws cannot read property error if result list is empty (no hits found) because results[0] is undefined
	callback(q3);
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);

 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('runInfo (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback

//callback 15
app.get('/f3mon/api/minimacroperstream', function (req, res) {
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

var requestKey = 'minimacroperstream?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&type='+qparam_type;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.minimacroperstream; //cached ES response ttl (in seconds)


var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('minimacroperstream (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get minimerge
var q2 = function(callback, total_q1){
  
   //loads query definition from file 
   //var queryJSON = require (JSONPath+'minimacroperstream.json');
   var queryJSON = getQuery("minimacroperstream.json");

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
  //var queryJSON = require (JSONPath+'teolsperstream.json');
  var queryJSON = getQuery("teolsperstream.json");
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

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);
 
 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('minimacroperstream (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback

//callback 16
app.get('/f3mon/api/minimacroperbu', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'minimacroperbu request');
var eTime = new Date().getTime();
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

var requestKey = 'minimacroperbu?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&stream='+qparam_stream+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&type='+qparam_type;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.minimacroperbu; //cached ES response ttl (in seconds)


var streamListArray;
var inner = [];
var retObj = {
	"percents" : inner
};

var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('minimacroperbu (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get mini or macro merge
var q2 = function (callback,totals_q1){

  //loads query definition from file 
  //var queryJSON = require (JSONPath+'minimacroperbu.json');
  var queryJSON = getQuery("minimacroperbu.json");
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

        mykeys = [];
        for (var mykey in totals_q1) {
          if (totals_q1.hasOwnProperty(mykey)) {
            mykeys.push(mykey);
          }
        }
        mykeys.sort();
        var keylen = mykeys.length;
        for (var i = 0; i < keylen; i++) {
          var buname = mykeys[i];
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
 // var queryJSON = require (JSONPath+'teolsperbu.json');
  var queryJSON = getQuery("teolsperbu.json");

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

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl);
 
 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('minimacroperbu (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback

//callback 17
app.get('/f3mon/api/streamhist', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'streamhist request');
var eTime = new Date().getTime();
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

var requestKey = 'streamhist?runNumber='+qparam_runNumber+'&from='+qparam_from+'&to='+qparam_to+'&lastLs='+qparam_lastLs+'&intervalNum='+qparam_intervalNum+'&sysName='+qparam_sysName+'&streamList='+qparam_streamList+'&timePerLs='+qparam_timePerLs+'&useDivisor='+qparam_useDivisor;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.streamhist; //cached ES response ttl (in seconds)

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
        "micromerge" : "",
        "minimerge" : "",
	"macromerge" : "",
	"transfer" : "",
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

	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('streamhist (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
}

//Get transfer (from cache only)
var q6 = function (callback) {

  var lsList = streamTotals.lsList;
  if( lsList.length==0) {callback();return;}

  var trReqObj = {"run": qparam_runNumber, "binary":true , "aggregate":true}
  var transferInfo = runTransferQuery(trReqObj,'internal-f3mon',null,false);
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
    callback();
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
  callback();

}

//Get macromerge
var q5 = function (callback){
	//loads query definition from file
        //var queryJSON = require (JSONPath+'minimacromerge.json');
	var queryJSON = getQuery("minimacromerge.json");

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
		callback(); //sendResult()
                //uncomment instead of previous for transfer completeness strip (here and in q4)
		//callback(sendResult); //q6(sendResult)
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q5


//Get minimerge
var q4 = function (callback){
	//loads query definition from file
       // var queryJSON = require (JSONPath+'minimacromerge.json');
	var queryJSON = getQuery("minimacromerge.json");

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
		callback(sendResult); // q5(sendResult)
                //uncomment instead of previous for stream completeness info (here and in q5)
		//callback(q6); //q5(q6)
	}, function (error){
		excpEscES(res,error);
        	console.trace(error.message);
  	 });

}//end q4


//Get stream out
var q3 = function (callback){
	//loads query definition from file
	//var queryJSON = require (JSONPath+'outls.json');
	var queryJSON = getQuery("outls.json");

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
			"fileSize" : []//,
			//"pMicro" : [],
		};
		streamData.streamList.push(streams[i].key);
		
		var lsList = streams[i].inrange.ls.buckets;
		for (var j=0;j<lsList.length;j++){
			var ls = lsList[j].key+postOffSt;
			var total = streamTotals.events[ls];
			var doc_count = streamTotals.doc_counts[ls];

                        if (totSumIn[ls]==null) {
                          totSumIn[ls]=0;
                          totSumError[ls] = 0;
                        }
			
			//rounding with 2 dp precision
			var inval = Math.round(100*lsList[j].in.value)/100;
			var outval = Math.round(100*lsList[j].out.value)/100;
			var fsval = Math.round(100*lsList[j].filesize.value)/100;
			var errval =0;
                        if (lsList[j].error!=undefined)
                          errval = Math.round(100*lsList[j].error.value)/100;

                        //for total %
                        totSumIn[ls] += inval;
                        totSumError[ls] += errval;

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
                                percentProc = Math.round(pnoerr*100)/100;
			}

			//output
			if (qparam_timePerLs>1){
				outval = Math.round((outval/qparam_timePerLs)*100)/100;
				fsval = Math.round((fsval/qparam_timePerLs)*100)/100;
			}
			
			var d = {"x":ls,"y":outval, 'p':percentProc}; 
			var f = {"x":ls,"y":fsval, 'p':percentProc};
			//var p = {"x":ls,"y":percent};
			//var pproc = {"x":ls,"y":percent};
			sout.dataOut.push(d);
			sout.fileSize.push(f);
			//sout.pMicro.push(pproc);

		}//end for j
		streamData.data.push(sout);			
	}//end for i

        
        var micromerge = {
			"percents" : [],
			"took" : body.took
	};
		
	var lsList = streamTotals.lsList;
		
	for (var i=0;i<lsList.length;i++){
		var ls = lsList[i];
		var processed = totSumIn[ls];
                if (processed == undefined) processed=0;
		var err = totSumError[ls];
                if (err == undefined) err=0;
		var total = streamTotals.events[ls]*nStreamsMicro;
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
			percent = Math.round(p*100)/100;
		}
		var color = percColor2(percent,err>0);
                if (total==0) color = "palegreen";

		var entry = {
			"x" : ls,
			"y" : percent,
			"color" : color
		};
		micromerge.percents.push(entry);
        }

	retObj.streams = streamData;
	retObj.took = took;
	retObj.micromerge = micromerge;
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
	
	callback(q5); //q4(q5)
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
   });

}//end q3

//Get totals
var q2 = function (callback){
  //loads query definition from file
  //var queryJSON = require (JSONPath+'teols.json');
  var queryJSON = getQuery("teols.json");

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
		var ls = buckets[i].key + postOffSt;
                var events = buckets[i].events.value;
		var doc_count = buckets[i].doc_count;
		ret.events[ls] = events;
		ret.doc_counts[ls] = doc_count;
		//ret.events.push(ev_entry);	//old impl. using indxd array and intermediate obj for entry
		//ret.doc_counts.push(dc_entry); //same as above
		ret.lsList.push(ls);
	}
	streamTotals = ret;	
	callback(q4); //q3(q4)
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
  //var queryJSON = require (JSONPath+'teols.json');
  var queryJSON = getQuery("teols.json");  

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
	callback(q3); //q2(q3)
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });

}//end q1

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
 f3MonCache.set(requestKey, "requestPending", ttl); 

 q1(q2); //call q1 with q2 as its callback

}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('streamhist (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback

//callback 18
//queries runindex_cdaq/stream_label and populates a list with all stream names for a run
//(further filtering by ls interval is also possible to implement by using the 'from' and 'to' arguments)
app.get('/f3mon/api/getstreamlist', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getstreamlist request');
var eTime = new Date().getTime();
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

var requestKey = 'getstreamlist?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;
var requestValue = f3MonCache.get(requestKey);
var ttl = ttls.getstreamlist; //cached ES response ttl (in seconds)

  var retObj = {
        "streamList" : []
  };

  var sendResult = function(){
	f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('getstreamlist (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.send(cb +' ('+JSON.stringify(retObj)+')');
       }
  var q = function(callback){
   //var queryJSON = require (JSONPath+'streamlabel.json');
   var queryJSON = getQuery("streamlabel.json");
   
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

if (requestValue=="requestPending"){
  requestValue = f3MonCacheSec.get(requestKey);
}

if (requestValue == undefined) {
	f3MonCache.set(requestKey, "requestPending", ttl);

 	q(sendResult);
}else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
        console.log('getstreamlist (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
}

});//end callback

//initial configuration callback (edit values in config.json)
//if the configuration is loaded from Elasticsearch, this callback can also be changed into a cacheable callback in the same fashion as the previous ones
app.get('/f3mon/api/getConfig', function (req, res) {
  console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'received getConfig request');
 // var eTime = new Date().getTime();
  var cb = req.query.callback;

  //loading configuration file
  //var retObj = require (JSONPath+'config.json');
  var retObj = getQuery("config.json");

  res.set('Content-Type', 'text/javascript');
  res.send(cb +' ('+JSON.stringify(retObj)+')');

});

/*
//idx refresh for one index
app.get('/f3mon/api/idx-refr', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'idx-refr request');

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

//get server cache usage statistics
app.get('/f3mon/api/getcachestats', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getcachestats request');
var cb = req.query.callback;

var qparam_token = req.query.token;
var acceptToken = 'randomPlainTextKey';

if (qparam_token == acceptToken){
  var retObj = {"server_cache_statistics":f3MonCache.getStats()};
  //retObj["keys"] = f3MonCache.keys(); //appends list of keys in the response
  //retObj["pairs"] = f3MonCache.mget(f3MonCache.keys()); //appends full cache pairs
  res.set('Content-Type', 'text/javascript');
  res.send(cb +' ('+JSON.stringify(retObj)+')');
}else{
  res.send('not allowed request');
}

});//end getcachestats

//flush server cache
app.get('/f3mon/api/freesomespace', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'freesomespace request');
var cb = req.query.callback;
var qparam_token = req.query.token;
var acceptToken = 'anotherRandomPlainTextKey';

if (qparam_token == acceptToken){
  var retObj = {"current stats":f3MonCache.getStats()};
  f3MonCache.flushAll();
  retObj["new stats"] = f3MonCache.getStats();
  res.set('Content-Type', 'text/javascript');
  res.send(cb +' ('+JSON.stringify(retObj)+')');
}else{
  res.send('not allowed request');
}

});//end freesomespace
*/

//*SC CALLBACKS BELOW* (using Oracle DB)

//callback 1: transfer
app.get('/sc/api/transfer', function (req, res) {
  runTransferQuery(req.query,req.connection.remoteAddress,res,true);
});

var runTransferQuery = function (reqQuery, remoteAddr, res, reply) {
 //params definition
 eTimeT = new Date().getTime();
 var fill=0;
 var cb = reqQuery.callback;
 var run = reqQuery.run;
 var stream = reqQuery.stream;
 var xaxis = reqQuery.xaxis;
 var formatchart = reqQuery.chart;
 var formatstrip = reqQuery.strip;
 var formatbinary = reqQuery.binary;
 var nonblocking = reqQuery.nonblocking;
 var aggregate = reqQuery.aggregate

 if (aggregate!==null) stream = null;

 var requestKey = 'sc_transfer?run='+run+'&stream='+stream+'&xaxis='+xaxis+'&formatchart='+formatchart+'&formatstrip='+formatstrip;
 var requestValue = f3MonCache.get(requestKey);
 var ttl = ttls.sctransfer; //cached db response ttl (in seconds)
 //var reply=doreply;
  

 var getFromDB = function(){ 
  var retObj; //request formatted response
  var sendResult = function(){
     f3MonCache.set(requestKey, [retObj,ttl], ttl);
     var srvTime = (new Date().getTime())-eTimeT;
     totalTimes.queried += srvTime;
     console.log('sc_transfer (src:'+remoteAddr+')>responding from query (time='+srvTime+'ms)');
     if (!reply) return;
     res.set('Content-Type', 'text/javascript');
     //res.send(cb +' ('+JSON.stringify(retObj)+')'); //f3mon response format
     if (cb === undefined)
       res.send(JSON.stringify(retObj));
     else
       res.send(cb +' ('+JSON.stringify(retObj)+')');
  }

  var suffix;
  if (stream == null){
    if (aggregate)
      suffix = " ORDER BY LUMISECTION ASC, STREAM ASC";
    else
      suffix = " ORDER BY STREAM ASC, LUMISECTION ASC";
  }else{
    suffix = " AND STREAM like '%"+stream+"%'";
  }

  var exec = function (){
    //connection and query to Oracle DB
    oracledb.getConnection(
    {
       user          : "CMS_DAQ2_HW_CONF_R",
       password      : "mickey2mouse",	//change this before any git push!
       connectString : "cmsonr1-v.cms:10121/cms_rcms.cern.ch"
    },
    function(err, connection)
    {
    	if (err) {
        	console.error(err.message);
		//equiv to (if (!$conn), err at oci_connect)
		excpEscOracle(res,err);
    		return;
    	}

    connection.execute(
      "select LUMISECTION,STREAM,"+
      "CTIME as CREATIME,"+
       "inj.ITIME as INJTIME,"+
       "inj.FILESIZE as FILESIZE,"+
       "new.ITIME as NEWTIME,"+
       "cop.ITIME as COPYTIME,"+
       "chk.ITIME as CHKTIME,"+
       "ins.ITIME as INSTIME,"+
       "rep.ITIME as REPACKTIME,"+
       "del.DTIME as DELTIME  "+
       "FROM CMS_STOMGR.FILES_CREATED files                     "+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_INSERTED ins using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_NEW new using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_COPIED cop using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_REPACKED rep using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_CHECKED chk using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_DELETED del using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_INJECTED inj using (FILENAME)"+
       "where files.RUNNUMBER=:runnumber"+suffix,
       {'runnumber':run},
     	function(err, result){
    		if (err) {
      		  console.error(err.message);
		  //equiv to (if (!$r), err at oci_execute)
		  excpEscOracle(res,err);
      		  return;
   		}
    		//console.log(result.rows);

		//assumes associative array rows (oracledb outformat set to OBJECT rather than ARRAY)
		var tuples = result.rows;

			retObj = [
			];

		if (aggregate!=null){
                        var ls = 0;
                        var lsobj = undefined;
                        for (var i=0;i<tuples.length;i++){
                                var tls = tuples[i].LUMISECTION;
				var copied = tuples[i].COPYTIME;

                                //stream = tuples[i].STREAM;
                                if (tls>ls) {
                                  if (lsobj!==undefined) {
                                    //normalized by number of streams
                                    //retObj.comp = retObj.copy / retObj.s;
                                    retObj.push(lsobj);
                                    lsobj = undefined;
                                  }
                                  lsobj = {"ls":tls,"copy":(copied!==null), "s":1};// "comp":0}
                                  ls=tls;
                                }
                                if (tls<ls) {
                                  console.log('should not be here, rows unsorted by lumisection in reply from DB')
                                }
                                else {
                                  lsobj.copy = lsobj.copy + (copied!==null);
                                  lsobj.s++;
                                  if (i===tuples.length-1) {
                                    //retObj.comp = retObj.cop / retObj.s;
                                    retObj.push(lsobj);
                                    lsobj = undefined;
                                  }
                                }
                        }
                }
		//review? maybe conditions below if precisely mapped to the php code conditions
		else if (formatchart!=null){	
			retObj = {
				"params": null,
				"serie1": null,
				"serie2": null
			};
                        var transtimes = [];
                        var bandwidth = [];
			var strms = {};
                        for (var i=0;i<tuples.length;i++){
				var copytime = (Date.parse(tuples[i].COPYTIME)-Date.parse(tuples[i].INJTIME))/1000;
				if (!strms.hasOwnProperty(tuples[i].STREAM)){
                                                strms[tuples[i].STREAM] = true;
						transtimes.push({"name":tuples[i].STREAM, "data":[]});
						bandwidth.push({"name":tuples[i].STREAM, "data":[]});
                                }
				var t;
				var b;
				if (xaxis!='size'){
					t = [parseInt(tuples[i].LUMISECTION),copytime];
					b = [parseInt(tuples[i].LUMISECTION),tuples[i].FILESIZE/copytime/1024/1024];
					transtimes[transtimes.length-1].data.push(t);
					bandwidth[transtimes.length-1].data.push(b);
				}else{
					t = [parseInt(tuples[i].FILESIZE),copytime];
                                        b = [parseInt(tuples[i].FILESIZE),tuples[i].FILESIZE/copytime/1024/1024];
                                        transtimes[transtimes.length-1].data.push(t);
                                        bandwidth[transtimes.length-1].data.push(b);
				}
			}
			retObj.params = {"xaxis":(xaxis==undefined) ? null : xaxis}; //assigning a null value to a non-set arg, initially undefined
                        retObj.serie1 = transtimes;
                        retObj.serie2 = bandwidth;
		}else if (formatstrip==null){
			for (var i=0;i<tuples.length;i++){
				var creatime = Date.parse(tuples[i].CREATIME);
				tuples[i].CREATIME = (new Date(creatime)).toUTCString(); //friendlier format
				tuples[i].INJTIME = (Date.parse(tuples[i].INJTIME)-creatime)/1000; //in seconds
				tuples[i].NEWTIME = (Date.parse(tuples[i].NEWTIME)-creatime)/1000;
				tuples[i].COPYTIME = (Date.parse(tuples[i].COPYTIME)-creatime)/1000;
				tuples[i].CHKTIME = (Date.parse(tuples[i].CHKTIME)-creatime)/1000;
				tuples[i].INSTIME = (Date.parse(tuples[i].INSTIME)-creatime)/1000;
				tuples[i].REPACKTIME = (Date.parse(tuples[i].REPACKTIME)-creatime)/1000;
				tuples[i].DELTIME = (Date.parse(tuples[i].DELTIME)-creatime)/1000;
				tuples[i]["COPYBW"] = tuples[i].FILESIZE/(tuples[i].COPYTIME-tuples[i].INJTIME);
			}
			//send reformatted tuples as response
                        retObj = tuples;
		}else{
			var stat = [];
			var streams = {};
			for (var i=0;i<tuples.length;i++){
				if (!streams.hasOwnProperty(tuples[i].STREAM)){
						streams[tuples[i].STREAM] = true;
						var o = {};
						o[tuples[i].STREAM] = {};
						stat.push(o);
				}
				if (formatbinary!=null){
					if (tuples[i].COPYTIME!=null){
						stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = 1;
					}else{
						stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = 0;
					}
				}
				
				if (tuples[i].INJTIME != null){
					stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "INJECTED";
				}
				if (tuples[i].NEWTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "NEW";
                                }
				if (tuples[i].COPYTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "COPIED";
                                }
				if (tuples[i].CHKTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "CHECKED";
                                }
                                if (tuples[i].INSTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "INSERTED";
                                }
                                if (tuples[i].REPACKTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "REPACKED";
                                }
				if (tuples[i].DELTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "DELETED";
                                }		
			}
			retObj = stat;	
		}
		sendResult(); 
	
     });
    }); //end oracle access
  }//end exec

  if (run!=undefined){
        exec();
  }else{
	//run ES query and then call exec() in its callback
	var queryJSON = {
	"size":1,
	"sort":{"startTime":"desc"}
	};
    client.search({
     index: 'runindex_cdaq_read',
     type: 'run',
     body : JSON.stringify(queryJSON)
     }).then (function(body){
        var results = body.hits.hits; //hits for query
	var resp = {};
	resp["started"] = results[0]["_source"]["startTime"];
	if (results[0]["_source"].hasOwnProperty("endTime")){
		resp["ended"] = results[0]["_source"]["endTime"];
	}else{
		resp["ended"] = "";
	}
	resp["number"] = results[0]["_source"]["runNumber"];
	run = (run==undefined) ? resp["number"] : run;
	
	exec();
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
	
  }

 }//end getFromDB

  if (requestValue=="requestPending"){
  	requestValue = f3MonCacheSec.get(requestKey);
  }

  if (requestValue == undefined){
	f3MonCache.set(requestKey, "requestPending", ttl);
        if (!reply) {
	  getFromDB();
          return null;
        }
        else {
          if (nonblocking !== undefined) {
            res.set('Content-Type', 'text/javascript');
            if (cb === undefined)
              res.send(JSON.stringify({}));
            else
              res.send(cb +' ('+JSON.stringify({})+')');
         
             reply=false;
          }
        }
	getFromDB();
  }else{
        if (!reply) {
          return requestValue[0];
        }
        else {
          var srvTime = (new Date().getTime())-eTimeT;
          totalTimes.cached += srvTime;
          console.log('sc_transfer (src:'+remoteAddr+')>responding from cache (time='+srvTime+'ms)');
          res.set('Content-Type', 'text/javascript');
          //res.send(cb + ' (' + JSON.stringify(requestValue)+')');  //f3mon format
          if (cb === undefined)
	    res.send(JSON.stringify(requestValue[0]));
          else
            res.send(cb +' ('+JSON.stringify(requestValue[0])+')');
        }
  }

}//end calback











//*HELPER FUNCTIONS BELOW* (used by app callbacks above and for the server settings)


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


//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

//escapes client hanging upon an Oracle DB request error by sending http 500
var excpEscOracle = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Oracle DB query error during the request execution, an admin should seek further info in the logs)');
}

//escapes client hanging upon a nodejs code exception/error by sending http 500
var excpEscJS = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Nodejs error)');
}

//sets server listening for connections at port 3000
//var server = app.listen(3000);
//var server = app.listen(3000, function () {
var server = app.listen(serverPort, function () {

 // test elasticsearch connection (test)
 client.ping();
 //client.cat.aliases({name: 'runindex*cdaq*'},function (error, response) { console.log(JSON.stringify(response.split('\n')));});
 
 //var host = server.address().address; //address can also be hardcoded 

 var port = server.address().port;
 console.log('Server listening at port:'+port);
 //console.log('Server listening at http://%s:%s', host, port);
 
//dropping priviledges if server was started by root
 if (process.getuid()==0){
        console.log('current owner:'+process.getuid()+' (root)');   
        console.log('dropping to owner:'+owner);
        process.setgid('es-cdaq');
        process.setuid(owner);
        console.log('new owner:'+process.getuid()+' in group:'+process.getgid());
 }else{
        console.log('current owner:'+process.getuid()+'\n(no drop needed)');
 }

 });

//cumulative time of requests serving in milliseconds
var totalTimes = {
	"queried" : 0,
	"cached" : 0
}

//dev helper for cache statistics
var stats_file = fs.createWriteStream('./cache_statistics.txt', {flags : 'a'});
var times_file = fs.createWriteStream('./service_times.txt', {flags : 'a'});

var cachestatslogger = function (){
	var outObj = {
		"time" : new Date().toUTCString(),
		"stats" : f3MonCache.getStats()
	};
	stats_file.write(util.format(JSON.stringify(outObj)+'\n'));
	times_file.write(util.format(JSON.stringify(totalTimes)+'\n'));
	console.log('-Wrote out cache statistics -------------------------------------------------------------------------------------------------');	
}
cachestatslogger(); //run once at the beggining
setInterval(cachestatslogger, 30000); //async call: runs cachestatslogger every 30 seconds, writing out a statistics entry

