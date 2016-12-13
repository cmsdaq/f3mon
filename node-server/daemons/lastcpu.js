'use strict';

var http = require('http')
var host= 'localhost'
//var port='4000'
var port='80'

var eshost = host;
var esport='9200'

var verbose=false;
var setup = "cdaq"

console.log(process.argv);

if (process.argv.length>2) {
  var request = require('request')
  console.log('doc id ' + process.argv[2])
  var docid = process.argv[2];
  //console.log('http://localhost:9200/river/instance/'+docid+'/_update -d\'' + JSON.stringify({'doc':{'node':{'status':'running'}}})+'\'');
  var res = request.post( 
    'http://'+eshost+':'+esport+'/river/instance/'+docid+'/_update',
    {
      json:{
        'doc':{
          'node':{
            'status':'running'
          }
        }
      }
    },
    function(err,resp,body) {
      if (err) {
        console.log(err);
        process.exit(24)
      }
    }
  );
}

//var cpumon = 'cpumon_test';//test (int2r lb)
var cpumon = 'cpumon';//production (rcms omds lb)

var dbinfo = require('../dbinfo')
var dblogin = dbinfo[cpumon][0]
var dbpwd = dbinfo[cpumon][1]
var dbsid = dbinfo[cpumon][2]
console.log(dblogin + ' ' + dbsid);
//reset
dbinfo = undefined
var oracledb = require('oracledb'); //module that enables db access
var conn;

//write to FILTERFARMUSAGEANDTIMING if true, else write to HLTCPUUSAGE 
var usetable1=false;

//oracledb.outFormat = oracledb.OBJECT //returns query result-set row as a JS object (equiv. to OCI_ASSOC param in php oci_fetch_array call)
//oracledb.maxRows = 50000; //approx 2000 lumis x 25 streams


//variables
var lastrun = undefined;
var prev_list_uncorr
var prev_list_corr
function clean() {
  prev_list_uncorr = []
  prev_list_corr = []
}

function runf(){

  http.get("http://"+host+":"+port+"/sc/api/runInfo?sysName="+setup+"&activeRuns=true", function(res) {

    var body = '';

    res.on('data', function(chunk){
      body += chunk;
    });

    res.on('end', function(){
      var adata = JSON.parse(body)
      if (adata.runNumber!==undefined)
        console.log('run ' + adata.runNumber)

      //reset on rn change
      if (lastrun===undefined || lastrun!=adata.runNumber) clean();

      lastrun = adata.runNumber;
      if (adata.runNumber && !isNaN(parseInt(adata.runNumber))) {
        http.get("http://"+host+":"+port+"/sc/api/maxls?runNumber="+adata.runNumber, function(res) {
          var body = '';
          res.on('data', function(chunk){
            body += chunk;
          });
          res.on('end', function(){
            var bdata = JSON.parse(body)
            if (isNaN(bdata.maxls)) {console.log('no maxls..');setTimeout(runf,11000);}
            else 
             get_appliance_info(adata.runNumber,bdata.maxls,runf);
          });
        });
      } else {console.log('no run...'); setTimeout(runf,11000);}
    });

  });
}


var parse_cpu_avg = function(data,run,cb) {
  var toInject = {}
  if (!prev_list_uncorr.length) {
    data[0].data.forEach(function (item) {
      if (verbose) console.log('new item(0) '+item)
      prev_list_uncorr.push(item)
      toInject[item[0]]={'uncorrcpu':item[1],'ls':item[2]}
    });
  } else {
    data[0].data.forEach(function (item) {
      var found=false;
      var update=false;
      for (var i=0;i<prev_list_uncorr.length;i++) {
        var pitem = prev_list_uncorr[i];
        if (pitem[0]==item[0]) {
          found=true;
          if (pitem[1]!=item[1]) {
            update=true;
            if (verbose) console.log('item(0) ' + item + ' changed from ' + pitem)
          }
          break;
        }
      }
      if (!found || update) {
          if (verbose) console.log('item(0) '+item + ' injection')
          toInject[item[0]]={'uncorrcpu':item[1],'ls':item[2]}
      }
    });
  }
  if (!prev_list_corr.length) {
    data[2].data.forEach(function (item) {
      prev_list_corr.push(item)
      if (toInject.hasOwnProperty(item[0])) toInject[item[0]]['corrcpu']=item[1]
      else 
        toInject[item[0]]={'corrcpu':item[1],'ls':item[2]}
    });
  } else {
    data[2].data.forEach(function (item) {
      var found=false;
      var update=false;
      for (var i=0;i<prev_list_corr.length;i++) {
        var pitem = prev_list_corr[i];
        if (pitem[0]==item[0]) { 
          found=true;
          if (pitem[1]!=item[1]) {
            update=true;
            if (verbose) console.log('item(2) ' + item + ' changed from ' + pitem)
          }
          break;
        }
      }
      if (!found || update) {
          //injecting
          if (verbose) console.log('item(2) ' + item + ' injection')
          if (toInject.hasOwnProperty(item[0])) toInject[item[0]]['corrcpu']=item[1]
          else 
            toInject[item[0]]={'corrcpu':item[1],'timestamp':item[2]}
      }
    });
  }

  //replace previous
  prev_list_uncorr = data[0].data;
  prev_list_corr = data[1].data;

  var inject_array = []

  Object.keys(toInject).forEach(function(ts) {
   var corrcpu = (toInject[ts].corrcpu*100.).toFixed(2);
     var tskey = new Date(parseInt(ts)).toISOString();
     var qstring = "MERGE INTO HLTCPUUSAGE USING dual ON (CONTEXT='DAQ2FFFAvg' AND TIMESTAMP=TO_TIMESTAMP('"+tskey+"','YYYY-MM-DD\"T\"HH24:MI:SS.ff3\"Z\"'))"+
                   "WHEN MATCHED THEN UPDATE SET CPUUSAGE="+corrcpu+" WHEN NOT MATCHED THEN "+
                   "INSERT (TIMESTAMP,CONTEXT,CPUUSAGE) VALUES (TO_TIMESTAMP('"+tskey+" ','YYYY-MM-DD\"T\"HH24:MI:SS.ff3\"Z\"'),'DAQ2FFFAvg',"+corrcpu+")";
   inject_array.push(qstring)
  });

  var testing=false;

  var runQuery  =function(q_array,qlen) {
    if (q_array.length) {
      var q_string = q_array[0];
      q_array = q_array.splice(1);
      if (verbose) console.log('executing query:'+q_string)
      if (testing) runQuery(q_array,qlen);
      else conn.execute(q_string,  function(err, result) {
        if (err) { console.error(err.message); process.exit(21); }
        //run next
        runQuery(q_array,qlen);
      });
    }
    else {
      if (qlen) {
        //console.log('commit...');
        conn.commit(function(err) {
          if (err)
            console.log(err);
          setTimeout(cb,11000);
          
        });
      }
      else
        setTimeout(cb,11000);
    }
  };

  runQuery(inject_array,inject_array.length);

} 

/* main callback */


function get_appliance_info(run,maxls,cb)
{
    var timequery = Math.floor(Date.now() / 1000) - 10;
    console.log("http://"+host+":"+port+"/sc/php/lastcpu.php?setup="+setup+"&intlen=20&int=3&maxtime="+timequery);
    http.get("http://"+host+":"+port+"/sc/php/lastcpu.php?setup="+setup+"&intlen=20&int=3&maxtime="+timequery, function(res) {

        var body = '';
        res.on('data', function(chunk){
          body += chunk;
        });
        res.on('end', function(){
            var data;
            try {
              var data = JSON.parse(body);
            }
            catch (ex) {
              //php error?
              console.log(ex);
              console.log(body);
              setTimeout(cb,1100);
              return;
            }
            if (data.hasOwnProperty('fusyscpu2') && data.fusyscpu2[0].data.length)
                parse_cpu_avg(data.fusyscpu2,run,cb)
              else setTimeout(cb,11000);

              //setTimeout(cb,11000);
         });
    });
}

//connection start
oracledb.getConnection(
    {
       user          : dblogin,
       password      : dbpwd,
       connectString : dbsid
    },
    function(err, connection)
    {
    	if (err) {
        	console.error(err.message);
		//equiv to (if (!$conn), err at oci_connect)
    		process.exit(20)
    	}
        //trigger main loop
        conn = connection;
        runf();
    }
);

