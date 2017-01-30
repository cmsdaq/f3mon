'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var qname = 'bigpic';
    var took = 0.;

    if (this.verbose) console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    var eTime = this.gethrms();
    var ttl = global.ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = req.query.callback;
    var qparam_sysName = this.checkDefault(req.query.setup,'cdaq');

    var requestKey = qname+'?sysName='+qparam_sysName;

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

    var _this = this;

    var q3 = function() {

      var queryJSON = {
        "query":{"prefix":{"host":fuprefix}},
        "size":1,
        "aggs" : {
          "bus":{
            "terms":{"size":200,"field":"appliance"},
            "aggs" : {
              "fu_hits":{"top_hits":{"size":30,"sort":[{"host":{"order":"asc"}}]}},
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

      global.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took += body.took;
        unix_time = Date.now();
        var buckets = body.aggregations.bus.buckets;
        for (var i=0;i<buckets.length;i++) {
          var key = buckets[i].key;
          if (!retObj["appliance_clusters"].hasOwnProperty(key)) continue;
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
                if (fu_hits[k]._source.host===target.fus_nbl[j]) {found=true;break;}
              if (!found)
                target.disc.push(target.fus_nbl[j]);
            }
          }

          delete target.fus_nbl;
          target.uldisk = alives.usedDataDir.value;
          target.tldisk = alives.totalDataDir.value;
        }
        //done
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
        _this.excpEscES(res,error,requestKey);
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
                              ,"fu_hits":{"top_hits":{"size":30,"sort":[{"host":{"order":"asc"}}]}},
                              //,"aggs":{"nodes":{"terms":{"size":50,"field":"_id"}}}
                              "cpu":{"terms":{"field":"cpu_name","size":1}}
                            }
                          }
                        }
                      };


      global.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'fu-box-status',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took += body.took;
        //unix_time = Date.now();
        //console.log(body.aggregations.bus.cloud_filter);
        var buagg =  body.aggregations.bus.buckets;
        var cnt_test=0;
        for (var i=0;i<buagg.length;i++) {
          var key = buagg[i].key;
          if (!retObj["appliance_clusters"].hasOwnProperty(key)) {
            //if (key!=='unknown') //hilton (can get written in dv index, but no BU)
              //console.log('appliance clusters dont have key '+key);
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
            var fu_id = fu_hits[j]._source.host; 
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
            target.fus[fu_id]={
              "effGHz":(fu_src.cpu_MHz_avg_real*0.001).toFixed(2),
              "nomGHz":(fu_src.cpu_MHz_nominal*0.001).toFixed(2),
              "memPerc":(fu_src.memUsedFrac*100).toFixed(0),
              "cpuPerc":(fu_src.cpu_usage_frac*100).toFixed(0)
            };
          }
          //target.fus.sort();
          target.cloud_nodes = cloud_fu_list;
          target.fu_count_nbl = fu_count_nbl;
          target.fu_count_all = fu_count_all;
          if (buagg[i].cpu.buckets.length)
          target.cpu_name=buagg[i].cpu.buckets[0].key;
        }
        q3();
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }//q2

    //first callback (get list of active BUs from boxinfo)
    var q1=function() {
      //get all BU boxinfo documents
      var queryJSON = {
                        "sort":{"host":"asc"},
                        "size":200,
                        "query":{
                              "prefix":{"host":buprefix}
                        }
                      };

      global.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took += body.took;
        unix_time = Date.now();
        var results = body.hits.hits;
        retObj["appliance_clusters"] = {};
        if (body.hits.length==0){
          //send empty response // TODO !
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }else{
          var total = body.hits.total;
          var bumap = retObj.appliance_clusters;
	  for (var index = 0 ; index < results.length; index++){
            var bu = results[index]._source.host
            var source = results[index]._source
            var age = ((unix_time - new Date(source.fm_date).getTime())/1000.).toFixed(1); //todo:maybe have to add +0000 for GMT)

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
        }
        } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }//q1

    //first check cluster health
    var healthQuery = function(callback) {
      //global.client.cluster.health().then (function(body) {
      global.client.cluster.stats().then (function(body) {
        try {
        took += body.took;
        retObj["central_server"] = {
          "status":body.status,
          "number_of_data_nodes":body.nodes.count.data_only + body.nodes.count.master_data,
          "active_primary_shards":body.indices.shards.primaries,
          "disk_free_bytes":body.nodes.fs.free_in_bytes,
          "disk_total_bytes":body.nodes.fs.total_in_bytes
          //"number_of_data_nodes":body.number_of_data_nodes,
          //"active_primary_shards":body.active_primary_shards
        };
        callback();
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }

    var healthQueryESlocal = function() {
      //global.clientESlocal.cluster.health().then (function(body) {
      global.clientESlocal.cluster.stats().then (function(body) {
        try {
        took += body.took;
        retObj["eslocal_server"] = {
          "status":body.status,
          "number_of_data_nodes":body.nodes.count.data_only + body.nodes.count.master_data,
          "active_primary_shards":body.indices.shards.primaries,
          "disk_free_bytes":body.nodes.fs.free_in_bytes,
          "disk_total_bytes":body.nodes.fs.total_in_bytes
          //"number_of_data_nodes":body.number_of_data_nodes,
          //"active_primary_shards":body.active_primary_shards
        };
        q1();
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        console.error("error running es-local health query");
        console.trace(error.message);
        q1();//tolerate this error
      });
    }

    var retObj = {
      "setup":qparam_sysName
    };

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false)
      healthQuery(healthQueryESlocal);
  },


module.exports.teols = function (req, res) {

    var qname = 'bigpic_teols'
    var took = 0.;

    if (this.verbose) console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    var eTime = this.gethrms();
    var ttl = global.ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = req.query.callback;
    var qparam_sysName = this.checkDefault(req.query.setup,'cdaq');
    var qparam_runNumber = req.query.runNumber;
    //var qparam_to = req.query.to;

    var requestKey = qname+'?sysName='+qparam_sysName+'&rn='+qparam_runNumber;//+'&to='+qparam_to;

    var _this = this;

    var maxls;//should bind it

    var qmaxls = function() {

      var queryJSON = {
        "size":0,
        "query":{"parent_id":{"type":"eols","id":qparam_runNumber}},
        "aggregations":{
          "maxls":{
            "max":{"field":"ls"}
          }
        }
      };

      global.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took += body.took;
        maxls = body.aggregations.maxls.value
        q(); 
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });

    }

    var q = function() {

      var queryJSON = {
        "size":0,
        "query":{"parent_id":{"type":"stream-hist","id":qparam_runNumber}},
        "aggregations":{
          "streams":{
            "terms":{"field":"stream","size":1000},
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

      global.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'stream-hist',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        took += body.took;
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
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });

    }

    var retObj = {
    };

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false)
      qmaxls();
    
  }//end


module.exports.maxls = function (req, res) {

    var qname = 'bigpic_maxls'
    var took = 0.;

    if (this.verbose) console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');

    var eTime = this.gethrms();
    var ttl = global.ttls.bigpic; //cached ES response ttl (in seconds)

    //GET query string params
    var cb = req.query.callback;
    var qparam_sysName = this.checkDefault(req.query.setup,'cdaq');
    var qparam_runNumber = req.query.runNumber;
    //var qparam_to = req.query.to;

    var requestKey = qname+'?rn='+qparam_runNumber;
    var _this = this;
    var retObj = { "maxls":0 };

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) == false) {

      var queryJSON = {
        "size":0,
        "query":{"parent_id":{"type":"eols","id":qparam_runNumber}},
        "aggregations":{
          "maxls":{
            "max":{"field":"ls"}
          }
        }
      };

      global.client.search({
        index: 'runindex_'+qparam_sysName+'_read',
        type: 'eols',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {

          took += body.took;
          retObj.maxls = body.aggregations.maxls.value
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);

        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
    }
}

