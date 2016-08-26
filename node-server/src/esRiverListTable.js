'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'runRiverListTable';

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runRiverListTable request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    var retObj = {
      "list" : "",
      "total" : ""
    };

    var ipAddresses = [];

    //GET query string params
    var qparam_from = this.checkDefault(req.query.from,0);
    var qparam_size = this.checkDefault(req.query.size,100);
    var qparam_sortBy = this.checkDefault(req.query.sortBy,'');
    var qparam_sortOrder = this.checkDefault(req.query.sortOrder,'');

    var requestKey = qname+'?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy+'&sortOrder='+qparam_sortOrder;
    var requestValue = global.f3MonCache.get(requestKey);
    var ttl = global.ttls.runRiverListTable; //cached ES response ttl (in seconds)

    var _this = this
    //search ES - Q1 (get meta)
    var q1 = function (){

      _this.queryJSON1.size = qparam_size;
      _this.queryJSON1.from = qparam_from;

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
        _this.queryJSON1.sort = outer;
      }

      global.client.search({
        index:'river',
        type:'instance',
        body: JSON.stringify(_this.queryJSON1)
      }).then (function(body){
        try {
        took+=body.took
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
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)} 
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }//end q1

    var pending=false
    if (requestValue=="requestPending"){
      pending=true
      requestValue = global.f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
        return;
      }
      global.f3MonCache.set(requestKey, "requestPending", ttl);

      //chaining of the two queries (output of Q1 is combined with Q2 hits to form the response) 
      //q1 is executed and then passes to its callback, q2
      q1();
    } else
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
  }

