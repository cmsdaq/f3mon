'use strict'; //all variables must be explicitly declared, be careful with 'this'
var tic = new Date().getTime();
//1.load modules
var express = require('express');
var php = require('node-php');
var http = require('http');
var elasticsearch = require('elasticsearch');

//2.command line parsing
//server listening port passes as an argument, otherwise it is by default 3000
var serverPort = 3002;
if (process.argv[2]!=null){
	serverPort = process.argv[2];
}
var owner=process.argv[3];

//unlimited number of simultaneous connections (default:5)
http.globalAgent.maxSockets=Infinity;

//3.init web content plugin
var app = express();
//old web
app.use("/sctest",php.cgi("web/ecd/sctest"));
app.use("/sc/php",php.cgi("web/sc/php"));
//app.use("/phpscripts",php.cgi("web/ecd/phpscripts"));
app.use("/ecd",php.cgi("web/ecd/ecd"));
app.use("/ecd-allmicrostates",php.cgi("web/ecd/ecd-allmicrostates"));
//app.use("/php-f3mon",php.cgi("web/ecd/php-f3mon"));
//app.use("/f3mon-test",php.cgi("web/ecd/f3mon-test"));
//static content
app.use(express.static('web'));


//4.setup elasticsearch client
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

//currently used only for checking cluster health
var clientESlocal = new elasticsearch.Client({
  host: 'es-local:9200',
  //log: 'trace'
  //log: 'debug'
  log : [{
	type : 'file', //outputs ES logging to a file in the app's directory
	levels : ['debug'] //can put more logging levels here
	}]
});


//5.redirecting console log to a file
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

//6.hook stderr and print unhandled (main loop) exceptions into a file
var stderrFS = fs.openSync('./stderr.log', 'a+');
var unhook_err = hook_writestream(process.stderr, function(string, encoding, fd) {
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

//7.intercept and log uncaught exceptions
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

//8.map of queries in JSON format
//this map is loaded with all queries (structure in JSON) at startup, then callbacks use these queries instead of launching independent I/Os in the json directory
var loadedJSONs = {};
//loads queries
var JSONPath = './src/json/'; //set in each deployment
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

//9.cache init
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

var totalTimes = {
	"queried" : 0,
	"cached" : 0
}

//10. load f3mon specific modules and define f3mon web callbacks
//F3Mon DB query module
var dbinfo = require('./dbinfo')
var smdb = require('./src/smdb')
smdb.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,dbinfo)

//redirect
app.get('/node-f3mon', function (req, res) {  res.redirect('/f3mon');});

//callback 1 (test)
app.get('/', function (req, res) {
  res.send('Hello World!');
});

//callback 2 (test)
app.get('/test', function (req, res) { setTimeout(function(){
    console.log("timeout expired");
    res.send('Hello World after sleep!');
  }, 10000);
  console.log("dispatched timeout");
});

//***F3MON CALLBACKS***
//callback 3
var esServerStatus = require('./src/esServerStatus')
esServerStatus.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes);
app.get('/f3mon/api/serverStatus', esServerStatus.query);

//callback 4
var esIndices = require('./src/esIndices')
esIndices.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes);
app.get('/f3mon/api/getIndices', esIndices.query);

//callback 5
var esDisksStatus = require('./src/esDisksStatus')
esDisksStatus.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("disks.json"));
app.get('/f3mon/api/getDisksStatus', esDisksStatus.query);

//callback 6
var esRunList = require('./src/esRunList')
esRunList.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes);
app.get('/f3mon/api/runList', esRunList.query);
app.get('/sc/api/runList', esRunList.query);

//callback 7
var esRunListTable = require('./src/esRunListTable')
esRunListTable.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("rltable.json"));
app.get('/f3mon/api/runListTable', esRunListTable.query);

//callback 8
var esRiverStatus = require('./src/esRiverStatus')
esRiverStatus.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("riverstatus.json"));
app.get('/f3mon/api/riverStatus', esRiverStatus.query);

//callback 9
var esRiverListTable = require('./src/esRiverListTable')
esRiverListTable.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("runrivertable-status.json"),getQuery("runrivertable-meta.json"));
app.get('/f3mon/api/runRiverListTable', esRiverListTable.query);
app.get('/sc/api/runRiverListTable', esRiverListTable.query);

//callback 10
var esCloseRun = require('./src/esCloseRun')
esCloseRun.setup(client);
app.get('/f3mon/api/closeRun', esCloseRun.query);

//callback 12
var esStartCollector = require('./src/esStartCollector');
esStartCollector.setup(client);
app.get('/f3mon/api/startCollector', esStartCollector.query);

//callback 12
var esLogTable = require('./src/esLogTable')
esLogTable.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("logmessages.json"));
app.get('/f3mon/api/logtable', esLogTable.query);

//callback 13
var esNstatesSummary = require('./src/esMicrostates');
esNstatesSummary.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("ulegenda.json"),getQuery("aggnstates.json"),getQuery("teolsminmax.json"))
app.get('/f3mon/api/nstates-summary', esNstatesSummary.query);

//callback 14
var esRunInfo = require('./src/esRunInfo');
esRunInfo.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("lastls.json"),getQuery("streamsinrun.json"));
app.get('/f3mon/api/runInfo', esRunInfo.query);
app.get('/sc/api/runInfo', esRunInfo.query);

//callback 15
var esMiniMacroPerStream = require('./src/esMiniMacroPerStream');
esMiniMacroPerStream.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("microperstream.json"),getQuery("minimacroperstream.json"),getQuery("teolsperstream.json"));
app.get('/f3mon/api/minimacroperstream', esMiniMacroPerStream.query); 

////callback 16
//var esMiniMacroPerBU = require('./src/esMiniMacroPerBU');
//esMiniMacroPerBU.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("minimacroperbu.json"),getQuery("teolsperbu.json"));
//app.get('/f3mon/api/minimacroperbu', esMiniMacroPerBU.query); 

//callback 16
var esMiniMacroPerHost = require('./src/esMiniMacroPerHost');
esMiniMacroPerHost.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("minimacroperbu.json"),getQuery("macroperhost.json"),getQuery("teolsperbu.json"),getQuery("teolsperstream.json"));
app.get('/f3mon/api/minimacroperhost', esMiniMacroPerHost.query); 

//callback 17
var esStreamHist = require('./src/esStreamHist');
esStreamHist.setup(f3MonCache,f3MonCacheSec,client,smdb,ttls,totalTimes,getQuery("minimacromerge.json"),getQuery("outls.json"),getQuery("teols.json"));
app.get('/f3mon/api/streamhist', esStreamHist.query); 

//callback 18
var esGetStreamList =  require('./src/esGetStreamList');
esGetStreamList.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("streamlabel.json"));
app.get('/f3mon/api/getstreamlist', esGetStreamList.query);

//callback 19
var esGetConfig =  require('./src/esGetConfig');
esGetConfig.setup(f3MonCache,f3MonCacheSec,client,ttls,totalTimes,getQuery("config.json"));
app.get('/f3mon/api/getConfig', esGetConfig.query);

//callback 20
var esBigPic =  require('./src/esBigPic');
esBigPic.setup(f3MonCache,f3MonCacheSec,client,clientESlocal,smdb,ttls,totalTimes,getQuery("config.json"));
app.get('/sc/api/bigPic', esBigPic.query);

//callback 21
app.get('/sc/api/teols', esBigPic.teols);
//***DB callbacks (TRANSFER STATUS and BIGPIC HWCFG)***

//callback 22
app.get('/sc/api/transfer', function (req, res) {
  smdb.runTransferQuery(req.query,req.connection.remoteAddress,res,true,null);
});

//callback 23
app.get('/sc/api/pp', function (req, res) {
  smdb.runPPquery(req.query, req.connection.remoteAddress,res,true,null);
});


//callback 22
var esSmallPic =  require('./src/esSmallPic');
esSmallPic.setup(f3MonCache,f3MonCacheSec,client,clientESlocal,smdb,ttls,totalTimes,getQuery("config.json"));
app.get('/sc/api/fuhistos', esSmallPic.fuhistos);





/*
//escapes client hanging upon a nodejs code exception/error by sending http 500
var excpEscJS = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Nodejs error)');
}
*/

//11. start http server
var server = app.listen(serverPort, function () {

   // test elasticsearch connection (test)
   client.ping();
   clientESlocal.ping();
   //client.cat.aliases({name: 'runindex*cdaq*'},function (error, response) { console.log(JSON.stringify(response.split('\n')));});
   var port = server.address().port;
   console.log('Server listening at port:'+port);
 
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


//12. start cache state logging
var statsLogger =  require('./src/statsLogger');
statsLogger.start(f3MonCache,totalTimes);


//log start time
var toc = new Date().getTime();
console.log('application startup time: '+(toc-tic)+' ms');


