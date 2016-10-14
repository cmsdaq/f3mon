'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0.;
    var qname = 'serverStatus';
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    //time
    var eTime = this.gethrms();

    var cb = req.query.callback;
    //console.log(cb);
    var requestKey = qname;
    var ttl = global.ttls.serverStatus; //cached ES response ttl (in seconds) 

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {

      var _this = this;

      //query elasticsearch health and bind return function to reply to the server
      global.client.cluster.health().then(function(body) {
        try {
        took+=body.took
        var retObj = {'status':body['status']};
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
       }, function (err) {
        _this.excpEscES(res,err,requestKey);
        console.log(err.message);
       }
      );
    }
  }

