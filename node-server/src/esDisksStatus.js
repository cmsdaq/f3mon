'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var qname = 'getDisksStatus';
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+qname+' request');
    var ttl = global.ttls.getDisksStatus; //cached ES response ttl (in seconds) 
    var eTime = this.gethrms();

    //GET query string params (needed to parameterize the query)
    var cb = req.query.callback;
    //the following check must not check types because non-set URL arguments are in fact undefined, rather than null valued

    var qparam_runNumber = this.checkDefault(req.query.runNumber,"false");
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');

    var buprefix='bu-';
    if (qparam_sysName=='dv') buprefix='dvbu-';

    var requestKey = qname+'?runNumber='+qparam_runNumber+'&sysName='+qparam_sysName;

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {

      //this.queryJSON1.query.wildcard.activeRuns.value =  '*'+qparam_runNumber+'*';

      delete this.queryJSON1.query;

      var _this = this

      var sendError = function(error) {
        if (error.message.indexOf("IndexMissingException")===0) {
          var retObj = {
                   "output":{"value":null},
                   "ramdisk":{"value":null},
                   "ramdiskused":{"value":null},
                   "data":{"value":null},
                   "dataused":{"value":null},
                   "outputused":{"value":null},
                   "resourceFrac":{"value":null},
                   "resourceCount":{"value":null},
                   "resourceCountActive":{"value":null}
          }
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
          return;
        }
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      }

      var bu_list = [] 

      var q2 = function(retObj) {

        var queryJSON2 = {
          "query":{
            "bool":{
              "must":[
                //{"term":{"activeFURun":qparam_runNumber}},
                {"range":{"fm_date":{"to":"now","from":"now-10s"}}}
              ]
            }
          },
          "size":0,
          "aggs":{
            "bus":{
              "terms":{
                "field":"appliance",
                "size":200,
                "order":{"_term":"asc"}
              },
              "aggs":{
                "last":{
                  "top_hits":{"size":1,"sort":{"fm_date":{"order":"desc"} } }
                }
              }
            }
          }
        }

        //submits query to the ES and returns formatted response to the app client
        global.client.search({
          index: 'boxinfo_'+qparam_sysName+'_read',
          type: 'resource_summary',
          body : JSON.stringify(queryJSON2)
        }).then(function (body){
          try {
	  //do something with these results (eg. format) and send a response
	  //took+=body.took;
          var buckets = body.aggregations.bus.buckets
          if (buckets.length==0) {
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
            return;
          }
          var summaryObj={active_run:0,active:0,stale:0,quarantined:0}

          var cnt_bl=0;
          var rn_int = parseInt(qparam_runNumber);
          var foundRun=false;
          buckets.forEach(function(bucket){
            if (bucket.last.hits.total>0) {
              var hitsrc = bucket.last.hits.hits[0]._source;
              var bname = hitsrc.appliance;
              //move through first sorted collection until name match or sort flips
              while (cnt_bl<bu_list.length &&  bu_list[cnt_bl]<bname) { cnt_bl++;}
              //if there is still no name match skip this BU
              if (cnt_bl>=bu_list.length || bu_list[cnt_bl]!=bname) return;

              //count this only if active run reported by FUs == this run
              if (rn_int == parseInt(hitsrc.activeFURun)) {
                if (hitsrc.active_resources_activeRun>hitsrc.active_resources) // workaround because currently active run res doesn't account switching to cloud so we must subtract idle
                  summaryObj.active_run+=hitsrc.active_resources;
                else
                  summaryObj.active_run+=hitsrc.active_resources_activeRun;
                foundRun=true
              }

              summaryObj.active+=hitsrc.active_resources;
              summaryObj.quarantined+=hitsrc.quarantined;
              summaryObj.stale+=hitsrc.stale_resources;
              //console.log( 'a:'+hitsrc.active_resources + ' q:' + hitsrc.quarantined + ' '+ hitsrc.stale_resources + ' runa:'+ hitsrc.active_resources_activeRun + ' idle:' + hitsrc.idle + ' other:'+summaryObj.active_run)
            }
            //else console.log('missing hit for ' + bname);
          });
 
          var den = summaryObj.active+summaryObj.stale+summaryObj.quarantined;
          if (den>0 && foundRun)
            retObj.resourceFrac.value = summaryObj.active_run / den;
          retObj.resourceCount.value = den;
          retObj.resourceCountActive.value = summaryObj.active_run;
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
          } catch (e) {_this.exCb(res,e,requestKey)}
          
        }, function (error){
          sendError(error);
        });
      }//q2

      var q1 = function(retObj) {
        //filter by run number. this is filled by internal BU state, so we can detect run in BU even in case of stale FUs
        var qJSON = {
          "query":{
            "bool":{
              "must":[
                {"prefix":{"host":buprefix}},
                {"term":{"activeRuns":qparam_runNumber}}
              ]
            }
          },
          "size":0,
          "aggs":{
            "bus":{
              "terms":{"size":200,"field":"host"}
            }
          }
        }

        //submits query to the ES and returns formatted response to the app client
        global.client.search({
          index: 'boxinfo_'+qparam_sysName+'_read',
          type: 'boxinfo',
          body : JSON.stringify(qJSON)
        }).then(function (body){
          try {
	  //do something with these results (eg. format) and send a response
	  //took+=body.took;
          if (body.aggregations.bus.buckets.length==0) {
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
            return;
          }
          var buckets = body.aggregations.bus.buckets
          body.aggregations.bus.buckets.forEach(function(bucket){
            bu_list.push(bucket.key);
            //console.log('checksort ' + bucket.key)
          });
          q2(retObj);

          } catch (e) {_this.exCb(res,e,requestKey)}

        }, function (error){
          //return default reponse in case of index missing
          if (error.message.indexOf("IndexMissingException")===0) {
            var retObj = {
                   "output":{"value":null},
                   "ramdisk":{"value":null},
                   "ramdiskused":{"value":null},
                   "data":{"value":null},
                   "dataused":{"value":null},
                   "outputused":{"value":null},
                   "resourceFrac":{"value":null},
                   "resourceCount":{"value":null},
                   "resourceCountActive":{"value":null}
            }
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
            return;
          }
          _this.excpEscES(res,error,requestKey);
          console.trace(error.message);
        });//end  client.search(...)
      }


      //submits query to the ES and returns formatted response to the app client
      global.client.search({
        index: 'boxinfo_'+qparam_sysName+'_read',
        type: 'boxinfo',
        body : JSON.stringify(this.queryJSON1)
      }).then(function (body){
        try {
	//do something with these results (eg. format) and send a response
	var retObj = body.aggregations;

        retObj.resourceFrac={"value":null}
        retObj.resourceCount={"value":null}
        retObj.resourceCountActive={"value":null}
        if (qparam_runNumber==="false" || qparam_runNumber===false)
          _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl);
        else
          q1(retObj);

        } catch (e) {_this.exCb(res,e,requestKey)}

      }, function (error){
          sendError(error);
      });

    }
  }

