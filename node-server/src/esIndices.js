'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;


//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
  },

  query : function (req, res) {

    console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"getIndices request");
    var eTime = new Date().getTime();
    var cb = req.query.callback;

    var requestKey = 'getIndices';
    var requestValue = f3MonCache.get(requestKey);
    var ttl = ttls.getIndices; //cached ES response ttl (in seconds) 

    if (requestValue=="requestPending"){
        requestValue = f3MonCacheSec.get(requestKey);
    }

    if (requestValue == undefined) {
      f3MonCache.set(requestKey, "requestPending", ttl);

      client.cat.aliases({
       name: 'runindex*read'}
      ).then(
      function (body) {
        //console.log('received response from ES :\n'+body+'\nend-response');
        var aliasList = [];

        var alias_infos = body.split('\n');
        //console.log(alias_infos);
        for(var alias_info in alias_infos) {
          if (!alias_infos[alias_info].length) continue;
          //console.log(alias_infos[alias_info]);
          var info = alias_infos[alias_info].replace(/\s+/g,' ').trim().split(' ');
          var mySubsys = info[0].split("_")[1];
          var myAlias = info[0];
          var myIndexType = info[1].split("_")[0];
          if (myAlias.indexOf(myIndexType)!==0) continue;//skip if not starting with runindex
          aliasList.push({"subSystem":mySubsys,"index":myAlias})
        }
        aliasList.sort(function(a,b){if (a.subSystem>b.subSystem) return true; else return false;});
        //console.log('sending '+aliasList);
        var retObj = {'list':aliasList};
        f3MonCache.set(requestKey, [retObj,ttl], ttl);
	var srvTime = (new Date().getTime())-eTime;
        totalTimes.queried += srvTime;
        console.log('getIndices (src:'+req.connection.remoteAddress+')>responding from query (time='+srvTime+'ms)');
        res.set('Content-Type', 'text/javascript');
        res.send(cb + ' (' + JSON.stringify(retObj)+')');
      },
      function(error) {
	excpEscES(res,error);
      console.log(error)
    });
    } else {
      var srvTime = (new Date().getTime())-eTime;
      totalTimes.cached += srvTime;
      console.log('getIndices (src:'+req.connection.remoteAddress+')>responding from cache (time='+srvTime+'ms)');
      res.set('Content-Type', 'text/javascript');
      res.send(cb + ' (' + JSON.stringify(requestValue[0])+')');
    }
   /*
   var cb = req.query.callback;
   client.search( {
     index : 'runindex*read',
     query
   }).then(
   */
  }
}

