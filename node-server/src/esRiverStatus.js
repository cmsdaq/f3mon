'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON;
var verbose;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON = queryJSN;
    verbose = global.verbose;
  },

  query : function (req, res) {

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'riverStatus request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    //GET query string params
    var qparam_size = req.query.size;
    if (qparam_size == null){qparam_size = 100;}

    var qparam_query = 'riverstatus';

    var requestKey = 'riverStatus?size='+qparam_size+'&query='+qparam_query;
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.riverStatus; //cached ES response ttl (in seconds)

    //parameterize query fields 
    queryJSON.size = qparam_size;

    //search ES - Q2 (get meta)
    var q1 = function (){

      //queryJSON.query.term. = "_meta" //param for Q2

      client.search({
        index:'river',
        type:'instance',
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

		var type = results[index]._type; //'instance'
		source[index] = results[index]._source;
                system[index] = source[index].subsystem
                stat[index] = source[index].node.status
                host[index] = source[index].node.name
                formatEntry(index);
                index++;
                prepareLookup();
 
		////impl. php substr() for positive length parameter l
		//var l = 9; //equals size of the string 'runIndex_'
		//var suffix  = source[index].runIndex_read.substr(l);
		//var strpos_minus_const = source[index].runIndex_read.indexOf("_read")-l;
		//system[index] = suffix.substring(0, strpos_minus_const);

		////status = false means that the river exists but the instance is not running
		//var entriesByKey = statusList.filter(function (o){
		//	return o.key == type;
		//});

		////console.log('fltd_array:'+JSON.stringify(entriesByKey));
		//var ip;
                //host[index]="";
		//if (entriesByKey.length>0){
		//        stat[index]=true;
		//	ip = entriesByKey[0].value;
		//	var b = true;
	        //        var idx = index;
		//	require('dns').reverse(ip, checkResult.bind({b:b,idx:idx}));
                //}
                //else {
		//        stat[index]=false;
                //        host[index]="";
                //        formatEntry(index);
                //        index++;
                //        prepareLookup();
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
		if (source[idx].hasOwnProperty("runNumber") && source[idx].runNumber!==0){
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
	  if (verbose) console.log('riverStatus (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.set('Content-Type', 'text/javascript');
          //res.header("Cache-Control", "no-cache, no-store, must-revalidate");
          res.header("Cache-Control", "no-cache, no-store");
          //res.header("Pragma", "no-cache");
          //res.header("Expires", 0);
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
      q1();
    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      if (verbose) console.log('riverStatus (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      //res.header("Cache-Control", "no-cache, no-store, must-revalidate");
      res.header("Cache-Control", "no-cache, no-store");
      //res.header("Pragma", "no-cache");
      //res.header("Expires", 0);
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}


