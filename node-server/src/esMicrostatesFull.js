'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'fullstate';

    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');
    var qparam_runNumber = req.query.runNumber;
    var qparam_numIntervals = req.query.numIntervals;
    var qparam_timeRange = req.query.timeRange;
    var qparam_maxTime = req.query.maxTime;
    var qparam_minLs=parseInt(req.query.minLs);//todo:protect ranges
    var qparam_maxLs=parseInt(req.query.maxLs);

    if (isNaN(qparam_runNumber))
      res.status(500).send("Run number is required");
    //if (qparam_runNumber === null || qparam_runNumber===undefined){qparam_runNumber = 0;}
    else { qparam_runNumber = parseInt(req.query.runNumber);}
    if (qparam_numIntervals === null){qparam_numIntervals = 50;}
    else {qparam_numIntervals = parseInt(req.query.numIntervals);}

    var took = 0;
    var dohtcorr = true;

    var requestKey;
    var requestKeySuffix = 
                           +'&'+qparam_numIntervals
                           +'&'+qparam_sysName;
                           +'&'+qparam_minLs
                           +'&'+qparam_maxLs
    //make hash out of string
    var requestKey = qname+'?runNumber=' + qparam_runNumber +requestKeySuffix;
    var requestValue = this.f3MonCache.get(requestKey);
    var ttl = this.ttls.nstatesSummary; //cached ES response ttl (in seconds)


    var retObj = {
	    "lastLS" : null,
	    "lsList" : null,
	    "data" : ""
    };

    var classObjs = [];


    var legend = [];

    var intval = 1;//todo: aggregation

    var _this = this

 
    //Get legend
    var q2 = function() {
      var numls = qparam_maxLs-qparam_minLs+1
      _this.queryJSON1.query.term._parent = qparam_runNumber;
      console.log('runindex_'+qparam_sysName+'_read/microstatelegend/_search?pretty -d\''+JSON.stringify(_this.queryJSON1)+'\'');

      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'microstatelegend',
        body : JSON.stringify(_this.queryJSON1)
      }).then (function(body){
        try {
	took += body.took;
        retObj.data = {};
        if (body.hits.total ===0){
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }else{
          var result = body.hits.hits[0]; //hits for query
	  legend = result._source.stateNames;
          retObj.lsList = []
          for (var j=qparam_minLs;j<qparam_minLs+numls;j++) retObj.lsList.push(j);
          retObj.lastLs=qparam_maxLs;

	  for (var i = 0 ; i< legend.length ; i++) {
	        retObj.data[legend[i]] = [];
                for (var j=qparam_minLs;j<qparam_minLs+numls;j++) retObj.data[legend[i]].push([j,0])
            }

	    q3();
	}
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
	      _this.excpEscES(res,error,requestKey);
	      console.trace(error.message);
      });

    }//end q2


    //Get state classes
    var mclasses= [];


    //
//    var fuHEPSpec = {"24":208,"32":386,"48":640,"56":640};
    var fuHEPSpec = {"24":208,"32":386,"48":640,"56":700};
    var htEff = 0.25 ; //quite optimistic

    var rescale =  1 / (0.5 + 0.5*htEff)

    var getHTEff = function(frac) {
      if (frac<0.5) return frac*rescale;
      else return (0.5 + (frac-0.5)*htEff)*rescale
    }



    var q3 = function(){

        var qJSON = {"size":0,"aggs":{"classes":{"terms":{"field":"mclass","size":100}}}}

	_this.clientESlocal.search({
          index: 'run'+qparam_runNumber+'_'+qparam_sysName,
	  type : 'prc-s-state',
          body : JSON.stringify(qJSON)
         }).then(function(body) {
           try {
             body.aggregations.classes.buckets.forEach(function(item) {mclasses.push(item.key)});

             if (mclasses.length) q4(mclasses.pop());
             else
               _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
           } catch (e) {_this.exCb(res,e,requestKey)}
         }
         , function (error) {
	    _this.excpEscES(res,error,requestKey);
	    console.trace(error.message);
         });
    }

    var classRefs = []

    var q4 = function(className){

        //var cref = //JSON.parse(JSON.stringify(retObj))
        //console.log(cref)
        var cref = {data:{}}
        Object.keys(retObj.data).forEach(function(key) {
          var arr = []
          for (var i=0;i<retObj.data[key].length;i++) arr.push([retObj.data[key][0],0])
          cref.data[key]=arr;
        }
        );


        classRefs.push(cref)

        var mc = className.split('_');
        var hepPerCore = fuHEPSpec[mc[0]]/mc[1]

        //var qJSON = {"size":9999,"query":{"bool":{"must":[{"term":{"mclass":className}},{"range":{"ls":{from:qparam_minLs,to:qparam_maxLs}}}] }},"sort":{"ls":"asc"}}
        //var qJSON = {"size":100,"query":{"bool":{"must":[{"term":{"mclass":className}},{"range":{"ls":{from:qparam_minLs,to:qparam_maxLs}}}] }},"sort":{"ls":"asc"}}
        var qJSON = {"size":1000,"query":{"bool":{"must":[{"term":{"mclass":className}},{"range":{"ls":{from:qparam_minLs,to:qparam_maxLs}}}] }}}
        var intval = 1;
        var numls = qparam_maxLs-qparam_minLs+1
        //console.log(intval)
        if (intval<1) intval = 1

        console.log('q5')
	_this.clientESlocal.search({
          index: 'run'+qparam_runNumber+'_'+qparam_sysName,
	  type : 'prc-s-state',
          body : JSON.stringify(qJSON)

        }).then (function(body){
          try {
	    took += body.took;
            var lsIdx=0
            var results =body.hits.hits;

	    for (var i=0;i<results.length;i++){
              var resl = results[i]._source
              lsIdx=resl.ls-qparam_minLs

              var totAll=0;
              var totAllInv=0;
              var idle = 0;
	      for (var index=0;index<resl.microv.length;index++) {
                if (resl.microv[index].key==2) idle=resl.microv[index].value;
                totAll+=resl.microv[index].value
              }
              if (totAll>0) {
                totAllInv = 1/totAll;
                if (dohtcorr) {
                   var eff = (totAll-idle)/totAll;
                   var hteff = getHTEff((totAll-idle)/totAll);
                   var effboost = hteff/eff
                   for (var index=0;index<resl.microv.length;index++) {
                     var key = resl.microv[index].key;
                     var val = parseFloat(resl.microv[index].value);
                     if (key==2) val = (1-hteff)*val*totAll;
                     else val = val*hteff
                     //console.log(cref[legend[key]])
                     cref.data[legend[key]][lsIdx][1] += parseFloat(val)*hepPerCore //normalize? *= totAllInv (to assume all LS last the same time)
                   }
                }
                else for (var index=0;index<resl.microv.length;index++) {
                  var key = resl.microv[index].key;
                  cref[legend[key]][lsIdx] += resl.microv[index].value
                }
              }
            }
          if (mclasses.length) q4(mclasses.pop());
          else
             sumAndFinish();
          } catch (e) {_this.exCb(res,e,requestKey)}
        }, function (error) {
	    _this.excpEscES(res,error,requestKey);
	    console.trace(error.message);
      });

    }//end q3

    var sumAndFinish = function () {
       classRefs.forEach(function(item){
         Object.keys(item.data).forEach(function(key) {
           var src = item.data[key];
           var targ = retObj.data[key];
           for (var i=0;i<src.length;i++) targ[i][1]+=src[i][1]; //sum all classes
         });
       });
      _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
    }

    var pending=false
    if (requestValue=="requestPending"){
      pending=true
      requestValue = this.f3MonCacheSec.get(requestKey);
    }

    if (requestValue === undefined) {
      if (pending) {
        this.putInPendingCache({"req":req,"res":res,"cb":cb,"eTime":eTime},requestKey,ttl);
        return;
      }
      this.f3MonCache.set(requestKey, "requestPending", ttl);

        q2(); 
//    }

    } else
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
  }

