'use strict';
var fs = require('fs');
var util = require('util');

var stats_file;
var times_file;
var init_logindex=false;

var instance = global.serverPort==80 ? 'prod': serverPort=='8080' ? 'priv': serverPort=='4000' ? 'test' : 'dev';

var tests=false ; // false

var cachestatslogger = function (){
  if (!global.cacheExists) return;
  var outObj = {
    "time" : new Date().toUTCString(),
    "stats" : global.f3MonCache.getStats(),
    "stats2" : global.f3MonCacheSec.getStats(),
    "stats3" : global.f3MonCacheTer.getStats()
  };
  stats_file.write(util.format(JSON.stringify(outObj)+'\n'));
  times_file.write(util.format(JSON.stringify(global.totalTimes)+'\n'));
  //console.log('-Wrote out cache statistics -------------------------------------------------------------------------------------------------');

  bulk_inject()
}

var bulk_inject = function() {
  if (init_logindex && global.bulk_buffer.length) {

    var bulk_tmp = []
    global.bulk_buffer.forEach(function(item) {
      bulk_tmp.push({index:{_index:'f3mon_stats_'+instance,_type:'query_record'}})
      //item.instance = instance
      bulk_tmp.push(item)
    })
    global.client.bulk({body:bulk_tmp},function(body) {},function(error){console.log(error.message)})
  }
  global.bulk_buffer.length=0
}


module.exports = {
  start : function() {
    bulk_buffer = global.bulk_buffer
    //cumulative time of requests serving in milliseconds
    //dev helper for cache statistics
    stats_file = fs.createWriteStream(global.log_dir+'/cache_statistics.log', {flags : 'a'});
    times_file = fs.createWriteStream(global.log_dir+'/service_times.log', {flags : 'a'});
    cachestatslogger()
    setInterval(cachestatslogger, 30000);

    var index_body = {
        settings:{
            number_of_shards:"2",
            number_of_replicas:"1",
            translog : {durability : "async"}
        },
        mappings:{
            query_record:{
                properties:{
                    //instance:{type:"keyword"},
                    query:{type:"keyword"},
                    ip:{type:"keyword"},
                    cached_response:{type:"boolean"},
                    date:{type:"date"},
                    took:{type:"float"},
                    useragent:{type:"keyword"}
                },
            }
        }
    }

    //initialize elasticsearch loggin index
    if  ((instance!=='dev' && instance!=='test') || tests)
      global.client.indices.create({
        index: 'f3mon_stats_'+instance,
        body : JSON.stringify(index_body),
      }).then(function (body){

        console.log('created index f3mon_stats_'+instance)
        init_logindex=true;

      },function(error) {
        //console.log(error.response)
        try {
          if (JSON.parse(error.response).error.root_cause[0].type==="index_already_exists_exception")
            init_logindex=true;
          else
            console.log(error.response)
        } catch (e) {console.log(e)}
      })
  }
}
