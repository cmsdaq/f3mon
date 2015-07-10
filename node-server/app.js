var express = require('express');
var app = express();
app.use(express.static('web'));

var elasticsearch = require('elasticsearch');

var client = new elasticsearch.Client({
  host: 'localhost:9200',
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


});

//callback 4
app.get('/node-f3mon/api/getIndices', function (req, res) {
    console.log("received getIndices request!");

    cb = req.query.callback;
    client.cat.aliases({
      name: 'runindex*read'}
    ).then(
      function (body) {
        //console.log('received response from ES :\n'+body+'\nend-response');
        var aliasList = [];

        alias_infos = body.split('\n');
        //console.log(alias_infos);
        for(var alias_info in alias_infos) {
          if (!alias_infos[alias_info].length) continue;
          //console.log(alias_infos[alias_infos]);
          info = alias_infos[alias_info].split(' ');
          mySubsys = info[0].split("_")[1];
          myAlias = info[0];
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
});

//callback 5
app.get('/node-f3mon/api/getDisksStatus', function (req, res) {
console.log('received getDisksStatus request!');

var cb = req.query.callback;

//loads query definition from file
var queryJSON = require ('./web/node-f3mon/api/json/disks.json');

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
var queryJSON = require ('./web/node-f3mon/api/json/runlist.json');

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
var queryJSON = require ('./web/node-f3mon/api/json/rltable.json');

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
queryJSON.size = qparam_size;
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
        for (index = 0 ; index < results.length; index++){
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
var queryJSON = require ('./web/node-f3mon/api/json/'+qparam_query+'.json');

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
	statusList = []; //built in Q1, used in Q2
	for (index = 0 ; index < results.length; index++){
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
        index = 0;

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

        prepareLookup(index); //initial caller

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

//GET query string params
var qparam_from = req.query.from;
var qparam_size = req.query.size;
var qparam_sortBy = req.query.sortBy;
var qparam_sortOrder = req.query.sortOrder;
if (qparam_from == null){qparam_from = 0;}
if (qparam_size == null){qparam_size = 100;}
if (qparam_sortBy == null){qparam_sortBy = '';}
if (qparam_sortOrder == null){qparam_sortOrder = '';}

//search ES - Q1 (get meta)
var q1 = function (callback){

  var queryJSON = require ('./web/node-f3mon/api/json/runriver-meta.json');

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
	temp[qparam_
  }


  client.search({
  index:'_river',
  body: JSON.stringify(queryJSON)
        }).then (function(body){
        var results = body.hits.hits; //hits for query 1
	callback(statusList);
  }, function (error){
        console.trace(error.message);
  });
}//end q1



//search ES - Q2 (check status)
var q2 = function (statusList){


}//end q2


//loads query definition from file
//var queryJSON = require ('./web/node-f3mon/api/json/***.json');	//uncomment and define


});//end callback


//callback 10
app.get('/node-f3mon/api/closeRun', function (req, res) {
console.log('received closeRun request');

var cb = req.query.callback;

//GET query string params
var qparam_size = req.query.size;
var qparam_query = req.query.query;
if (qparam_size == null){qparam_size = 100;}
if (qparam_query == null){qparam_query = 'riverstatus';}

//loads query definition from file
//var queryJSON = require ('./web/node-f3mon/api/json/***.json');	//uncomment and define


});//end callback



//sets server listening for connections at port 3000
var server = app.listen(3000, function () {

 // test elasticsearch connection (test)
 client.ping();
 //client.cat.aliases({name: 'runindex*cdaq*'},function (error, response) { console.log(JSON.stringify(response.split('\n')));});
 
 var host = server.address().address;
 var port = server.address().port;
 
 console.log('Server listening at http://%s:%s', host, port);
 
 });

