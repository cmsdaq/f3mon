'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    //time
    var took = 0
    var eTime = this.gethrms();

    //query const
    var qname = 'runList';
    var ttl = global.ttls.runList;

    //GET query string params
    var cb = req.query.callback;
    var qparam_sysName = this.checkDefault(req.query.sysName,"cdaq");
    var qparam_size = this.checkDefault(req.query.size,10);
    var qparam_from=this.checkDefault(req.query.from,"0");
    var qparam_to=this.checkDefault(req.query.to,"now");

    //build key and check in caches
    var requestKey = 'runList?sysName='+qparam_sysName+'&from='+qparam_from+'&to='+qparam_to+'&size='+qparam_size;

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
      //set up and run query
      var queryJSON = {
        //"fields": ["_source","startTime"],
        "query": {
          "bool":{
            "must_not":{
 
              "exists": {
                "field": "endTime"
              }
            }
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
      //console.log(JSON.stringify(queryJSON))

      //search ES
      global.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took+=body.took
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
	    //"lasttime" : results[0].fields.startTime,
	    "lasttime" : results[0].sort[0], //take from sort? (es5)
	    "runlist" : arr
	  };
        }
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      },function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }
  }

