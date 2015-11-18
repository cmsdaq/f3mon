'use strict';
var fs = require('fs');
var util = require('util');

var f3MonCache;
var totalTimes;
var stats_file;
var times_file;

var cachestatslogger = function (){
  var outObj = {
    "time" : new Date().toUTCString(),
    "stats" : f3MonCache.getStats()
  };
  stats_file.write(util.format(JSON.stringify(outObj)+'\n'));
  times_file.write(util.format(JSON.stringify(totalTimes)+'\n'));
  console.log('-Wrote out cache statistics -------------------------------------------------------------------------------------------------');
}

module.exports = {
  start : function(cache,totTimes) {
    f3MonCache = cache;
    totalTimes = totTimes;
    //cumulative time of requests serving in milliseconds
    //dev helper for cache statistics
    stats_file = fs.createWriteStream('./cache_statistics.txt', {flags : 'a'});
    times_file = fs.createWriteStream('./service_times.txt', {flags : 'a'});
    cachestatslogger()
    setInterval(cachestatslogger, 30000);
  }
}
