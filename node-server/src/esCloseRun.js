'use strict';

var client;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cl) {
    client=cl;
  },

  query : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'closeRun request');

    var cb = req.query.callback;
    var retObj = {
        "runDocument" : "",
        "riverDocument" : ""
    };

    //GET query string params
    var qparam_query = req.query.query;
    var qparam_runNumber = req.query.runNumber;
    var qparam_sysName = req.query.sysName;

    if (qparam_query == null){qparam_query = 'runinfo';}
    if (qparam_runNumber == null){qparam_runNumber = 180017;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}

    var sendResult = function(){
      res.set('Content-Type', 'text/javascript');
      res.header("Cache-Control", "no-cache, no-store");
      res.send(cb +' ('+JSON.stringify(retObj)+')');
    }
   
    var del = function(callback){
      //currently disabled (river daemon script)
      callback();
      return;
    
      client.indices.delete({
        index: 'river',
        type: 'instance',
        id: 'river_'+qparam_sysName+'_'+qparam_runNumber
      }).then (function(body){
        retObj.riverDocument = body;
        callback();
      }, function (error) {
        retObj.riverDocument = error.body;
        console.trace(error.message);
        callback();
      });
    }//end del

    var write_endtime = function (callback){
  
      var time = new Date().toISOString(); //current timestamp
      client.update({
        index: 'runindex_'+qparam_sysName+'_write',
        type: 'run',
        id: qparam_runNumber,
        refresh:true, //make sure this is written when reply is received
        body: {doc:{endTime : time,activeBUs:0}}
      }).then (function(body){
        retObj.runDocument = body;
        callback(sendResult);
      }, function (error) {
	excpEscES(res,error);
        console.trace(error.message);
      });
    }//end put

    var endCallback = function(callback) {
      callback();
    }

    write_endtime(endCallback);
  }
}

