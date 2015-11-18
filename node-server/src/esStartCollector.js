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

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'startCollector request');

    var cb = req.query.callback;
    var retObj = {
      "oldRiverDocument" : "",
      "newRiverMapping" : "",
      "newRiverDocument" : ""
    };
    var source;
    var mapping = {};


    //GET query string params
    var qparam_runNumber = req.query.runNumber;
    var qparam_sysName = req.query.sysName;

    if (qparam_runNumber == null){qparam_runNumber = 37;}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}

    var sendResult = function(){
      res.set('Content-Type', 'text/javascript');
      res.send(cb +' ('+JSON.stringify(retObj)+')');
    }

    //start collector
    var q4 = function(callback){
      client.index({
        index:'_river',
        type:'runriver_'+qparam_runNumber,
        id:'_meta',
        body:source
      }).then(function(body){
        retObj.newRiverDocument = body;
        callback(); //calls sendResult to end the callback
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }//end q4

    //put dynamic mapping
    var q3 = function(callback){
      client.indices.putMapping({
        index:'_river',
        type:'runriver_'+qparam_runNumber,
        body:mapping
      }).then(function(body){
        retObj.newRiverMapping = body;
        callback(sendResult);
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      }); 
    }//end q3

    //deleting old instances
    var q2 = function(callback){
      client.indices.deleteMapping({
        index:'_river',
        type:'runriver_'+qparam_runNumber
      }).then (function(body){
        retObj.oldRiverDocument = body;
        callback(q4);
      }, function (error){
        retObj.oldRiverDocument = error.body;
        console.trace(error.message);
        callback(q4);
      });

    }//end q2

/*
 *-initial version-
 * retrieves all entries from an index type (first step on bulk operations on these entries)
var getAllEntries = function(callback){
  client.search({
   index: '_river',
   type: 'runriver_'+qparam_runNumber,
   body: JSON.stringify({
	"query" : {
 		"match_all" : { }
		}
	})  }).then (function(body){
	var results = body.hits.hits;
	var ids = [];
	for (i=0;i<results.length;i++){
		ids[i] = results[i]._id;
	}
	//callback(...); //fill with callback function, if needed
  }, function (error){
        console.trace(error.message);
  });
}*/

    //get parameters from the main river
    var q1 = function (callback){
      var runIndex = 'runindex_'+qparam_sysName+'_read';
      client.search({
        index: '_river',
        type: 'runriver',
        body : JSON.stringify({
          "query" : {
            "term" : {
              "runIndex_read" : {
                "value" : runIndex
              }
            }
          }
        })
      }).then (function(body){
        var results = body.hits.hits; //hits for query
        //console.log(results.length);
	source = results[0]._source; //throws cannot read property error if result list is empty (no hits found) because results[0] is undefined 
	if (source == null || !source){
	  res.send();
	}else{
	  source["role"] = 'collector';
	  source["runNumber"] = qparam_runNumber;
	  source["startsBy"] = 'Web Interface';
	  mapping["dynamic"] = true; //assigns value to callback-wide scope variable
	  callback(q3);
	}

      },function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }//end q1
    q1(q2);
  }
}





