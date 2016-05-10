'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var qname = 'getDisksStatus';
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');
    var ttl = this.ttls.getDisksStatus; //cached ES response ttl (in seconds) 
    var eTime = this.gethrms();

    //GET query string params (needed to parameterize the query)
    var cb = req.query.callback;
    //the following check must not check types because non-set URL arguments are in fact undefined, rather than null valued

    var qparam_runNumber = this.checkDefault(req.query.runNumber,"false");
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');

    var requestKey = qname+'?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;

    var requestValue = this.f3MonCache.get(requestKey);
    var pending=false;
    if (requestValue=="requestPending"){
      pending=true;
      requestValue = this.f3MonCacheSec.get(requestKey);
    }

    if (requestValue !== undefined) {
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
    } else {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
        return;
      }
      this.f3MonCache.set(requestKey, "requestPending", ttl);

      //this.queryJSON1.query.wildcard.activeRuns.value =  '*'+qparam_runNumber+'*';

      delete this.queryJSON1.query;

      var _this = this

      var q2 = function(retObj) {

        var queryJSON2 = {
          "query":{
            "bool":{
              "must":[
                {"term":{"activeFURun":qparam_runNumber}},
                {"range":{"fm_date":{"to":"now","from":"now-10s"}}}
              ]
            }
          },
          "size":0,
          "aggs":{
            "bus":{
              "terms":{
                "field":"appliance",
                "size":200
              },
              "aggs":{
                "last":{
                  "top_hits":{"size":1,"sort":{"fm_date":{"order":"desc"} } }
                }
              }
            }
          }
        }

        //submits query to the ES and returns formatted response to the app client
        _this.client.search({
          index: 'boxinfo_'+qparam_sysName+'_read',
          type: 'resource_summary',
          body : JSON.stringify(queryJSON2)
        }).then(function (body){
	  //do something with these results (eg. format) and send a response
	  //took+=body.took;
          var buckets = body.aggregations.bus.buckets
          if (buckets.length==0) {
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
            return;
          }
          var summaryObj={active_run:0,active:0,stale:0,quarantined:0}
          buckets.forEach(function(bucket){
            if (bucket.last.hits.total>0) {
              var hitsrc = bucket.last.hits.hits[0]._source;
              summaryObj.active_run+=hitsrc.active_resources_activeRun;
              summaryObj.active+=hitsrc.active_resources;
              summaryObj.quarantined+=hitsrc.quarantined;
              summaryObj.stale+=hitsrc.stale_resources;
            }
          });
          var den = summaryObj.active+summaryObj.stale+summaryObj.quarantined;
          if (den>0)
            retObj.resourceFrac.value = summaryObj.active_run / den;
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
          
        }, function (error){
          //return default reponse in case of index missing
          if (error.message.indexOf("IndexMissingException")===0) {
            var retObj = {
                   "output":{"value":null},
                   "ramdisk":{"value":null},
                   "ramdiskused":{"value":null},
                   "data":{"value":null},
                   "dataused":{"value":null},
                   "outputused":{"value":null},
                   "resourceFrac":{"value":null}
            }
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
            return;
          }
          _this.excpEscES(res,error,requestKey);
          console.trace(error.message);
        });//end  client.search(...)
      }//q2

      //submits query to the ES and returns formatted response to the app client
      this.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body : JSON.stringify(this.queryJSON1)
      }).then(function (body){
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;

        retObj.resourceFrac={"value":null}
        if (qparam_runNumber==="false" || qparam_runNumber===false)
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
        else
          q2(retObj);

      }, function (error){
        //return default reponse in case of index missing
        if (error.message.indexOf("IndexMissingException")===0) {
          var retObj = {
                   "output":{"value":null},
                   "ramdisk":{"value":null},
                   "ramdiskused":{"value":null},
                   "data":{"value":null},
                   "dataused":{"value":null},
                   "outputused":{"value":null},
                   "resourceFrac":{"value":null}
          }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
          return;
        }
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });//end  client.search(...)

    }
  }

