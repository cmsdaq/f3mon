'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    //time
    var eTime = new Date().getTime();

    //query const
    var qname = 'runList';
    var ttl = this.ttls.runList;

    //GET query string params
    var cb = req.query.callback;
    var qparam_sysName = this.checkDefault(req.query.sysName,"cdaq");
    var qparam_size = this.checkDefault(req.query.size,10);
    var qparam_from=this.checkDefault(req.query.from,"0");
    var qparam_to=this.checkDefault(req.query.to,"now");

    //build key and check in caches
    var requestKey = 'runList?sysName='+qparam_sysName+'&from='+qparam_from+'&to='+qparam_to+'&size='+qparam_size;

    var requestValue = this.f3MonCache.get(requestKey);
    var pending=false;
    if (requestValue=="requestPending") {
      requestValue = this.f3MonCacheSec.get(requestKey);
      pending=true;
    }

    if (requestValue !== undefined) {
      //respond from cache
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
    }
    else {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);

        return;//reply from other query will handle this
      }
      
      //set cache pending
      this.f3MonCache.set(requestKey, "requestPending", ttl);

      //set up and run query
      var queryJSON = {
        "fields": ["_source","startTime"],
        "filter": {
          "missing": {
            "field": "endTime"
          }
        },
        "size": qparam_size,
        "sort": {"startTime": "desc"}
      }

      //parameterize query fields
      queryJSON.size = qparam_size;
      //optional query
      if (!(qparam_from==="0" && qparam_to==="now"))
        queryJSON["query"] = {"range":{"startTime":{"from":qparam_from,"to":qparam_to}}}

      var _this = this;

      //search ES
      this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
	var results = body.hits.hits; //hits for query

	//format response content from query results, then send it
	var retObj;
	if (results.length==0){
	  retObj = {"runlist":[]}
	}else{
	  var arr = [];
	  for (var index = 0 ; index < results.length; index++){
	    arr[index] = results[index]._source;
	  }
	  retObj = {
	    "lasttime" : results[0].fields.startTime,
	    "runlist" : arr
	  };
        }
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
/*
        //lookup for pending queries cached in the meantime
        var cachedPending = _this.f3MonCacheTer.get(requestKey);
        if (cachedPending) {
          cachedPending.forEach(function(item) {
            _this.sendResult(item.req,item.res,requestKey,item.cb,true,retObj,qname,item.eTime,ttl);
          });
          //delete from 3rd cache so that expire doesn't produce a spurious status 500 reply
          _this.f3MonCacheTer.del(requestKey);
        }
*/
      },function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }
  }

