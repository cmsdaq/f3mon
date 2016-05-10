'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'runInfo';

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runInfo request');
    var eTime = this.gethrms();
    var cb = req.query.callback;
    //GET query string params
    var qparam_runNumber = this.checkDefault(req.query.runNumber,null);
    var qparam_sysName = this.checkDefault(req.query.sysName,"cdaq");
    var qparam_activeRuns  = this.checkDefault(req.query.activeRuns,false);

    var requestKey = qname+'?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName+'&active='+qparam_activeRuns;
    var requestValue = this.f3MonCache.get(requestKey);
    var ttl = this.ttls.runInfo; //cached ES response ttl (in seconds)

    var retObj = {};
    var _this = this

    //last LS number
    var q4 = function (){

      _this.queryJSON1.query.term._parent = qparam_runNumber;

      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
      body : JSON.stringify(_this.queryJSON1)
      }).then (function(body){
        took+=body.took
	var results = body.hits.hits; //hits for query
	  if (results.length === 0){
	  retObj.lastLs = 0;
	}else{
	  //retObj.lastLs = results[0].sort[0];
	  retObj.lastLs = results[0]._source.ls;
	}
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
      }, function (error){
        _this.excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q3


    //streams from INI
    var q3 = function (){

      var queryJSONs = {
        "size": 1000,
        "query": {
          "prefix": {
            "_id": 'run'+qparam_runNumber
          }
        },
        "sort": {"stream": {"order": "asc"}}
      }
      _this.client.search({
       index: 'runindex_'+qparam_sysName+'_read',
       type: 'stream_label',
       body : JSON.stringify(queryJSONs)
      }).then (function(body){
        took+=body.took
        var results = body.hits.hits; //hits for query
	var set = {};
        retObj['streamListINI'] = [];
	for (var i=0;i<results.length;i++) {
	  if (!set.hasOwnProperty(results[i]._source.stream)){
	    retObj.streamListINI.push(results[i]._source.stream);
	    set[results[i]._source.stream] = true;	//avoiding duplicates, if they occur
	  }
	}
        q4();
      }, function (error){
	_this.excpEscES(res,error);
        console.trace(error.message);
      });
    }


    //streams
    var q2 = function (){

      _this.queryJSON2.query.term._parent = qparam_runNumber;

      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'stream-hist',
        body : JSON.stringify(_this.queryJSON2)
      }).then (function(body){
        took+=body.took
        //var results = body.hits.hits; //hits for query
        var terms = body.aggregations.streams.buckets; //replacing facet implementation (facets->deprecated)
	var streams = [];
	for (var i=0;i<terms.length;i++){
		streams[i] = terms[i].key;
	}
	retObj.streams = streams;
        q3();
      }, function (error){
	_this.excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q2

    //start and end time
    var q1 = function (){

      var queryJSON = {"size":1,"sort":{"startTime":"desc"}}
      if (qparam_runNumber!==null)
        queryJSON["filter"]={"term":{"_id": qparam_runNumber }}
      if (qparam_activeRuns)
        queryJSON["query"]= {"constant_score":{"filter":{"missing":{"field":"endTime"}}}};

      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body : JSON.stringify(queryJSON)
      }).then (function(body){
        took+=body.took
        var results = body.hits.hits; //hits for query
	if (results.length === 0){
           _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
          return;
        }
	retObj = results[0]._source; 	//throws cannot read property error if result list is empty (no hits found) because results[0] is undefined
        if (qparam_runNumber===null) qparam_runNumber = results[0]._id;

	q2();
      }, function (error){
	_this.excpEscES(res,error);
        console.trace(error.message);
      });

    }//end q1

    var pending=false
    if (requestValue=="requestPending"){
      pending=true
      requestValue = this.f3MonCacheSec.get(requestKey);
    }

    if (requestValue === undefined) {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
        return;
       }
       this.f3MonCache.set(requestKey, "requestPending", ttl);
       q1();

    } else 
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
    
  }

