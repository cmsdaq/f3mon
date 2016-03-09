'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var qname = 'getDisksStatus';
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');
    var ttl = this.ttls.getDisksStatus; //cached ES response ttl (in seconds) 
    var eTime = new Date().getTime();

    //GET query string params (needed to parameterize the query)
    var cb = req.query.callback;
    //the following check must not check types because non-set URL arguments are in fact undefined, rather than null valued
    this.checkDefault(qparam_runNumber,0);
    this.checkDefault(qparam_sysName,'cdaq');

    var qparam_runNumber = this.checkDefault(req.query.runNumber,"false");
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');


    var requestKey = 'getDisksStatus?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;

    var requestValue = this.f3MonCache.get(requestKey);

    if (requestValue=="requestPending"){
      requestValue = this.f3MonCacheSec.get(requestKey);
    }

    if (requestValue !== undefined) {
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
    } else {
      this.f3MonCache.set(requestKey, "requestPending", ttl);

      this.queryJSON1.query.wildcard.activeRuns.value =  '*'+qparam_runNumber+'*';

      var _this = this
      //submits query to the ES and returns formatted response to the app client
      this.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body : JSON.stringify(this.queryJSON1)
      }).then(function (body){
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;
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
                   "outputused":{"value":null}
          }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
          return;
        }
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });//end  client.search(...)

    }
  }

