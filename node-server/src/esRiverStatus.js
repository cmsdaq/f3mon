'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'riverStatus';
 
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'riverStatus request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_size = req.query.size;
    if (qparam_size == null){qparam_size = 100;}

    var qparam_query = 'riverstatus';
    var requestKey = qname+'?size='+qparam_size+'&query='+qparam_query;
    var ttl = global.ttls.riverStatus; //cached ES response ttl (in seconds)

    //parameterize query fields 
    this.queryJSON1.size = qparam_size;

    //console.log(JSON.stringify(this.queryJSON1))
    var _this = this;

    //search ES - Q2 (get meta)
    var q1 = function (){

      global.client.search({
        index:'river',
        type:'instance',
        body: JSON.stringify(_this.queryJSON1)
      }).then (function(body){
        try {
        took+=body.took
        var results = body.hits.hits;
	
	var systemsArray = []; //part of output
	var runsArray = []; //part of output

        var stat = [];
        var host = [];
	var source = [];
	var system = [];
        var index = 0;

        var prepareLookup = function () {
          if (index < results.length) {

		var type = results[index]._type; //'instance'
		source[index] = results[index]._source;
                system[index] = source[index].subsystem
                stat[index] = source[index].node.status
                host[index] = source[index].node.name
                formatEntry(index);
                index++;
                prepareLookup();
          }
          else {
            response();
          }
        };

        var formatEntry = function(idx) {
		if (source[idx].hasOwnProperty("runNumber") && source[idx].runNumber!==0){
			var o  = {
				"runNumber" : source[idx].runNumber,
				"status" : stat[idx],
				"host" : host[idx],
				"subSystem" : system[idx]
			};
			runsArray.push(o);
		}else{
			var o  = {
                                "subSystem" : system[idx],
				"status" : stat[idx],
				"host" : host[idx]
                        };
			systemsArray.push(o);
                }
        }
         
        var response = function() {
	
	  //formats response
	  var retObj = {
		"systems" : systemsArray,
		"runs" : runsArray
	  };
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
	}

        prepareLookup(); //initial caller
        } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
	_this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }//end q1

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
      q1();
    }
  }


