'use strict'; //all variables must be explicitly declared, be careful with 'this'
var tic = new Date().getTime();
//1.load modules
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var php = require('node-php');
var http = require('http');
var elasticsearch = require('elasticsearch');

var heapdump = require('heapdump');
//compression
var compression=require('compression');


//1.a check if running on es-local.cms where it should be disabled
var dns = require('dns')
var os = require('os')

dns.resolve('es-local.cms',function(err, addresses) {
  if (err) console.log(err);
  else {
    //console.log(addresses);
    dns.lookup(os.hostname(),function (err, add, fam) {
      addresses.forEach(function(item) {
        if (item == add) {
          console.log('service is disabled on es-local.cms')
          process.exit(0)
        }
      });
    });
  }
});

//2.command line parsing
//server listening port passes as an argument, otherwise it is by default 3000
var serverPort = 3002;
if (process.argv[2]!=null){
	serverPort = process.argv[2];
}
global.serverPort = serverPort;

//should be the name in in 'ps'
process.title = 'app.js.'+serverPort;

var owner=process.argv[3];

global.log_dir = process.argv[4]||".";

global.verbose = process.argv[5]|0;

global.bulk_buffer = []

//unlimited number of simultaneous connections (default:5)
http.globalAgent.maxSockets=Infinity;


var priv_access=false;
var override_secure=false;
//based on instance port
if  (serverPort==8080 || serverPort==8040 || override_secure) priv_access=true;

//3.init web content plugin
var app = express();

var compress_all=true;
if (!priv_access) {
  if (compress_all) app.use(compression());
  else {
    app.use(compression({filter: shouldCompress}))
    function shouldCompress (req, res) {
      if (compress_all) return true;
      //if (serverPort==4000) return true;
      if (req.headers['f3mon-no-compression']) {
        return false;
      }
      //custom: compression required
      if (req.headers['f3mon-compression']) {
        return true;
      }
      //separate static from dynamic URLs
      if (req.url.startsWith('/f3mon/api') || req.url.startsWith('/sc/php') || req.url.startsWith('/sctest')) return false;
        return true;
      return true;
    }
  }
}

//access logging (debug feature)
var path = require('path')
var fs = require('fs');

var access_logging=false;
if (access_logging) {
  console.log('configuring morgan express logging')
  var morgan = require('morgan')
  morgan.token('date', function () {
    return new Date().toISOString()
  })
  //var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access_'+serverPort+'.log'), {flags: 'a'})
  var accessLogStream = fs.createWriteStream(global.log_dir+'/access_'+serverPort+'.log', {flags: 'a'})
  app.use(morgan(('short :date[iso]', {stream: accessLogStream})))
}

//post text decoding (for login screen)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

if  (priv_access) {
  var secure_accesslog_FS = fs.openSync(global.log_dir+'/secure_access.log', 'a+');
  var access_pwd_token = require('./pwd_token')
  //session setup
  //var session = session({secret: 'higgs boson CMS 2012',resave:true,saveUninitialized:false});
  var session = session({secret: access_pwd_token.password,resave:true,saveUninitialized:false});
  app.use(session);//always use

  //authentication
  var pam = require('authenticate-pam');
  var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;

  //register passport only for links requiring auth
  var privileged_all = ['/sc','/login'];
  app.use(privileged_all,passport.initialize());
  app.use(privileged_all,passport.session());

  //privileged areas
  var privileged = ['/sc'];
  app.use(privileged,function(req, res, next) {
    if (!req.user && req._parsedUrl.path.startsWith('/sc/php'))  res.status(403).send("Forbidden. Please log in.");
    else if (!req.user) res.redirect('/login.html');
    else next();
  });

  app.use('/sc/php_priv',function(req, res, next) {
    if (!req.user) res.status(403).send("Forbidden. Please log in.");
    else {
      var msgaccess = 'privileged access user:'+req.user.id + ' from:' + req.connection.remoteAddress + ' path:/sc/php_priv'+req._parsedUrl.path; 
      //console.log(msgaccess)
      fs.writeSync(secure_accesslog_FS,'['+(new Date().toISOString())+'] '+ msgaccess+"\n");
      //var cache1 = []
      /*console.log(
      JSON.stringify(req, function(key, value) {
        if (typeof value === 'object' && value !== null) {
          if (cache1.indexOf(value) !== -1) {
            // Circular reference found, discard key
            return;
          }
            // Store value in our collection
          cache1.push(value);
        }
        return value;
      }))*/
      //console.log(''+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+'
      next();
    }
  });
}

//old web and php
app.use("/sctest",php.cgi("web/sctest"));
app.use("/sc/php",php.cgi("web/sc/php"));

if (priv_access) {
  app.use("/sc/php_priv",php.cgi("web/sc/php_priv"));
}

app.use("/ecd",php.cgi("web/ecd/ecd"));
app.use("/ecd-allmicrostates",php.cgi("web/ecd/ecd-allmicrostates"));

//static content!
app.use(express.static('web'));

var exec = require('child_process').exec;

if (priv_access) {
  //injection/comparision of session user id
  passport.serializeUser(function(user, done) {
    console.log('serialized '+user.id)
    done(null, user.id); 
  });

  passport.deserializeUser(function(id, done) {
    done(null, {"id":id});
  });

  //configure pasport auth mode
  passport.use(new LocalStrategy(
    function(username, password, done) {
      var execg = exec('groups '+ username, function (error, stdout, stderr) {
        var required_grp = 'daqoncall'
        var found_grp = false;
        var user_groups = stdout.substring(stdout.indexOf(':'),stdout.length).split(' ')
        user_groups.forEach(function(grp) {
          if (grp===required_grp) found_grp=true;
        });
        if (!found_grp) {
          var errmsg = 'user '+username+' is not member of group '+required_grp+'. Logon denied.';
          console.log(errmsg);
          fs.writeSync(secure_accesslog_FS,'['+(new Date().toISOString())+'] '+ errmsg+"\n");
          done(null, false, { message: errmsg });
        }
        else {
          //PAM deliberately takes time if password is incorrect
          pam.authenticate(username, password, function(err) {
            if (err) done(null, false, { message: 'Incorrect username or password' });
            else {
              console.log('authenticated ' + username)
              fs.writeSync(secure_accesslog_FS,'['+(new Date().toISOString())+'] '+ 'authenticated ' + username+"\n");
              done(null, {id:username});
            }
          });
        }
      });
    })
  );

  //login route
  app.post('/login',
    passport.authenticate('local', { successRedirect: '/index.html',
                                     failureRedirect: '/login.html#err',
                                     failureFlash: false })
  );

  //login redirect if reloaded from browser(GET)
  app.get('/login',function(req,res) {res.redirect('/login.html')});

}

//4.setup elasticsearch client
var ESServer = 'localhost';  //set in each deployment, if using a different ES service
global.client = new elasticsearch.Client({
  host: ESServer+':9200',
  //log: 'trace'
  //log: 'debug'
  apiVersion:'5.0',
  log : [{
	type : 'file', //outputs ES logging to a file in the app's directory
	//levels : ['debug'] //can put more logging levels here
	levels : ['info'], //can put more logging levels here
        path : global.log_dir+'/elasticsearch.log' 
	}]
});

//currently used only for checking cluster health
global.clientESlocal = new elasticsearch.Client({
  host: 'es-local:9200',
  //log: 'trace'
  //log: 'debug'
  apiVersion:'5.0',
  log : [{
	type : 'file', //outputs ES logging to a file in the app's directory
	//levels : ['debug'] //can put more logging levels here
	levels : ['info'] //can put more logging levels here
	}]
});


//5.redirecting console log to a file
//var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(global.log_dir+'/console.log', {flags : 'a'});
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
var stderrFS = fs.openSync(global.log_dir+'/stderr.log', 'a+');
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
        //if (errCount<100) errCount=errCount+1;
        //else throw err;
        throw err;
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


//must be statically set in the code
global.cacheExists = true;

//9.cache init
if (global.cacheExists) {
var NodeCache = require('node-cache');
//use
global.f3MonCache = new NodeCache({checkperiod: 0.55}); //global cache container



global.f3MonCache.on("expired", function(key,obj){
	if (obj!=="requestPending"){
		f3MonCacheSec.set(key,obj,obj[1]);
	}
});

//secondary cache holds expired objects with the same ttl while server executes queries
//var f3MonCacheSec = new NodeCache({checkperiod: 30});
global.f3MonCacheSec = new NodeCache();

//tertiary cache holds reply objects for requests arrived while other same-key request was being handled
global.f3MonCacheTer = new NodeCache({useClones:false});

f3MonCacheTer.on("expired", function(key,obj){
        if (obj!==undefined)
          obj.forEach(function(item) {
          item.res.status(500).send("No query reply received");
        });
});

}

//ttls per type of request in seconds (this can also be loaded from a file instead of hardcoding)
global.ttls = getQuery("ttls.json").ttls;
//time stats
global.totalTimes = {
	"queried" : 0,
	"cached" : 0
}

//10. load f3mon specific modules and define f3mon web callbacks
//F3Mon DB query module
var dbinfo = require('./dbinfo')
global.smdb = require('./src/smdb')
global.smdb.setupDB(dbinfo)
global.smdb.setup()
global.smdb.makePool("cdaq");
global.smdb.makePool("dv");
//global.smdb.makePool("tcds"); //when ratemeter_exp is migrated from PHP

//callback test 1
app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/gc', function (req, res) {
  global.gc();
  res.send(new Date() + " - GC executed. Current heap size is " + process.memoryUsage().heapUsed/1000000.0 + ' MB');
});

app.get('/heapsize', function (req, res) {
  res.send(new Date() + " - Current heap size is " + process.memoryUsage().heapUsed/1000000.0 + ' MB');
});

app.get('/heap', function (req, res) {
  global.gc();
  var nd = new Date();
  var filename = '/tmp/node-' + serverPort + '-hdump-' + nd+'.heapsnapshot';
  heapdump.writeSnapshot(filename);
  console.log('dump written to', filename);
  res.send("HEAP dump done:"+filename);
});

//can be toggled on the fly
global.useCaches = true;

app.get('/togglecaching', function (req, res) {
  res.send("call on caching flag: "+global.useCaches + " ; new setting:"+!global.useCaches);
  global.useCaches = !global.useCaches;
});


//callback test 2
app.get('/test', function (req, res) { setTimeout(function(){
    res.send('Hello World after sleep!');
  }, 10000);
  console.log("dispatched timeout");
});

//***F3MON CALLBACKS***
//callback 1
var esServerStatus = require('./src/esServerStatus')
esServerStatus.setup();
app.get('/f3mon/api/serverStatus', esServerStatus.query.bind(esServerStatus));

//callback 2
var esIndices = require('./src/esIndices')
esIndices.setup();
app.get('/f3mon/api/getIndices', esIndices.query.bind(esIndices));

//callback 3
var esDisksStatus = require('./src/esDisksStatus')
esDisksStatus.setup(getQuery("disks.json"));
app.get('/f3mon/api/getDisksStatus', esDisksStatus.query.bind(esDisksStatus));

//callback 4
var esRunList = require('./src/esRunList')
esRunList.setup();
//added layer of redirection (bind) because express 'drops' this namespace
app.get('/f3mon/api/runList', esRunList.query.bind(esRunList));
app.get('/sc/api/runList', esRunList.query.bind(esRunList));

//callback 5
var esRiverStatus = require('./src/esRiverStatus')
esRiverStatus.setup(getQuery("riverstatus.json"));
app.get('/f3mon/api/riverStatus', esRiverStatus.query.bind(esRiverStatus));

//callback 6
var esRunListTable = require('./src/esRunListTable')
esRunListTable.setup(getQuery("rltable.json"));
app.get('/f3mon/api/runListTable', esRunListTable.query.bind(esRunListTable));

//callback 7
var esRiverListTable = require('./src/esRiverListTable')
esRiverListTable.setup(getQuery("runrivertable-meta.json"));
app.get('/f3mon/api/runRiverListTable', esRiverListTable.query.bind(esRiverListTable));
app.get('/sc/api/runRiverListTable', esRiverListTable.query.bind(esRiverListTable));

//callback 8
var esCloseRun = require('./src/esCloseRun')
esCloseRun.setup();
app.get('/f3mon/api/closeRun', esCloseRun.query);

//callback 9
var esStartCollector = require('./src/esStartCollector');
esStartCollector.setup();
app.get('/f3mon/api/startCollector', esStartCollector.query);

//callback 10
var esLogTable = require('./src/esLogTable')
esLogTable.setup(getQuery("logmessages.json"));
app.get('/f3mon/api/logtable', esLogTable.query.bind(esLogTable));
app.get('/f3mon/api/logDump', esLogTable.dump.bind(esLogTable));

//callback 11
var esMicrostates = require('./src/esMicrostates');
esMicrostates.setup(null,getQuery("aggnstates.json"),getQuery("teolsminmax.json"));
app.get('/f3mon/api/nstates-summary', esMicrostates.query.bind(esMicrostates));
app.get('/f3mon/api/istates-summary', esMicrostates.queryInput.bind(esMicrostates));

//not yet ported to esCommon:
//callback 12
var esRunInfo = require('./src/esRunInfo');
esRunInfo.setup(getQuery("lastls.json"),getQuery("streamsinrun.json"));
app.get('/f3mon/api/runInfo', esRunInfo.query.bind(esRunInfo));
app.get('/sc/api/runInfo', esRunInfo.query.bind(esRunInfo));

//callback 13
var esMiniMacroPerStream = require('./src/esMiniMacroPerStream');
esMiniMacroPerStream.setup(getQuery("microperstream.json"),getQuery("minimacroperstream.json"),getQuery("transferperstream.json"),getQuery("teolsperstream.json"));
app.get('/f3mon/api/minimacroperstream', esMiniMacroPerStream.query.bind(esMiniMacroPerStream)); 

//callback 14
var esMiniMacroPerHost = require('./src/esMiniMacroPerHost');
esMiniMacroPerHost.setup(getQuery("minimacroperbu.json"),getQuery("macroperhost.json"),getQuery("teolsperbu.json"),getQuery("teolsperstream.json"));
app.get('/f3mon/api/minimacroperhost', esMiniMacroPerHost.query.bind(esMiniMacroPerHost)); 

//callback 15
var esStreamHist = require('./src/esStreamHist');
esStreamHist.setup(getQuery("minimacromerge.json"),getQuery("outls.json"),getQuery("teols.json"),getQuery("transfers.json"));
app.get('/f3mon/api/streamhist', esStreamHist.query.bind(esStreamHist)); 

//callback 16
var esGetStreamList =  require('./src/esGetStreamList');
esGetStreamList.setup(getQuery("streamlabel.json"));
app.get('/f3mon/api/getstreamlist', esGetStreamList.query.bind(esGetStreamList));

//callback 17
var esGetConfig =  require('./src/esGetConfig');
esGetConfig.setup(getQuery("config.json"));
app.get('/f3mon/api/getConfig', esGetConfig.query);

//callback 18
var esBigPic =  require('./src/esBigPic');
esBigPic.setup(getQuery("config.json"));
app.get('/sc/api/bigPic', esBigPic.query.bind(esBigPic));

//callback 19
app.get('/sc/api/teols', esBigPic.teols.bind(esBigPic));
app.get('/f3mon/api/teols', esBigPic.teols.bind(esBigPic));
//***DB callbacks (TRANSFER STATUS and BIGPIC HWCFG)***

//callback 20
app.get('/sc/api/maxls', esBigPic.maxls.bind(esBigPic));
app.get('/f3mon/api/maxls', esBigPic.maxls.bind(esBigPic));
//***DB callbacks (TRANSFER STATUS and BIGPIC HWCFG)***


//callback 21
app.get('/sc/api/transfer', function (req, res) {
  global.smdb.runTransferQuery(req.query,req.connection.remoteAddress,res,true,null);
});

//callback 22
/*app.get('/sc/api/pp', function (req, res) {
  global.smdb.runPPquery(req.query, req.connection.remoteAddress,res,true,null);
});*/
app.get('/sc/api/pp', global.smdb.runPPquery.bind(global.smdb))

//callback 23

var esSmallPic =  require('./src/esSmallPic');
esSmallPic.setup(getQuery("config.json"));
app.get('/sc/api/fuhistos', esSmallPic.fuhistos.bind(esSmallPic));

/*
//lustre Info from ICINGA
var lustreInfo =  require('./src/lustreInfo');
lustreInfo.setup(getQuery("config.json"));
lustreInfo.setupAuth(dbinfo)
app.get('/sc/api/lustreInfo', lustreInfo.query.bind(lustreInfo));
*/

app.get('/test/cachekeys1',function(req,res) {
  res.send(JSON.stringify(global.f3MonCache.keys()));
});

app.get('/test/cachekeys2',function(req,res) {
  res.send(JSON.stringify(global.f3MonCacheSec.keys()));
});

app.get('/test/cachekeys3',function(req,res) {
  res.send(JSON.stringify(global.f3MonCacheTer.keys()));
});

app.get('/test/getttl1',function(req,res) {
  var srvTime = new Date().getTime();
  var keys = global.f3MonCache.keys();
  var str = "";
  for (var i=0;i<keys.length;i++) {
    var exptime = global.f3MonCache.getTtl(keys[i]);
    if (exptime!==undefined && exptime!==0) exptime-=srvTime;
    str+=keys[i]+">>> "+exptime+"<br>";
  }
  res.send("KEYS:\n"+str);
});

app.get('/test/getttl2',function(req,res) {
  var srvTime = new Date().getTime();
  var keys = global.f3MonCacheSec.keys();
  var str = "";
  for (var i=0;i<keys.length;i++) {
    var exptime = global.f3MonCacheSec.getTtl(keys[i]);
    if (exptime!==undefined && exptime!==0) exptime-=srvTime;
    str+=keys[i]+">>> "+exptime+"<br>";
  }
  res.send("KEYS:\n"+str);
});

app.get('/test/getttl3',function(req,res) {
  var srvTime = new Date().getTime();
  var keys = global.f3MonCacheTer.keys();
  var str = "";
  for (var i=0;i<keys.length;i++) {
    var exptime = global.f3MonCacheTer.getTtl(keys[i]);
    if (exptime!==undefined && exptime!==0) exptime-=srvTime;
    str+=keys[i]+">>> "+exptime+"<br>";
  }
  res.send("KEYS:\n"+str);
});




//11. start http server
var server = app.listen(serverPort, function () {

   // test elasticsearch connection (test)
   global.client.ping();
   global.clientESlocal.ping();
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

process.on('SIGTERM', function () {
  setTimeout(function () {console.log('server drain timeout'); process.exit(0);},8000);
  server.close(function () {
    console.log('server drained')
    process.exit(0);
  });
});

//12. start cache state logging
var statsLogger =  require('./src/statsLogger');
statsLogger.start();


//log start time
var toc = new Date().getTime();
console.log('application startup time: '+(toc-tic)+' ms');


