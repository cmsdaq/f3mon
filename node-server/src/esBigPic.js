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

  query : function (req, res) {


    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'bigpic request');

    var eTime = new Date().getTime();
    var ttl = ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = checkDefault(req.query.callback,null);
    var qparam_sysName = checkDefault(req.query.setup,'cdaq');

    var requestKey = 'bigpic?sysName='+qparam_sysName;

    var requestValue = f3MonCache.get(requestKey);
    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    var unix_time;
    var retObj = {
      "setup":qparam_sysName
    };

    var buprefix="bu";
    var fuprefix="fu";
    if (qparam_sysName==="dv") {
      buprefix="dvbu";
      fuprefix="dvrubu";
    }

    var sendResult = function() {
	  f3MonCache.set(requestKey, [retObj,ttl], ttl);
	  var srvTime = (new Date().getTime())-eTime;
	  totalTimes.queried += srvTime;
	  console.log('bigpic (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
	  res.set('Content-Type', 'text/javascript');
          res.header("Cache-Control", "no-cache, no-store");
          if (cb!==null)
	    res.send(cb +' ('+JSON.stringify(retObj)+')');
          else
	    res.send(JSON.stringify(retObj));
    }


    var q3 = function() {

      var queryJSON = {
        "query":{"prefix":{"_id":fuprefix}},
        "size":1,
        "aggs" : {
          "bus":{
            "terms":{"size":200,"field":"appliance"},
            "aggs" : {
              "fu_hits":{"top_hits":{"size":30,"sort":[{"_id":{"order":"asc"}}]}},
              "filter_alive": {
                //"filter":{"range":{"fm_date":{"gte":"now-10s"}}}, //todo: detectedStaleHandle?
                "filter":{"bool":{"must":[{"range":{"fm_date":{"gte":"now-10s"}}}, {"term":{"detectedStaleHandle":false}}]}},

                //todo:add blacklisted flag to the doc
                "aggs":{
                  "idles":{"sum":{"field":"idles"}},
                  "idles_count":{"filter":{"bool":{"must":[{"range":{"idles":{"gte":1}}},{"term":{"used":0}}  ]}}}, //only if completely idle
                  "used":{"sum":{"field":"used"}},
                  "used_count":{"filter":{"range":{"used":{"gte":1}}}}, //if any is used --> host = used
                  "cloud":{"sum":{"field":"cloud"}},
                  "quarantined":{"sum":{"field":"quarantined"}},
                  "quarantined_nodes":{//todo: move this check to fu-box-status
                    //criteria: everything 0 except quarantined
                    "filter":{"bool":{"must":[{"range":{"quarantined":{"gte":1}}},{"term":{"idles":0}},{"term":{"used":0}},{"term":{"broken":0}},{"term":{"cloud":0}}]}},
                    "aggs" : {
                      "fus":{"terms":{"size":30,"field":"host"}}
                    }
                  },
                  "usedDataDir":{"sum":{"field":"usedDataDir"}},
                  "totalDataDir":{"sum":{"field":"totalDataDir"}}
                }
              },

              "filter_stale_handle": {
                "filter":{"bool":{"must":[{"range":{"fm_date":{"gte":"now-10s"}}}, {"term":{"detectedStaleHandle":true}}]}}, //
                "aggs":{"fus":{"terms":{"size":30,"field":"host"}}}
              },

              "filter_stale": {
                "filter":{"range":{"fm_date":{"gte":"now-3600s","lte":"now-10s"}}},
                "aggs":{"fus":{"terms":{"size":30,"field":"host"}}}
              },
              "filter_dead": {
                //"filter":{"range":{"fm_date":{"lte":"now-3600s"}}},
                "filter":{"bool":{"must_not":[{"range":{"fm_date":{"gte":"now-1h"}}}]}}, //seems faster than above
                "aggs":{"fus":{"terms":{"size":30,"field":"host"}}}
              }
            }
          }
        }
      };

      client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        //sendResult();//test
        //return;
        unix_time = Date.now();
        var buckets = body.aggregations.bus.buckets;
        for (var i=0;i<buckets.length;i++) {
          var key = buckets[i].key;
          var target = retObj["appliance_clusters"][key];
          var fu_count = buckets[i].doc_count;
          var alives = buckets[i].filter_alive;
          target.cloud = alives.cloud.value;
          target.online = alives.used.value;
          target.online_count = alives.used_count.doc_count;
          target.idle = alives.idles.value;
          target.idle_count = alives.idles_count.doc_count;
          target.quarantined = alives.quarantined.value;
          target.quarantined_nodes=[];
          for (var j=0;j<buckets[i].filter_alive.quarantined_nodes.fus.buckets.length;j++)
            target.quarantined_nodes.push(buckets[i].filter_alive.quarantined_nodes.fus.buckets[j].key);
          //break;
          for (var j=0;j<buckets[i].filter_stale.fus.buckets.length;j++) {
            var dkey = buckets[i].filter_stale.fus.buckets[j].key;
            var skip=false;
            for (var k=0;k<target.blacklisted_nodes.length;k++) {
              if (target.blacklisted_nodes[k]===dkey) {skip=true;break;}
            }
            if (!skip)
              target.stale.push(dkey);
          }
          //check for FUs that are stale but with document updated timely
          for (var j=0;j<buckets[i].filter_stale_handle.fus.buckets.length;j++) {
            var dkey = buckets[i].filter_stale_handle.fus.buckets[j].key;
            var skip=false;
            for (var k=0;k<target.blacklisted_nodes.length;k++) {
              if (target.blacklisted_nodes[k]===dkey) {skip=true;break;}
            }
            if (!skip)
              target.stale.push(dkey);
          }

          for (var j=0;j<buckets[i].filter_dead.fus.buckets.length;j++) {
            var dkey = buckets[i].filter_dead.fus.buckets[j].key;
            var skip=false;
            for (var k=0;k<target.blacklisted_nodes.length;k++) {
              if (target.blacklisted_nodes[k]===dkey) {skip=true;break;}
            }
            if (!skip) {
              target.dead.push(dkey);
            }
          }
          //find FUs that never appeared on data network, but have fu-box-status
          if (target.fu_count_nbl!==fu_count) {
            //check missing fu boxinfo docs
            var fu_hits = buckets[i].fu_hits.hits.hits;
            for (var j=0;j<target.fus_nbl.length;j++) {
              var found=false;
              for (var k=0;k<fu_hits.length;k++)
                if (fu_hits[k]._id===target.fus_nbl[j]) {found=true;break;}
              if (!found)
                target.disc.push(target.fus_nbl[j]);
            }
          }

          delete target.fus_nbl;
          target.uldisk = alives.usedDataDir.value;
          target.tldisk = alives.totalDataDir.value;
        }
        //done
        sendResult();

      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }
    //second callback: get fu-box-status info
    var q2=function() {

      //count cloud state in FUs:
      var queryJSON = {
                        "size":1,
                        "query":{"range":{"date":{"from":"now-20s"}}},
                        "aggs":{
                          "bus":{
                            "terms":{"size":200,"field":"appliance"},
                            "aggs":{
                              //"cloud":{"terms":{"field":"cloudState"}},
                              "cloud_filter":{"filter":{"term":{"cloudState":"on"}}}//,
                              //,"fu_hits":{"top_hits":{"size":1}}
                              ,"fu_hits":{"top_hits":{"size":30,"sort":[{"_id":{"order":"asc"}}]}},
                              //,"aggs":{"nodes":{"terms":{"size":50,"field":"_id"}}}
                              "cpu":{"terms":{"field":"cpu_name","size":1}}
                            }
                          }
                        }
                      };


      client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'fu-box-status',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        //unix_time = Date.now();
        //console.log(body.aggregations.bus.cloud_filter);
        var buagg =  body.aggregations.bus.buckets;
        var cnt_test=0;
        for (var i=0;i<buagg.length;i++) {
          var key = buagg[i].key;
          if (!retObj["appliance_clusters"].hasOwnProperty(key)) {
            if (key!=='unknown') //hilton (can get written in dv index, but no BU)
              console.log('appliance clusters dont have key '+key);
            continue;
          }
          var target = retObj["appliance_clusters"][key];

          var doc_count = buagg[i].doc_count;
          var fu_map = {};
          var cloud_fu_list = [];
          var fu_count_all=0
          var fu_count_nbl=0
          //workarounds until "id" field is added to fu-box-status
          var fu_hits = buagg[i].fu_hits.hits.hits;
          for (var j=0;j<fu_hits.length;j++) {
            var fu_id = fu_hits[j]._id; 
            var fu_src = fu_hits[j]._source; 
            var blacklisted = false;
            for (var k=0;k<target.blacklisted_nodes.length;k++) {
              if (target.blacklisted_nodes[k]===fu_id) {
                blacklisted=true;
                break;
              }
            }
            fu_count_all++;
            if (!blacklisted) {
              fu_count_nbl++;
              target.fus_nbl.push(fu_id);
              if (fu_hits[j]._source.cloudState==="on")
                cloud_fu_list.push(fu_id);
            }
            //target.fus.push(fu_id);
            target.fus[fu_id]={"effGHz":(fu_src.cpu_MHz_avg_real*0.001).toFixed(2),"nomGHz":(fu_src.cpu_MHz_nominal*0.001).toFixed(2),
                               "memPerc":(fu_src.memUsedFrac*100).toFixed(0),"cpuPerc":(fu_src.cpu_usage_frac*100).toFixed(0)};
              //fu_map[fu_id]={};//todo:fill (blacklist info, stale etc.)
          }
          //target.fus.sort();
          target.cloud_nodes = cloud_fu_list;
          target.fu_count_nbl = fu_count_nbl;
          target.fu_count_all = fu_count_all;
          if (buagg[i].cpu.buckets.length)
          target.cpu_name=buagg[i].cpu.buckets[0].key;
        }
        q3();
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }//q2

    //first callback (get list of active BUs from boxinfo)
    var q1=function() {
      //get all BU boxinfo documents
      var queryJSON = {
                        "sort":{"_id":"asc"},
                        "size":200,
                        "query":{
                              "prefix":{"_id":buprefix}
//                          "bool":{
//                            "should":[
//                              {"prefix":{"_id":"bu-"}},
//                              {"prefix":{"_id":"dvbu-"}}
//                            ]
//                          }
                        }
                      };

      //check timestamp..

      client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        unix_time = Date.now();
        var results = body.hits.hits;
        retObj["appliance_clusters"] = {};
        if (body.hits.length==0){
          //send empty response
          //retObj = {}//?
          sendResult();
        }else{
          var total = body.hits.total;
          var bumap = retObj.appliance_clusters;
	  for (var index = 0 ; index < results.length; index++){
            var bu = results[index]._id
            var source = results[index]._source
            var age = ((unix_time - new Date(source.fm_date).getTime())/1000.).toFixed(1); //todo:maybe have to add +0000 for GMT)

            console.log(source.activeRuns);

            bumap[bu] = {
                         "age":age,
                         "cpu_name":"",
                         "active_runs":source.activeRuns,
			 "connected":"connected",
                         "fus":{},
                         "fus_nbl":[],
                         "fu_count_nbl":0,
                         "fu_count_all":0,
                         "idle":0,
                         "idle_count":0,
                         "online":0,
                         "online_count":0,
                         "cloud":0,
                         //"quarantined":source.quarantined,//? (resources)
                         "quarantined":0,//? (resources)
                         "cloud_nodes":[], //fill
                         "quarantined_nodes":[], //fill
                         "blacklisted_nodes":source.blacklist.sort(),
                         "stale":[], //fill
                         "dead":[], //fill
                         "disc":[],//not in box,only in fu-box-status
                         "rdiskused":source.usedRamdisk,
                         "rdisktotal":source.totalRamdisk,
                         "uldisk":source.usedDataDir,
                         "tldisk":source.totalDataDir,
                         "odiskused":source.usedOutput,
                         "odisktotal":source.totalOutput
            };
	  }
          q2();
          //sendResult(); //test
        }

      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }//q1

    //first check cluster health
    var healthQuery = function(callback) {
      client.cluster.health().then (function(body) {
        retObj["central_server"] = {
          "status":body.status,
          "number_of_data_nodes":body.number_of_data_nodes,
          "active_primary_shards":body.active_primary_shards
        };
        callback();
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });
    }


    var healthQueryESlocal = function() {
      clientESlocal.cluster.health().then (function(body) {
        retObj["eslocal_server"] = {
          "status":body.status,
          "number_of_data_nodes":body.number_of_data_nodes,
          "active_primary_shards":body.active_primary_shards
        };
        q1();
      }, function (error){
        //excpEscES(res,error);
        console.error("error running es-local health query");
        console.trace(error.message);
        q1();//tolerate this error
      });
    }


    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      //q1();
      //healthQuery(q1);
      healthQuery(healthQueryESlocal);
      //get list of machines from DB (call uses separate cache key and timeout), pass callback to run after Oracle query
      //var ret = smdb.runPPquery("system",machineIndex,q1);
      //if (!ret) excpEscES(res,null); 

    }else{
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('bigpic (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.header("Cache-Control", "no-cache, no-store");
      if (cb!==null)
        res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
      else
        res.send(JSON.stringify(requestValue[0]));
    }
  },



  teols : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'bigpic request');

    var eTime = new Date().getTime();
    var ttl = ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = checkDefault(req.query.callback,null);
    var qparam_sysName = checkDefault(req.query.setup,'cdaq');
    var qparam_runNumber = req.query.runNumber;
    //var qparam_to = req.query.to;

    var requestKey = 'bigpic_teols?sysName='+qparam_sysName+'&rn='+qparam_runNumber;//+'&to='+qparam_to;


    var requestValue = f3MonCache.get(requestKey);
    if (requestValue=="requestPending"){
      requestValue = f3MonCacheSec.get(requestKey);
    }

    var retObj = {
    };

    var sendResult = function(cached,obj) {
	  var srvTime = (new Date().getTime())-eTime;
	  totalTimes.queried += srvTime;
          if (cached) {
	    console.log('bigpic_teols (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
          } else {
	    f3MonCache.set(requestKey, [obj,ttl], ttl);
	    console.log('bigpic_teols (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
          }
	  res.set('Content-Type', 'text/javascript');
          res.header("Cache-Control", "no-cache, no-store");
          if (cb!==null)
	    res.send(cb +' ('+JSON.stringify(obj)+')');
          else
	    res.send(JSON.stringify(obj));
    }

    var retObj = {
    };

    var maxls;

    var qmaxls = function() {

      var queryJSON = {
        "size":0,
        "query":{"bool":{"must":[{"term":{"_parent":qparam_runNumber}}]}},
        "aggregations":{
          "maxls":{
            "max":{"field":"ls"}
          }
        }
      };

      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        maxls = body.aggregations.maxls.value
        q(); 
      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }

    var q = function() {

      var queryJSON = {
        "size":0,
        "query":{"bool":{"must":[{"term":{"_parent":qparam_runNumber}}]}},
        "aggregations":{
          "streams":{
            "terms":{"field":"stream","size":0},
            "aggs":{
              "complete":{
                "filter":{
                  "range":{"completion":{"lte":1.0000000001,"gte":0.9999999999}}}},
              "incomplete":{
                "filter":{
                  "bool":{
                    "must_not":[{"range":{ "completion":{"lte":1.0000000001,"gte":0.9999999999}  }}]
                  }
                }
              }
            }
          }
        }
      };



      client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'stream-hist',
        body: JSON.stringify(queryJSON)
      }).then (function(body){

        var buckets = body.aggregations.streams.buckets;
        for (var i=0;i<buckets.length;i++) {
          var bucket = buckets[i]
          var tot_ls = bucket.complete.doc_count+bucket.incomplete.doc_count;
          var diff=0;
          if (maxls>tot_ls) diff = maxls-tot_ls;

          if (bucket.doc_count===0)
            retObj[bucket.key] = [bucket.complete.doc_count,bucket.incomplete.doc_count+diff,Math.floor(((tot_ls-diff)/tot_ls)*100)];
          else  
            retObj[bucket.key] = [bucket.complete.doc_count,bucket.incomplete.doc_count+diff,Math.floor((((tot_ls-diff)/tot_ls)*100)*bucket.complete.doc_count/bucket.doc_count)];
        }
        sendResult(false,retObj);

      }, function (error){
        excpEscES(res,error);
        console.trace(error.message);
      });

    }

    var retObj = {
    };

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);
      qmaxls();
    }else {
      sendResult(true,requestValue[0]);
    }
    
  }//end
}

