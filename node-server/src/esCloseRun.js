'use strict';

var client;
var JSONPath = '../src/json/'; //set in each deployment
//var JSONPath = './json/'; //set in each deployment

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
    //var source;
    //var mapping = {};

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
      client.indices.deleteMapping({
        index: '_river',
        type: 'runriver_'+qparam_runNumber
      }).then (function(body){
        retObj.riverDocument = body;
        callback();
      }, function (error) {
        retObj.riverDocument = error.body;
        console.trace(error.message);
        callback();
      });
    }//end del

    var put = function (callback, ret){
  
      client.index({
        index: 'runindex_'+qparam_sysName+'_write',
        type: 'run',
        id: qparam_runNumber,
        body: ret
      }).then (function(body){
        retObj.runDocument = body;
        callback(sendResult);
      }, function (error) {
	excpEscES(res,error);
        console.trace(error.message);
      });
    }//end put

    var q1= function(callback){
      //loads query definition from file
      var queryJSON = require (JSONPath+qparam_query+'.json');
      //var queryJSON = getQuery(qparam_query+".json");
      queryJSON.filter.term._id = qparam_runNumber;
      client.search({
        index: 'runindex_'+qparam_sysName+'_write',
        type: 'run',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
	var results = body.hits.hits; //hits for query 
        if (results.length == 0){
          res.send();
        }else{
          var time = new Date().toISOString(); //current timestamp
          var ret = results[0]._source;
          ret.endTime = time;
          callback(del,ret); //passing control to its callback (here:put)
        }
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q1

    q1(put);
  }
}





