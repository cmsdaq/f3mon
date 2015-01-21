'use strict';

/**
 * @ngdoc service
 * @name f3monApp.sidebar
 * @description
 * # core
 * Factory in the f3monApp.
 */
(function() {
    angular.module('f3monApp')

    .factory('streamRatesService', function($resource, $rootScope, poller, config, runInfoService, indexListService) {
        var mypoller;
        var runInfo = runInfoService.data;
        var resource = $resource('api/streamhist.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        var srChart = {
            queryParams: {
                runNumber: false,
                from: false,
                to: false,
                intervalNum: 20,
                sysName: false,
                streamList: false,
                timePerLs: 23.4,
                useDivisor: false,
            },
            queryInfo: {
                took: 0,
                noData: true,
            }
        };
        srChart.stop = function(){

            if(!angular.isUndefined(mypoller)){
                mypoller.stop();    
            }
            
        };

        srChart.start = function() {
            if (!runInfo.lastLs || !runInfo.streams) {
                return;
            };
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [srChart.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    console.log('update sr data start');
                    console.log(data);
                    srChart.lsList = data.lsList;
                    srChart.streams = data.streams;
                    srChart.minimerge = data.minimerge;
                    srChart.macromerge = data.macromerge;
                    srChart.navSerie = data.navbar;
                    srChart.queryInfo.took = data.took;
                    srChart.queryInfo.noData = false;
                    srChart.interval = data.interval;

                    srChart.broadcast('updated');
                    if (!runInfoService.data.isRunning()) {
                        mypoller.stop()
                    }
                    console.log('update sr data stop');
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [srChart.queryParams]
                });
            }
        }

        srChart.paramsChanged = function(msg) {
            this.start();
        }

        srChart.broadcast = function(msg) {
            $rootScope.$broadcast('srChart.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            var runInfo = runInfoService.data;
            var q = srChart.queryParams;

            if (!angular.isUndefined(mypoller)) {
                mypoller.stop()
            }
            q.runNumber = runInfo.runNumber;
            q.from = runInfo.lastLs > 20 ? runInfo.lastLs - 20 : 1;
            q.to = runInfo.lastLs > 20 ? runInfo.lastLs : 20;
            q.sysName = indexListService.selected.subSystem;
            q.streamList = runInfo.streams.join();
            q.lastLs = runInfo.lastLs;
            srChart.start();
        });

        return srChart;
    })

    //First Drill Down plot service
    .factory('drillDownService', function($resource, $rootScope, poller, config, runInfoService, indexListService) {
        var mypoller, cache;
        var resource = $resource('api/minimacroperstream.php?', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });
        var service = {
            queryParams: {
                runNumber: false,
                from: false,
                to: false,
                sysName: false,
                streamList: false,
                type: false,
                stream: false,
            } //for second drill down query params
        };

        service.start = function() {
            //if (!runInfo.lastLs || !runInfo.streams) { return; };
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (JSON.stringify(data.percents) != cache) {
                        cache = JSON.stringify(data.percents);
                        service.data = data.percents;
                        service.broadcast('updated');
                    }
                    if (!runInfoService.data.isRunning()) {
                        mypoller.stop()
                    }
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        };

        service.stop = function() {
            if(!angular.isUndefined(mypoller)){mypoller.stop();}
        }

        service.broadcast = function(msg) {
            $rootScope.$broadcast('ddChart.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            var runInfo = runInfoService.data;
            var q = service.queryParams;

            if (!angular.isUndefined(mypoller)) {
                if (q.runNumber != runInfo.runNumber) {
                    mypoller.stop();
                };
            }
            q.runNumber = runInfo.runNumber;
            q.sysName = indexListService.selected.subSystem;
            q.streamList = runInfo.streams.join();
        });

        return service;
    })

    //Second Drill Down plot service
    .factory('secondDrillDownService', function($resource, $rootScope, poller, config, drillDownService, runInfoService, indexListService) {
        var mypoller,cache;
        var resource = $resource('api/minimacroperbu.php?', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });
        var service = {
            queryParams: drillDownService.queryParams
        };

        service.start = function() {
            cache = '';
            //if (!runInfo.lastLs || !runInfo.streams) { return; };
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (JSON.stringify(data.percents) != cache) {
                        cache = JSON.stringify(data.percents);
                        service.data = data.percents;
                        service.broadcast('updated');
                    }
                    if (!runInfoService.data.isRunning()) {
                        mypoller.stop()
                    }
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        };

        service.stop = function() {
            if(!angular.isUndefined(mypoller)){mypoller.stop();}
        }
        service.broadcast = function(msg) {
            $rootScope.$broadcast('dd2Chart.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            var runInfo = runInfoService.data;
            var q = service.queryParams;

            if (!angular.isUndefined(mypoller)) {
                if (q.runNumber != runInfo.runNumber) {
                    mypoller.stop();
                };
            }
            q.runNumber = runInfo.runNumber;
            q.sysName = indexListService.selected.subSystem;
            q.streamList = runInfo.streams.join();
        });

        return service;
    })


})();
