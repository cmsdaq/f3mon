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

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runListTable request');
    var eTime = new Date().getTime();
    var cb = req.query.callback;

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
      //only filter if more than 2 characters specified
      if (qparam_search != '' && qparam_search.length>2){
	var searchText = qparam_search;
        var doSearch = true;
	if (qparam_search.indexOf("*") === -1){
	  searchText = '*'+qparam_search+'*';
        }
        else if (qparam_search.length<=3)
          doSearch=false;
        if (doSearch) {
          var filterQ = searchText.replace(/\*/g,"");

	  if (searchText[0]=='*' && searchText[searchText.length-1]==='*')
	    qsubmitted["filter"] = {"script":{"script":"doc[\"runNumber\"].value.toString().contains(\""+filterQ+"\")"}}
          else if (searchText[searchText.length-1]==='*')
	    qsubmitted["filter"] = {"script":{"script":"doc[\"runNumber\"].value.toString().startsWith(\""+filterQ.replace(/\*/g,"")+"\")"}}
          else if (searchText[0]==='*')
	    qsubmitted["filter"] = {"script":{"script":"doc[\"runNumber\"].value.toString().endsWith(\""+filterQ.replace(/\*/g,"")+"\")"}}
          //qsubmitted["query"] = {"query_string":{"query": searchText}}
        }
        else {
	  delete qsubmitted["filter"];
	  //delete qsubmitted["query"];
        }
      }else{
	delete qsubmitted["filter"];
	//delete qsubmitted["query"];
      }

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
	if (verbose) console.log('runListTable (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
	res.send(cb +' ('+JSON.stringify(retObj)+')');
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      if (verbose) console.log('runListTable (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.header("Cache-Control", "no-cache, no-store");
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

