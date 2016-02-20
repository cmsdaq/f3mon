'use strict';

var f3MonCache;
var f3MonCacheSec;
var ttls;
var client;
var totalTimes;
var queryJSON;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

module.exports = {

  setup : function(cache,cacheSec,cl,ttl,totTimes,queryJSN) {
    f3MonCache = cache;
    f3MonCacheSec =  cacheSec;
    client=cl;
    ttls = ttl;
    totalTimes = totTimes;
    queryJSON = queryJSN;
  },

  query : function (req, res) {
  //initial configuration callback (edit values in config.json)
  //if the configuration is loaded from Elasticsearch, this callback can also be changed into a cacheable callback in the same fashion as the previous ones
  console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'received getConfig request');
  // var eTime = new Date().getTime();
  var cb = req.query.callback;
  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  res.send(cb +' ('+JSON.stringify(queryJSON)+')');

/*
//idx refresh for one index
app.get('/f3mon/api/idx-refr', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'idx-refr request');

//GET query string params
var qparam_indexAlias = req.query.indexAlias;
if (qparam_indexAlias == null){qparam_indexAlias = '';}

client.indices.refresh({
  index: qparam_indexAlias
  }).then (function(body){
	res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send('('+JSON.stringify(body)+')');
  }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
});//end idx-refr

//get server cache usage statistics
app.get('/f3mon/api/getcachestats', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'getcachestats request');
var cb = req.query.callback;

var qparam_token = req.query.token;
var acceptToken = 'randomPlainTextKey';

if (qparam_token == acceptToken){
  var retObj = {"server_cache_statistics":f3MonCache.getStats()};
  //retObj["keys"] = f3MonCache.keys(); //appends list of keys in the response
  //retObj["pairs"] = f3MonCache.mget(f3MonCache.keys()); //appends full cache pairs
  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  res.send(cb +' ('+JSON.stringify(retObj)+')');
}else{
  res.send('not allowed request');
}

});//end getcachestats

//flush server cache
app.get('/f3mon/api/freesomespace', function (req, res) {
console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'freesomespace request');
var cb = req.query.callback;
var qparam_token = req.query.token;
var acceptToken = 'anotherRandomPlainTextKey';

if (qparam_token == acceptToken){
  var retObj = {"current stats":f3MonCache.getStats()};
  f3MonCache.flushAll();
  retObj["new stats"] = f3MonCache.getStats();
  res.set('Content-Type', 'text/javascript');
  res.header("Cache-Control", "no-cache, no-store");
  res.send(cb +' ('+JSON.stringify(retObj)+')');
}else{
  res.send('not allowed request');
}

});//end freesomespace
*/



  }
}

