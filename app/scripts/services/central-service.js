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
                changeTab: function(num,reload) {
                    if (!reload || num!=0 || this.currentTab==0) {//reset if switching from main view or clicking on F3mon icon
                      $rootScope.chartInitDone = true;
                    }
                    else $rootScope.chartInitDone = false;
                    this.currentTab = num;
                    if (reload)
                      broadcast('reload')
                    else
                      broadcast('refresh')
                    if (reload && !$rootScope.chartInitDone) setTimeout(function(){$rootScope.chartInitDone=true;},2);//ensure it's set after init
                },
                isTabSelected: function(num) {
                    return this.currentTab == num;
                },
                reset: function(reload){
                   console.log('globalService.reset')
                    this.changeTab(0,reload);
                    broadcast('reset');
                }
            },

        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('global.' + msg);
        };

        $rootScope.chartInitDone = false;

        return service;

    })


    .factory('streamRatesService', function($rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        
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
                transfer: {},
                streams: {},
                navbar: {},
                lastTime: false,
                lsList: false,
                interval: false,
                noData: function() {
                    return _.isEmpty(this.streams) && _.isEmpty(this.micromerge) && _.isEmpty(this.minimerge) && _.isEmpty(this.macromerge) && _.isEmpty(this.transfer)
                },
            },
            queryParams: {
                runNumber: false,
                from: false,
                to: false,
                intervalNum: configService.nbins,
                sysName: false,
                streamList: false,
                allStreams: false,
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
            //if (!runInfo.lastLs || !runInfo.streams) {
            if (!runInfo.lastLs) {
                return;
            };
            service.ready=true;
            if (service.paused) return;
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get('api/streamhist', {
                    action: 'jsonp',
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

                mypoller = poller.get('api/streamhist', {
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
            if (!runInfo.maskedStreams.length && runInfo.queryStreams.length) q.allStreams=true;
            else q.allStreams=false;
            q.streamList = runInfo.queryStreams.join();
            q.lastLs = runInfo.lastLs;
            service.start();
        });

        return service;
    })

    //First Drill Down plot service
    .factory('drillDownService', function($rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller, cache,config;
        
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
                mypoller = poller.get('api/minimacroperstream', {
                    action: 'jsonp',
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
                mypoller = poller.get('api/minimacroperstream', {
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
    .factory('secondDrillDownService', function($rootScope, poller, configService, drillDownService, runInfoService, indexListService) {
        var mypoller, cache, config;
        
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
                mypoller = poller.get('api/minimacroperhost', {
                    action: 'jsonp',
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
                mypoller = poller.get('api/minimacroperhost', {
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


    .factory('microStatesService', function($rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        var resourceType = 'nstates-summary';

        var micro_api;

        var setResource = function(newapi) {
          micro_api = 'api/'+newapi;
          mypoller = undefined;
        }
        setResource(resourceType);

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            service.pollingDelay = config.slowPollingDelay;
        });

        var service = {
            data: {},
            cputypes: ["any"],
            queryParams: {},
            queryInfo: {},
            rangeParams: {},
            pollingDelay:false,
            closedRun:false,
            active:false,
            paused:false
        };

        service.setServiceResource = function(api) {
          service.queryInfo.lastTime=false;
          setResource(api);
        }

        service.resetParams = function(all) {
            service.data = {};
            if (all) {
              service.queryParams = {
                runNumber: false,
                sysName: false,
                timeRange: 300,
                numIntervals: 30,
                format : "", //nvd3 or other(hc)
                cputype:"any",
                hteff: 1
              };
            } else {
              //do not reset clickable params
              service.queryParams.runNumber=false;
              service.queryParams.sysName=false;
              service.queryParams.timeRange=300;
              service.queryParams.numIntervals=30;
            }
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
              service.queryParams.numIntervals=90;
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
              service.queryParams.numIntervals=90;
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
                mypoller = poller.get(micro_api, {
                    action: 'jsonp',
                    delay: service.pollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (service.queryParams.format == data.format && service.queryParams.cputype == data.cputype && service.queryParams.hteff == data.hteff) {
                      if (data.lastTime && service.queryInfo.lastTime != data.lastTime) {
                        //service.queryInfo.legend = data.legend;
                        service.queryInfo.lastTime = data.lastTime;
                        service.queryInfo.timeList = data.timeList;
                        service.data = data.data;
                        var cputypesSorted = data.cputypes.sort();
                        if (cputypesSorted !== service.cputypes)
                          service.cputypes = cputypesSorted;
                        broadcast('updated');
                    }
                  } else
                    console.log("wrong us format exp:"+service.queryParams.format+" received:" + data.format)
                })
            } else {
                mypoller = poller.get(micro_api, {
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
            service.resetParams(false);
            //todo: check if this is ok when three settings are remembered from previous runs
            service.slotsResetCB();
            service.resetHTeffCB();
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
            service.resetParams(false);
        });

        //already done by controller
        //$rootScope.$on('global.reload', function(event) {
        //    service.resetParams(true);
        //});

        service.resetParams(true);
        return service;
    })

    .factory('logsService', function($rootScope, $sce, poller, configService, runInfoService, indexListService) {
        var mypoller, cache, config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        
        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            data: {
                numLogs: 0,
                numHLT: 0,
                numHLTd: 0,
                currentPage: 1,
                itemsPerPage: 0,//20
                displayTotal: 0,
                displayed: [],
                lastTime: 0,
                noData: function() {
                    return this.numLogs == 0
                }
            },
            queryParams: {
                docType: 'hltdlog,cmsswlog',
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
                mypoller = poller.get('api/logtable', {
                    action: 'jsonp',
                    delay: config.slowPollingDelay,
                    smart: true,
                    argumentsArray: [service.queryParams]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (data.docType!==service.queryParams.docType) {service.stop();service.start();return;}
                    if (data.lastTime != service.data.lastTime || data.iTotalRecords != service.data.displayTotal) {
                        service.data.lastTime = data.lastTime;
                        service.data.displayed = data.aaData;
                        service.data.displayTotal = data.iTotalDisplayRecords; //at the moment there no differences between totals. need to be improved in the query
                        service.data.numLogs = data.iTotalRecords || 0;
                        service.data.numHLTd = data.hltdTotal || 0;
                        service.data.numHLT = data.hltTotal || 0;
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
            } else { //?
                mypoller = poller.get('api/logtable', {
                    //action: 'jsonp',
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
                        service.data.numHLTd = 0;
                        service.data.numHLT = 0;
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


    .factory('streamSummaryService', function($rootScope, poller, configService, runInfoService, indexListService) {
        var mypoller,config;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

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
                mypoller = poller.get('api/teols', {
                    action: 'jsonp',
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
                mypoller = poller.get('api/teols', {
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
