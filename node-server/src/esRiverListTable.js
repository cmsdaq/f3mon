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
                    if (domains[0].length>=4 && domains[0].indexOf(".cms", this.length - 4) !== -1)
                      retObj.list[this.idx].host  = domains[0].substr(0,domains[0].length-4);
                    else
		      retObj.list[this.idx].host  = domains[0]; //assign the first possible hostname
	    }else{
		    retObj.list[this.idx].host  = ipAddresses[this.idx]; //escape with IP in case of unresolved
	    }
	    indx++;
	    prepareLookup();
    }//end checkResult 


    //search ES - Q2 (check status)
    var q2 = function (callback, typeList, list){

      //set query parameter
      queryJSON1.query.bool.must[1].terms._type = typeList;

      client.search({
        index: '_river',
        body: JSON.stringify(queryJSON1)
      }).then(function(body) {
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

      queryJSON2.size = qparam_size;
      queryJSON2.from = qparam_from;
      queryJSON2.query.term._id.value = "_meta";

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
        index:'_river',
        body: JSON.stringify(queryJSON2)
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
  }
}

