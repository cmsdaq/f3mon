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

    .factory('globalService', function($rootScope) {
        var service = {
            status: {
                currentTab: 0,
                changeTab: function(num) {
                    this.currentTab = num;
                },
                isTabSelected: function(num) {
                    return this.currentTab == num;
                },
                reset: function(){
                    this.changeTab(0);
                    broadcast('reset');

                }
            },

        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('global.' + msg);
        };

        return service;

    })


    .factory('streamRatesService', function($resource, $rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/streamhist.php', {
	var resource = $resource('api/streamhist', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });
        
        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            init();
        });
           

        var init = function(){
            service.queryParams.timePerLs = config.secondsPerLsValue;
            service.queryParams.useDivisor = config.secondsPerLsOn;
            service.queryParams.from = false;
            service.queryParams.to = false;
            service.isFromSelected= false;
            service.isToSelected= false;
        }

        var service = {
            data: {
                micromerge: {},
                minimerge: {},
                macromerge: {},
                streams: {},
                navbar: {},
                lastTime: false,
                lsList: false,
                interval: false,
                noData: function() {
                    return _.isEmpty(this.streams) && _.isEmpty(this.micromerge) && _.isEmpty(this.minimerge) && _.isEmpty(this.macromerge)
                },
            },
            queryParams: {
                runNumber: false,
                from: false,
                to: false,
                intervalNum: configService.nbins,
                sysName: false,
                streamList: false,
                timePerLs: 23.31,
                useDivisor: true,
                accum : false
            },
            queryInfo: {
                took: 0,
                isFromSelected: false,
                isToSelected: false,
            }
        };


        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                //console.log('service stop')
                mypoller.stop();
            }
        };

        service.start = function() {

            if (!runInfo.lastLs || !runInfo.streams) {
                return;
            };
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    //console.log('update sr data start');
                    //if (service.data.lastTime != data.lastTime) {
                        service.data.lastTime = data.lastTime;
                        if (service.queryInfo.noData) {
                            service.queryInfo.noData = false
                        };

                        service.queryInfo.took = data.took;
                        service.data.lsList = data.lsList;
                        service.data.interval = data.interval;
                        service.data.streams = data.streams;
                        service.data.micromerge = data.micromerge;
                        service.data.minimerge = data.minimerge;
                        service.data.macromerge = data.macromerge;
                        service.data.navbar = data.navbar;
                        broadcast('updated');
                    //} else {
                    //    if (!runInfoService.data.isRunning()) {
                    //        service.stop()
                    //    }
                    //}


                    //console.log('update sr data stop');
                })
            } else {

                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        }

        service.paramsChanged = function(msg) {
            service.data.lastTime = false;
            service.start();
        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('srChart.' + msg);
        };

        $rootScope.$on('runInfo.selected', function(event) {
            service.stop();
        })

        $rootScope.$on('runInfo.updated', function(event) {
            var q = service.queryParams;
            var info = service.queryInfo;

            if (!angular.isUndefined(mypoller)) {
                mypoller.stop()
            }
            q.runNumber = runInfo.runNumber;

            var nbinsp = configService.nbins+1;
            if (!info.isFromSelected) {
                q.from = runInfo.lastLs > nbinsp ? runInfo.lastLs - nbinsp : 1;
            }
            if (!info.isToSelected) {
                q.to = runInfo.lastLs > nbinsp ? runInfo.lastLs : nbinsp;
            }
            if (q.from>q.to) {
              console.log('from > to ! ' + q.from + ' ' + q.to);
              q.from = q.to > nbinsp ? q.to-nbinsp : 1;
            }

            q.sysName = indexListService.selected.subSystem;
            //q.streamList = runInfo.streams.join();
            q.streamList = runInfo.queryStreams.join();
            q.lastLs = runInfo.lastLs;
            service.start();
        });

        return service;
    })

    //First Drill Down plot service
    .factory('drillDownService', function($resource, $rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller, cache,config;
        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/minimacroperstream.php', {
	var resource = $resource('api/minimacroperstream', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
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
                    //if (!runInfoService.data.isRunning()) {
                    //    mypoller.stop()
                    //}
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        };

        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop();
            }
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
    .factory('secondDrillDownService', function($resource, $rootScope, poller, configService, drillDownService, runInfoService, indexListService) {
        var mypoller, cache, config;
        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/minimacroperbu.php?', {
	var resource = $resource('api/minimacroperhost', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });


        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
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
                    //if (!runInfoService.data.isRunning()) {
                    //    mypoller.stop()
                    //}
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        };

        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop();
            }
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


    .factory('microStatesService', function($resource, $rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/nstates-summary.php', {
	var resource = $resource('api/nstates-summary', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            data: {},
            queryParams: {},
            queryInfo: {},
            closedRun:false,
            active:false // unused
        };

        service.resetParams = function() {
            service.data = {};
            service.queryParams = {
              runNumber: false,
              sysName: false,
              timeRange: 300,
              numIntervals: 30,
              format : "" //nvd3 or other(hc)
            }
            service.queryInfo = {
              timeList:false,
              lastTime: false
              //took: 0,
              //noData: true,
              //isFromSelected: false,
              //isToSelected: false,
            }
        };

        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop();
            }
            service.active=false;
        };

        service.updateRange = function(runNumber,min,max,selectedFrom,selectedTo) {
            service.queryParams.runNumber = runNumber;
            if (!selectedTo && !selectedFrom && service.closedRun===false) {
              service.queryParams.timeRange=300;
              service.queryParams.numIntervals=30;
              //service.queryParams.maxTime=null;
              //service.queryParams.minTime=null;
              delete service.queryParams.maxLs;
              delete service.queryParams.minLs;
            }
            else if (!selectedTo && service.closedRun===false) {
              //service.queryParams.maxTime=null;
              //service.queryParams.minTime=null;
              var range = (max-min)*23.31;//todo increase intervals if large range
              service.queryParams.timeRange=range>300?range:300;
              service.queryParams.numIntervals=300;
              console.log(JSON.stringify(service.queryParams));
              //if (range>300)
              //  service.queryParams.numIntervals=Math.Round(1.*range/6.);
              delete service.queryParams.maxLs;
              delete service.queryParams.minLs;
            }
            else { //range mode or closed run
              //use LS (start) timestamps
              //service.queryParams.maxTime=null;
              //service.queryParams.minTime=null;
              var range = (max-min)*23.31;//todo:increase intervals if large range
              service.queryParams.numIntervals=300;
              //if (range>300)
              //  service.queryParams.numIntervals=Math.Round(1.*range/6.);
              service.queryParams.maxLs=max
              service.queryParams.minLs=min
              delete service.queryParams.timeRange;
            }
            service.start();
        };



        service.start = function() {
            //console.log('Microstates STARTED');
            //if (!runInfo.isRunning) { return; };
            service.queryParams.sysName = indexInfo.subSystem;
             service.active=true;

            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    //console.log(data.timestamp,service.queryInfo.timestamp);
                    //console.log(data.lastTime)
                    if (data.lastTime && service.queryInfo.lastTime != data.lastTime) {
                        //console.log('ms update');
                        //service.queryInfo.legend = data.legend;
                        service.queryInfo.lastTime = data.lastTime;
                        service.queryInfo.timeList = data.timeList;
                        service.data = data.data;
                        broadcast('updated');
                    }
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('msChart.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            if (runInfo.endTime) {
                service.closedRun=true;
                return
            }
            else {
                service.closedRun=false;
            }
            //avoid restart in runInfo LS range update
            if (service.queryParams.runNumber===runInfoService.data.runNumber && service.active) {
                return;
            }
            service.stop();
            service.resetParams();
            service.start();
        });

        service.resetParams();
        return service;
    })

    .factory('logsService', function($resource, $rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller, cache, config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            data: {
                numLogs: 0,
                currentPage: 1,
                itemsPerPage: 20,
                displayTotal: 0,
                displayed: [],
                lastTime: 0,
                noData: function() {
                    return this.numLogs == 0
                }
            },
            queryParams: {
                startTime: false,
                endTime: false,
                sysName: false,
                sortBy: 'msgtime',
                sortOrder: 'desc',
                search: '',
                size: 20,
                from: 0,
            },
        };
        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/logtable.php', {
	var resource = $resource('api/logtable', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });


        service.pageChanged = function(newPageNumber) {
            service.stop();
            service.data.currentPage = newPageNumber;
            service.queryParams.from = (service.data.currentPage - 1) * service.data.itemsPerPage;
            service.data.lastTime = 0;
            service.start();
        }

        service.sortedClass = function(field) {
            if (field != this.queryParams.sortBy) {
                return 'fa-unsorted'
            } else {
                return this.queryParams.sortOrder == 'desc' ? 'fa-sort-desc' : 'fa-sort-asc'
            }
        };

        service.changeSorting = function(field) {
            service.stop();
            if (field != this.queryParams.sortBy) {
                this.queryParams.sortBy = field;
                this.queryParams.sortOrder = 'desc';
            } else {
                this.queryParams.sortOrder = (this.queryParams.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            service.data.lastTime = 0;
            service.start();
        };

        service.search = function() {
            service.stop();
            service.data.lastTime = 0;
            service.start();
        };


        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop();
            }
        };


        service.start = function() {
            //console.log('Microstates STARTED');
            //if (!runInfo.isRunning) { return; };

            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (data.lastTime != service.data.lastTime || data.iTotalRecords != service.data.displayTotal) {
                        service.data.lastTime = data.lastTime;
                        service.data.displayed = data.aaData;
                        service.data.displayTotal = data.iTotalDisplayRecords; //at the moment there no differences between totals. need to be improved in the query
                        service.data.numLogs = data.iTotalRecords || 0;
                        //console.log(service.data);
                    }
                    //if (data.legend && data.timestamp != service.queryInfo.timestamp) {
                    //    //console.log('ms update');
                    //    //service.queryInfo.legend = data.legend;
                    //    //service.queryInfo.timestamp = data.timestamp;
                    //    //service.data = data.data;
                    //    //broadcast('updated');
                    //}
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        }

        $rootScope.$on('runInfo.selected', function(event) {            
            if (!runInfo.startTime){
                        service.data.lastTime = 0;
                        service.data.displayed = [];
                        service.data.displayTotal = 0; //at the moment there no differences between totals. need to be improved in the query
                        service.data.numLogs = 0;
            }


        })

        $rootScope.$on('runInfo.updated', function(event) {            
            var q = service.queryParams;
            service.stop();
            if (runInfo.startTime===false) return;
            //convert to unix millis time
            var dts = new Date(runInfo.startTime+'+0000');
            q.startTime = dts.getTime();
            if (runInfo.endTime!==false) {
              var dte = new Date(runInfo.endTime+'+0000');
              q.endTime = dte.getTime();
            }
            else
              delete q.endTime;
            q.sysName = indexInfo.subSystem;

            service.start();
        });


        return service;

    })



})();
