'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

  var took = 0;
  var qname = 'getstreamlist';
  var _this = this

  //queries runindex_cdaq/stream_label and populates a list with all stream names for a run
  //(further filtering by ls interval is also possible to implement by using the 'from' and 'to' arguments)
  var eTime = new Date().getTime();
  var cb = req.query.callback;

  //GET query string params
  var qparam_runNumber = req.query.runNumber;
  //var qparam_from = req.query.from;
  //var qparam_to = req.query.to;
  var qparam_sysName = req.query.sysName;

  if (qparam_runNumber == null){qparam_runNumber = 124029;}
  //if (qparam_from == null){qparam_from = 1;}
  //if (qparam_to == null){qparam_to = 1;}
  if (qparam_sysName == null){qparam_sysName = 'cdaq';}

  var requestKey = 'getstreamlist?='+qparam_runNumber+'&='+qparam_sysName;
  var ttl = global.ttls.getstreamlist; //cached ES response ttl (in seconds)

  var retObj = {
        "streamList" : []
  };

  var q = function(){
    //_this.queryJSON1.query.bool.must[0].prefix._id = 'run'+qparam_runNumber;
    _this.queryJSON1.query.bool.must[0].parent_id.id = 'run'+qparam_runNumber;

    global.client.search({
     index: 'runindex_'+qparam_sysName+'_read',
     type: 'stream_label',
     body : JSON.stringify(_this.queryJSON1)
     }).then (function(body){
      try {
        took+=body.took
        var results = body.hits.hits; //hits for query
	var set = {};
	for (var i=0;i<results.length;i++){
		if (!set.hasOwnProperty(results[i]._source.stream)){
			retObj.streamList.push(results[i]._source.stream);
			set[results[i]._source.stream] = true;	//avoiding duplicates, if they occur
		}
	}

          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
      } catch (e) {_this.exCb(res,e,requestKey)}
    }, function (error){
      _this.excpEscES(res,error,requestKey);
      console.trace(error.message);
    });
  };//end q

  if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false)
    q(); //call q1 with q2 as its callback
}

