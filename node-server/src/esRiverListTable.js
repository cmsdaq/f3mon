'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON1;
var queryJSON2;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN1,queryJSN2) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON1 = queryJSN1;
    queryJSON2 = queryJSN2;
  },

  query : function (req, res) {


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


    //search ES - Q1 (get meta)
    var q1 = function (){

      queryJSON2.size = qparam_size;
      queryJSON2.from = qparam_from;

      //TODO:sortBy name mapping...
      if (qparam_sortBy != '' && qparam_sortOrder != ''){
        var inner = {
	  "order" : qparam_sortOrder,
	  "missing" : "main",
	  "unmapped_type" : "string"	
        };
        var temp = {};
        temp[qparam_sortBy] = inner;
        var outer = [temp];
        queryJSON2.sort = outer;
      }

      client.search({
        index:'river',
        type:'instance',
        body: JSON.stringify(queryJSON2)
      }).then (function(body){
        var results = body.hits.hits; //hits for query 1
        retObj.total = body.hits.total;
        var list = [];
        for (var index = 0 ; index < results.length; index++){
          var host = ""
          if (results[index]._source.hasOwnProperty("node"))
            host = results[index]._source.node.name;
          //console.log(results[index]._source)
          var nstatus = "undefined"
          if (results[index]._source.hasOwnProperty("node"))
            nstatus = results[index]._source.node.status;
          var role = "main";
          if (results[index]._source.hasOwnProperty("runNumber") && results[index]._source.runNumber!=0)
            role = "collector";
          var o = {
            //"name" : results[index]._source.instance_name.substr(6), //after river_
            "name" : results[index]._source.instance_name.split("_")[2],
            "subSystem" : results[index]._source.subsystem,
            "host" : host, //todo:adapt river tables
            "status" : nstatus,
            "role" : role
	  };
          //todo:sort list by instance_name (desc!)
	  list.push(o);
        }
        retObj.list = list;//passes list to callback-level scope, next functs will access it directly
        sendResult();
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
      q1();
    }else{
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.cached += srvTime;
	console.log('runRiverListTable (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}
