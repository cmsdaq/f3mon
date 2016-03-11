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
            active:false,
            ready:false,
            paused:false,
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
            service.active=false;
            service.ready=false;
        };

        service.start = function() {
            service.active=true;
            if (!runInfo.lastLs || !runInfo.streams) {
                return;
            };
            service.ready=true;
            if (service.paused) return;
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
                        service.data.input = data.input;
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

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.paused = true;
        }

        service.resume = function() {
          if (service.paused) {
             service.paused = false;
             if (service.ready && !angular.isUndefined(mypoller)) {//make sure existing poller is restarted
               mypoller.start();
             }
          }
        }

        service.paramsChanged = function(msg) {
            service.data.lastTime = false;
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

            service.stop();

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
            //mypoller=undefined;
            cache=undefined;

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
            service.pollingDelay = config.slowPollingDelay;
        });


        var service = {
            data: {},
            queryParams: {},
            queryInfo: {},
            rangeParams: {},
            pollingDelay:false,
            closedRun:false,
            active:false,
            paused:false
        };

        service.resetParams = function() {
            service.data = {};
            service.queryParams = {
              runNumber: false,
              sysName: false,
              timeRange: 300,
              numIntervals: 30,
              format : "" //nvd3 or other(hc)
            };
            service.queryInfo = {
              timeList:false,
              lastTime: false
              //took: 0,
              //noData: true,
              //isFromSelected: false,
              //isToSelected: false,
            };
            service.rangeParams = {
              runNumber:false,
              min:-1,
              max:-1,
              numIntervals:-1,
              timeRange:-1
            };
            if (config) //or call resetParams in on.config
              service.pollingDelay = config.slowPollingDelay;
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
              delete service.queryParams.maxLs;
              delete service.queryParams.minLs;

              //skip service refresh if parameters are same as before
              /*if (runNumber===service.rangeParams.runNumber
                  && service.queryParams.timeRange===service.rangeParams.timeRange
                  && service.queryParams.numIntervals===service.rangeParams.numIntervals)
                return;
              service.rangeParams.runNumber=runNumber;
              service.rangeParams.timeRange=service.queryParams.timeRange;
              service.rangeParams.numIntervals=service.queryParams.numIntervals;
              service.pollingDelay = config.slowPollingDelay;*/
            }
            else if (!selectedTo && service.closedRun===false) {
              var range = (max-min)*23.31;//todo increase intervals if large range
              service.queryParams.timeRange=range>300?range:300;
              service.queryParams.numIntervals=300;
              //console.log(JSON.stringify(service.queryParams));
              //if (range>300)
              //  service.queryParams.numIntervals=Math.Round(1.*range/6.);
              delete service.queryParams.maxLs;
              delete service.queryParams.minLs;

              //skip service refresh if parameters are same as before
              /*if (runNumber===service.rangeParams.runNumber
                  && service.queryParams.timeRange===service.rangeParams.timeRange
                  && service.queryParams.numIntervals===service.rangeParams.numIntervals)
                return;
              service.rangeParams.runNumber=runNumber;
              service.rangeParams.timeRange=service.queryParams.timeRange;
              service.rangeParams.numIntervals=service.queryParams.numIntervals;
              service.pollingDelay = config.slowPollingDelay;*/
            }
            else { //range mode or closed run
              //use LS (start) timestamps
              var range = (max-min)*23.31;//todo:increase intervals if large range
              service.queryParams.numIntervals=300;
              //if (range>300)
              //  service.queryParams.numIntervals=Math.Round(1.*range/6.);
              service.queryParams.maxLs=max
              service.queryParams.minLs=min
              delete service.queryParams.timeRange;

              //skip service refresh if parameters are same as before
              if (runNumber===service.rangeParams.runNumber
                  && min===service.rangeParams.min
                  && max===service.rangeParams.max)
                return;
              service.rangeParams.runNumber=runNumber;
              service.rangeParams.min=min;
              service.rangeParams.max=max;
              //service.pollingDelay = config.slowPollingDelay*2; //!

            }
            service.start();
        };

        service.start = function() {
            service.active=true;
            if (service.paused) return;
            service.queryParams.sysName = indexInfo.subSystem;
            //console.log('Microstates STARTED');
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: service.pollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (service.queryParams.format == data.format) {
                      if (data.lastTime && service.queryInfo.lastTime != data.lastTime) {
                        //service.queryInfo.legend = data.legend;
                        service.queryInfo.lastTime = data.lastTime;
                        service.queryInfo.timeList = data.timeList;
                        service.data = data.data;
                        broadcast('updated');
                    }
                  } else
                    console.log("wrong us format exp:"+service.queryParams.format+"recv:" + data.format)
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams],
                    delay: service.pollingDelay
                });
            }
        }

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.paused = true;
        }

        service.resume = function() {
          if (service.paused && service.active) {
             service.paused = false;
             if (!angular.isUndefined(mypoller)) //make sure existing poller is restarted
               mypoller.start();
               //mypoller.restart();
             service.start();
          }
          service.paused = false;
        }

        service.reconfigureFormat = function(format,alwaysResume) {
             var isPaused=service.paused;
             if (!isPaused) service.pause();
             service.queryParams.format = format;
             service.queryInfo.lastTime = false;
             console.log('reconfigured with..'+format)
             if (!isPaused || alwaysResume) service.resume();
        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('msChart.' + msg);
        };

        $rootScope.$on('runInfo.selected', function(event) {
            service.stop();
            service.resetParams();
        });

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
            //remember ustate chart lib choice
            var fmt  = service.queryParams.format;
            service.resetParams();
            service.queryParams.format = fmt;
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

        var isSafari=false;
        if (navigator.appVersion.indexOf('Safari/')!==-1) var isSafari=true;

        $rootScope.$on('runInfo.updated', function(event) {            
            var q = service.queryParams;
            service.stop();
            if (runInfo.startTime===false) return;

            //convert to unix millis time
            if (isSafari) {
              var dts = new Date(runInfo.startTime);
              q.startTime = dts.getTime();
              if (runInfo.endTime!==false) {
                var dte = new Date(runInfo.endTime);
                q.endTime = dte.getTime();
              }
              else delete q.endTime;
            }
            else {
              var dts = new Date(runInfo.startTime+'+0000');
              q.startTime = dts.getTime();
              if (runInfo.endTime!==false) {
                var dte = new Date(runInfo.endTime+'+0000');
                q.endTime = dte.getTime();
              }
              else delete q.endTime;
            }
            q.sysName = indexInfo.subSystem;

            service.start();
        });


        return service;

    })


    .factory('streamSummaryService', function($resource, $rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/nstates-summary.php', {
	var resource = $resource('api/teols', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            service.pollingDelay = config.fastPollingDelay;
            //service.pollingDelay = config.slowPollingDelay;
        });

        var service = {
            data: {},
            queryParams: {},
            pollingDelay:false,
            active:false,
            paused:false
        };

        service.resetParams = function() {
            service.data = {};
            service.queryParams = {
              runNumber: false,
              ls: 0,
              setup: false
            };
            if (config) //or call resetParams in on.config
              service.pollingDelay = config.slowPollingDelay;
        }

        service.stop = function() {
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop();
            }
            service.active=false;
        };

        service.start = function() {
            service.active=true;
            if (service.paused) return;
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: service.pollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                        service.data = data;
                        delete service.data['$promise']
                        delete service.data['$resolved']
                        broadcast('updated');
                })
            } else {
                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams],
                    delay: service.pollingDelay
                });
            }
        }

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.paused = true;
        }

        service.resume = function() {
          if (service.paused && service.active) {
             service.paused = false;
             if (!angular.isUndefined(mypoller))
               mypoller.start();
             service.start();
          }
          service.paused = false;
        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('ssTable.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            if (runInfoService.data.runNumber==false) {
              service.stop();
              service.data = {}
              return;
            }
            service.queryParams.runNumber = runInfoService.data.runNumber;
            service.queryParams.ls = runInfoService.data.lastLs | 0;
            service.queryParams.setup = indexListService.selected.subSystem;
            service.start();
        });

        service.resetParams();
        return service;

    })


})();
