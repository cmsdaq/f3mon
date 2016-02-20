'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON

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
  },

  query : function (req, res) {


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

      //parameterize query
      queryJSON.size = qparam_size;
      queryJSON.from = qparam_from;
      queryJSON.query.filtered.filter.and[0].range.date.from = qparam_startTime;
      queryJSON.query.filtered.filter.and[0].range.date.to = qparam_endTime;

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
        type: 'hltdlog,cmsswlog',
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
          res.header("Cache-Control", "no-cache, no-store");
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
      res.header("Cache-Control", "no-cache, no-store");
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
  }
}

