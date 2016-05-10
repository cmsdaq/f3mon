'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'nstates-summary';

    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'nstates-summary request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_sysName = req.query.sysName;
    var qparam_runNumber = req.query.runNumber;
    var qparam_numIntervals = req.query.numIntervals;
    var qparam_timeRange = req.query.timeRange;
    var qparam_maxTime = req.query.maxTime;
    var qparam_minLs=req.query.minLs;
    var qparam_maxLs=req.query.maxLs;
    var qparam_format=req.query.format;

    if (qparam_runNumber === null || qparam_runNumber===undefined){qparam_runNumber = 0;}
    else { qparam_runNumber = parseInt(req.query.runNumber);}
    if (qparam_sysName === null){qparam_sysName = 'cdaq';}
    if (qparam_numIntervals === null){qparam_numIntervals = 50;}
    else {qparam_numIntervals = parseInt(req.query.numIntervals);}
    if (qparam_format===null) qparam_format='hc'

    //console.log('nints '+qparam_numIntervals);

//"numIntervals":"10","runNumber":"262742","sysName":"cdaq","timeRange":"300"}

    if (qparam_timeRange == null){qparam_timeRange = "302";}
    if (qparam_maxTime == null){qparam_maxTime = "now-2s";}

    //switch to non-live mode
    if (qparam_minLs!==undefined && qparam_maxLs!==undefined) {
        qparam_timeRange=null;
        qparam_maxTime=null;
    }
    
    var minTs=null;
    var maxTs=null; 

    var hcformat=true;
    if (qparam_format==='nvd3') hcformat=false;

    //if (qparam_numIntervals == null){qparam_numIntervals = "1000";}
    var took = 0;

    var requestKey;
    var requestKeySuffix = '&'+qparam_timeRange
                           +'&'+qparam_maxTime
                           +'&'+qparam_numIntervals
                           +'&'+qparam_sysName;
                           +'&'+qparam_minLs
                           +'&'+qparam_maxLs
                           +'&'+qparam_format
    //make hash out of string
    var requestKey = qname+'?runNumber=' + qparam_runNumber +requestKeySuffix;//+ requestKeySuffix.reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    var requestValue = this.f3MonCache.get(requestKey);
    var ttl = this.ttls.nstatesSummary; //cached ES response ttl (in seconds)


    var retObj = {
            "format"   : qparam_format,
	    "lastTime" : null,
	    "timeList" : null,
	    "data" : ""
    };

    var legend = {};
    var reserved;
    var special;
    var output;
    var ustatetype = "state-hist-summary";

    var idxmap = {};

    var _this = this

    //var properties = [];
    var q1 = function() {

      _this.queryJSON3.query.bool.must.term._parent = qparam_runNumber;
      _this.queryJSON3.query.bool.should[0].term.ls = qparam_minLs;
      _this.queryJSON3.query.bool.should[1].term.ls = qparam_maxLs;
      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
        body : JSON.stringify(_this.queryJSON3)
      }).then (function(body){
	took += body.took;
        if (body.hits.total===0) {
          retObj.data = [];
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }
        else {  
          minTs = body.aggregations.lsmin.value;
          maxTs = body.aggregations.lsmax.value+23400;//add 1 LS
          q2();
        }
      }, function (error){
              _this.excpEscES(res,error);
              console.trace(error.message);
      });

    } //end q1

    //Get legend
    var q2 = function() {
      _this.queryJSON1.query.term._parent = qparam_runNumber;
      //console.log('xxxx'+JSON.stringify(queryJSON1));

      _this.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'microstatelegend',
        body : JSON.stringify(_this.queryJSON1)
      }).then (function(body){
	took += body.took;
        if (body.hits.total ===0){
          retObj.data = [];
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }else{
          if (hcformat) retObj.data = {};
          else retObj.data = [];
          var result = body.hits.hits[0]; //hits for query
          reserved = result._source.reserved;
          if (reserved===undefined) reserved=33
	  special = result._source.special;
          if (special===undefined) special=7
	  output = result._source.output;
          if (result._source.stateNames===undefined) {
            retObj.data = [];
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
          }
	  else {
	    var shortened = result._source.stateNames;
	    for (var i = 0 ; i< special ; i++) {
	        legend[i]=shortened[i];
              if (hcformat) {
	        retObj.data[shortened[i]] = [];
              }
              else {
                idxmap[shortened[i]]=retObj.data.length
	        retObj.data.push({key:shortened[i],values:[]});
              }
            }
	    legend[special]='hltOutput';
	    legend[reserved]='Busy';
            if (hcformat) {
	      retObj.data['hltOutput'] = [];
	      retObj.data['Busy'] = [];
            }
            else {
              idxmap['hltOutput']=retObj.data.length;
              retObj.data.push({key:'hltOutput',values:[]})
              idxmap['Busy']=retObj.data.length;
              retObj.data.push({key:'Busy',values:[]})
            }

		//discovering array keys
		//var properties = [];
		//for (var pName in retObj.data)
		//	properties.push(pName);
	    ustatetype = "state-hist-summary";
	    q3();
	  }
        }
      }, function (error){
	      _this.excpEscES(res,error);
	      console.trace(error.message);
      });

    }//end q2


    //Get states
    var q3 = function(){
        _this.queryJSON2.query.bool.must[0].term._parent = parseInt(qparam_runNumber);
        //TODO: use fm_date field here..(all remapped documents will contain it)

        //elastic 2.2 doesn't support date_histogram interval < 1 sec
        if (qparam_maxTime!==null) {
          if (qparam_maxTime.substr(0,3)==('now')) {
	    _this.queryJSON2.query.bool.must[1].range.date.to = qparam_maxTime;
	    _this.queryJSON2.query.bool.must[1].range.date.from = 'now-'+parseInt(qparam_timeRange)+'s';
          }
          else { //unix timestamp
	    _this.queryJSON2.query.bool.must[1].range.date.to = parseInt(qparam_maxTime);
	    _this.queryJSON2.query.bool.must[1].range.date.from = Math.Round(parseInt(qparam_maxTime)-(1000*parseInt(qparam_timeRange)));
          }
          var intval = parseInt(qparam_timeRange)/parseInt(qparam_numIntervals);
          //console.log(intval)
          if (intval<1) intval = 1
          _this.queryJSON2.aggs.dt.date_histogram.interval=intval+'s'
        }
        else {
          //LS time interval
          _this.queryJSON2.query.bool.must[1].range.date.to = maxTs;
          _this.queryJSON2.query.bool.must[1].range.date.from = minTs;
          var intval = (maxTs-minTs)/(1000.*parseInt(qparam_numIntervals));
          //console.log(intval)
          if (intval<1) intval = 1
          _this.queryJSON2.aggs.dt.date_histogram.interval=intval+'s'
        }

	_this.client.search({
          index: 'runindex_'+qparam_sysName+'_read',
          type: ustatetype,
          body : JSON.stringify(_this.queryJSON2)

        }).then (function(body){
	  took += body.took;
          var results = body.aggregations.dt.buckets; //date bin agg for query
          var timeList = [];

          //console.log(JSON.stringify(results));
	  var entrycnt = 0;	
	  for (var i=0;i<results.length;i++){
            if (results[i].doc_count !== 0) {
            entrycnt++;
	    var timestamp = results[i].key;
            timeList.push(timestamp)
            //console.log(results[i]);
	    var entries = results[i].entries.keys.buckets;
	    //var entriesList = [];
            //console.log(JSON.stringify(retObj.data))
            if (hcformat)
              for (var ikey in retObj.data)
                retObj.data[ikey].push([timestamp,0]);//null?
            else
              for (var iidx=0; iidx<retObj.data.length;iidx++)
                retObj.data[iidx].values.push([timestamp,0])

	    for (var index=0;index<entries.length;index++) {
              var ukey = entries[index].key;
              var add=false;
              //console.log('entry'+JSON.stringify(entries[index]))
              if (!legend.hasOwnProperty(ukey)) {
                if (ukey>=special && ukey<reserved) {add=true;ukey=special;}
                else {
                  console.log('warning: key ' + ukey + ' out of range');
                  continue;
                }
              }
              var name = legend[ukey];
              //console.log('myname '+ name + hcformat + idxmap[name])
	      var value = entries[index].counts.value;
              if (hcformat) {
                if (add) retObj.data[name][entrycnt-1][1]+=value;
                else retObj.data[name][entrycnt-1][1] = value;
              }
              else {
                if (add) retObj.data[idxmap[name]].values[entrycnt-1][1]+=value;
                else retObj.data[idxmap[name]].values[entrycnt-1][1]=value;
              }

            }
            }
          }

          retObj.timeList = timeList;	
	  if (results.length>0)
	    retObj.lastTime = results[results.length-1].key;

          if (!hcformat) retObj.data.reverse();
           _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }, function (error) {
	    _this.excpEscES(res,error);
	    console.trace(error.message);
      });

    }//end q3

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

      if (qparam_minLs!=null && qparam_maxLs!==null) {
        q1();
      }
      else {
        q2(); //call q1 with q2 as its callback
      }

    } else
      this.sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
  }

