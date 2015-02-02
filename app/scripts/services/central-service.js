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
                }
            },

        }

        return service;

    })


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

        var service = {
            data: {
                minimerge: {},
                macromerge: {},
                streams: {},
                navbar: {},
                lastTime: false,
                lsList: false,
                interval: false,
                noData: function() {
                    return _.isEmpty(this.streams) && _.isEmpty(this.minimerge) && _.isEmpty(this.macromerge)
                },
            },
            queryParams: {
                runNumber: false,
                from: false,
                to: false,
                intervalNum: 21,
                sysName: false,
                streamList: false,
                timePerLs: 23.4,
                useDivisor: false,
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
                    if (service.data.lastTime != data.lastTime) {

                        if (service.queryInfo.noData) {
                            service.queryInfo.noData = false
                        };

                        service.queryInfo.took = data.took;
                        service.data.lsList = data.lsList;
                        service.data.interval = data.interval;
                        service.data.streams = data.streams;
                        service.data.minimerge = data.minimerge;
                        service.data.macromerge = data.macromerge;
                        service.data.navbar = data.navbar;
                        broadcast('updated');
                    } else {
                        if (!runInfoService.data.isRunning()) {
                            service.stop()
                        }
                    }


                    //console.log('update sr data stop');
                })
            } else {

                mypoller = poller.get(resource, {
                    argumentsArray: [service.queryParams]
                });
            }
        }

        service.paramsChanged = function(msg) {
            this.start();
        }

        var broadcast = function(msg) {
            $rootScope.$broadcast('srChart.' + msg);
        };

        $rootScope.$on('runInfo.updated', function(event) {
            var q = service.queryParams;
            var info = service.queryInfo;

            if (!angular.isUndefined(mypoller)) {
                mypoller.stop()
            }
            q.runNumber = runInfo.runNumber;

            if (!info.isFromSelected) {
                q.from = runInfo.lastLs > 21 ? runInfo.lastLs - 21 : 1;
            }
            if (!info.isToSelected) {
                q.to = runInfo.lastLs > 21 ? runInfo.lastLs : 21;
            }

            q.sysName = indexListService.selected.subSystem;
            q.streamList = runInfo.streams.join();
            q.lastLs = runInfo.lastLs;
            service.start();
        });

        return service;
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
    .factory('secondDrillDownService', function($resource, $rootScope, poller, config, drillDownService, runInfoService, indexListService) {
        var mypoller, cache;
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


    .factory('microStatesService', function($resource, $rootScope, poller, config, runInfoService, indexListService) {
        var mypoller;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;

        var resource = $resource('api/nstates.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        var service = {
            data: {},
            queryParams: {
                runNumber: false,
                sysName: false,
                timeRange: 60,
            },
            queryInfo: {
                //legend: false,
                timeList:false,
                lastTime: false,
                //                took: 0,
                //                noData: true,
                //                isFromSelected: false,
                //                isToSelected: false,
            }
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
                return
            };
            var q = service.queryParams;
            service.stop();

            q.runNumber = runInfo.runNumber;
            q.sysName = indexInfo.subSystem;

            service.start();
        });

        return service;
    })

    .factory('logsService', function($resource, $rootScope, poller, config, runInfoService, indexListService) {
        var mypoller, cache;
        var runInfo = runInfoService.data;
        var indexInfo = indexListService.selected;
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
        var resource = $resource('api/logtable.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });


        service.pageChanged = function(newPageNumber) {
            console.log(newPageNumber)
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
                    //console.log(data);
                    //console.log('logupdate',data.lasttime,service.data.lastTime)
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

        $rootScope.$on('runInfo.updated', function(event) {
            var q = service.queryParams;
            service.stop();

            q.startTime = runInfo.startTime;
            q.endTime = runInfo.endTime;
            q.sysName = indexInfo.subSystem;

            service.start();
        });


        return service;

    })



})();
