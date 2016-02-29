'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var smdb;
var clientESlocal;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
  //message can be augmented with info from error
  res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

var checkDefault = function(value,defaultValue) {
  if (value === "" || value === null || value === undefined || value === 'false' || value==="null") return defaultValue;
  else return value;
}

function log10(number) { return Math.log(number) / Math.log(10); }

function getIntervalTail(interval) {
  //for interval that is for example 0.33, this returns log10 value of the tail of 0.03 (that should be used for rounding)
  var intervalstr = ""+interval;
  var digitdistance = intervalstr.length-2;
  var lastDigit = parseFloat(intervalstr.substring( interval.length-1, intervalstr.length));
  //console.log(lastDigit/Math.pow(10,digitdistance))
  var suffix = (lastDigit/Math.pow(10,digitdistance)).toFixed(digitdistance);
  //console.log(Math.ceil(Math.log(1/suffix)/Math.log(10)))
  return Math.ceil(Math.log(1/suffix)/Math.log(10));

}


var sendResult = function(req,res,requestKey,cb,cached,obj,qname,eTime,ttl) {
  var srvTime = (new Date().getTime())-eTime;
  totalTimes.queried += srvTime;
  if (cached) {
    console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
  } else {
    f3MonCache.set(requestKey, [obj,ttl], ttl);
    console.log(qname+' (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
  }
  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  if (cb!==null)
    res.send(cb +' ('+JSON.stringify(obj)+')');
  else
    res.send(JSON.stringify(obj));
}


module.exports = {

  setup : function(cache,cacheSec,cl,cleslocal,smdbm,ttl,totTimes,queryJSN) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    clientESlocal=cleslocal;
    ttls = ttl;
    totalTimes = totTimes;
    smdb = smdbm
    //queryJSON = queryJSN;
  },

  fuhistos : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'small request');

    var eTime = new Date().getTime();
    var ttl = ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = checkDefault(req.query.callback,null);
    var qparam_setup = checkDefault(req.query.setup,'cdaq');
    var qparam_int = checkDefault(req.query.interval,100);
    var monitored = checkDefault(req.query.monitored,"cpu_MHz_avg_real");
    var perbuv = checkDefault(req.query.perbu,false);
    //var qparam_to = req.query.to;

    var requestKey = 'smallpic_fuhistos?setup='+qparam_setup+'&='+qparam_int+'&='+monitored+'&='+perbuv;
    var qname = 'smallpic_fuhistos';

    var q = function() {

      var queryJSON = {
        "size":0,
        "query":{"range":{"date":{"gte":"now-10s"}}},
        "aggs":{
          "cloud":{"filter":{"bool":{"must_not":[{"term":{"cloudState":"off"}}]}},
            "aggs":{
              "cpufreq":{"histogram":{"field":monitored,"interval":qparam_int,"min_doc_count" : 1}},
              "percpu":{
                "terms":{"field":"cpu_name"},
                "aggs":{"cpufreq":{"histogram":{"field":monitored,"interval":qparam_int,"min_doc_count" : 1}}}
              }
            }
          },
          "hlt":{"filter":{"term":{"cloudState":"off"}},
            "aggs":{

              "cpufreq":{"histogram":{"field":monitored,"interval":qparam_int,"min_doc_count" : 1}},
              "percpu":{
                "terms":{"field":"cpu_name"},
                "aggs":{"cpufreq":{"histogram":{"field":monitored,"interval":qparam_int,"min_doc_count" : 1}}}
              },
              "perbu":{
                "terms":{"field":"appliance","size":200,"order" : { "_term" : "asc" }},
	        "aggs":{"total":{"sum":{"field":monitored}}}
              }
            }
          }
        }
      };

      if (!perbuv) delete queryJSON.aggs.hlt.perbu;

      client.search({
        index: 'boxinfo_'+qparam_setup+'_read',
        type: 'fu-box-status',
        body: JSON.stringify(queryJSON)
      }).then (function(body){

        var afreq = body.aggregations.cloud.cpufreq.buckets;
        var afreqhlt = body.aggregations.hlt.cpufreq.buckets;


        var retObj = {
          "all":{},
          "perbu":[]
        };
 
        var data = [];
        for (var i=0;i<afreq.length;i++) {if (afreq[i].key<10000) data.push([afreq[i].key,afreq[i].doc_count]);}
        retObj['all']['cpufreqcloud']=data;
        data = [];
        for (var i=0;i<afreqhlt.length;i++) {if (afreqhlt[i].key<10000) data.push([afreqhlt[i].key,afreqhlt[i].doc_count]);}
        retObj['all']['cpufreqhlt']=data;

        var apercpu = body.aggregations.cloud.percpu.buckets;
        for (var j=0;j<apercpu.length;j++) {
          var cpu = apercpu[j];
          afreq = cpu.cpufreq.buckets;
          data = [];
          for (var i=0;i<afreq.length;i++) {if (afreq[i].key<10000) data.push([afreq[i].key,afreq[i].doc_count])};
          retObj[cpu.key]={'cpufreqcloud':data};
        }

        var apercpu = body.aggregations.hlt.percpu.buckets;
        for (var j=0;j<apercpu.length;j++) {
          var cpu = apercpu[j];
          afreq = cpu.cpufreq.buckets;
          data = [];
          //temporary: limit key value until wrapping management is in hltd
          for (var i=0;i<afreq.length;i++) {if (afreq[i].key<10000) data.push([afreq[i].key,afreq[i].doc_count]);}
          if (retObj.hasOwnProperty(cpu.key))
            retObj[cpu.key]['cpufreqhlt']=data;
          else
          retObj[cpu.key]={'cpufreqhlt':data};
        }

        if (perbuv) {
          var bubuckets = body.aggregations.hlt.perbu.buckets
          for (var i=0;i<bubuckets.length;i++) {
            //temporary: limit key value until wrapping management is in hltd
            if (bubuckets[i].total.value<10000)
              retObj.perbu.push([bubuckets[i].key,bubuckets[i].total.value])
            else
              retObj.perbu.push([bubuckets[i].key,0])
          }
        }


        sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);

      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }




    var q2 = function() {


      var queryJSON = {
        "size":1000,
        "sort":{},//highchart requires everything sorted
        "query":{"range":{"date":{"gte":"now-10s"}}},
        "aggregations":{
          "hlt":{"filter":{"term":{"cloudState":"off"}},
            "aggs":{
              "perbu":{
                "terms":{"field":"appliance","size":200,"order" : { "_term" : "asc" }},
	        "aggs":{"total":{"sum":{"field":monitored}}}
              }
            }
          }
        }
      };
      if (!perbuv) delete queryJSON.aggregations;

      queryJSON.sort[monitored]="asc";

      client.search({
        index: 'boxinfo_'+qparam_setup+'_read',
        type: 'fu-box-status',
        body: JSON.stringify(queryJSON)
      }).then (function(body){

        var retObj = {
          "all":{"cpufreqhlt":[],"cpufreqcloud":[]},
          "perbu":[]
        };

        var retObjTmp = {
          "all":{"cpufreqhlt":{},"cpufreqcloud":{}}
        };

        var roundDigits = getIntervalTail(qparam_int);

        //console.log('interval:'+qparam_int + ' roundDigits:'+roundDigits);

        for (var i=0;i<body.hits.hits.length;i++) {

          var src = body.hits.hits[i]._source
          if (!retObj.hasOwnProperty(src.cpu_name)) {
            retObj[src.cpu_name]={"cpufreqhlt":[],"cpufreqcloud":[]};
            retObjTmp[src.cpu_name]={"cpufreqhlt":{},"cpufreqcloud":{}};
          }
          var val = src[monitored];
          var binval = parseFloat((val-val%qparam_int).toFixed(roundDigits));
          //console.log(binval);

          if (src.cloudState==="off")
            var freqname = 'cpufreqhlt';
          else
            var freqname = 'cpufreqcloud';

          if (retObjTmp.all[freqname].hasOwnProperty(binval)) {
            var index = retObjTmp.all[freqname][binval];
            retObj.all[freqname][index][1]+=1;
          }
          else {
            var index = retObj.all[freqname].length;
            retObjTmp.all[freqname][binval]=index
            retObj.all[freqname].push([binval,1]);
          }

          //console.log(''+JSON.stringify(retObjTmp[src.cpu_name][freqname]) + ' has?: ' + retObjTmp[src.cpu_name][freqname].hasOwnProperty(binval) + ' for binval'+ binval)

          if (retObjTmp[src.cpu_name][freqname].hasOwnProperty(binval)) {
            var index = retObjTmp[src.cpu_name][freqname][binval];
            retObj[src.cpu_name][freqname][index][1]+=1;
          }
          else {
            var index = retObj[src.cpu_name][freqname].length;
            retObjTmp[src.cpu_name][freqname][binval]=index
            retObj[src.cpu_name][freqname].push([binval,1]);
          }
        }

        if (perbuv) {
          var bubuckets = body.aggregations.hlt.perbu.buckets
          for (var i=0;i<bubuckets.length;i++) {
            if (bubuckets[i].total.value<10000)
              retObj.perbu.push([bubuckets[i].key,bubuckets[i].total.value])
            else
              retObj.perbu.push([bubuckets[i].key,0])
          }
        }

/*
          if (retObjTmp[src.cpu_name][freqname].hasOwnProperty(binval)) {
            var index = retObjTmp[src.cpu_name][freqname][binval];
            retObj[src.cpu_name][freqname][index][1]+=1;
          }
          else {
            var index = retObj[src.cpu_name][freqname].length;
            retObjTmp[src.cpu_name][freqname][binval]=index
            retObj[src.cpu_name][freqname].push([binval,1]);
          }*/
        sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);

      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }

    var requestValue = f3MonCache.get(requestKey);
    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);
      if (qparam_int>=1)
        q();
      else q2();
    }else {
      sendResult(req,res,requestKey,cb,true,requestValue[0],qname,eTime,ttl);
    }
    
  }//end
}

