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

    //Service for the status of run selected; Check StartTime, EndTime, streams and lastLs
    .factory('runInfoService', function($resource, $rootScope, poller, configService, indexListService) {
        var mypoller, restartPoller, cache, config;

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/runInfo.php', {
	var resource = $resource('api/runInfo', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var restartCollectorRes = $resource(prePath+'/api/startCollector.php', {
	var restartCollectorRes = $resource('api/startCollector', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });



        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {

            data: {
                runNumber: false,
                startTime: false,
                endTime: false,
                streams: [],
                lastLs: false,
                streamsAsString: function() {
                    return this.streams.length != 0 ? this.streams.join(', ') : 'N/A';
                },
                isRunning: function() {
                    return this.endTime == false
                },
            }
        };

        service.reset = function() {            
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop()
            };

            service.data.runNumber = false;
            service.data.startTime = false;
            service.data.endTime = false;
            service.data.streams = [];
            service.data.lastLs = false;
            cache = false;

            service.broadcast('selected');
        };



        service.restartCollector = function(runNumber) {
            restartPoller = poller.get(restartCollectorRes, {
                action: 'jsonp_get',
                delay: 5000,
                smart: true,
                argumentsArray: [{
                    runNumber: runNumber,
                    sysName: indexListService.selected.subSystem
                }]

            })
            restartPoller.promise.then(null, null, function(data) {
                //console.log(data);
                restartPoller.stop();
            })

        }

        service.select = function(runNumber) {
            if (runNumber == this.data.runNumber) {
                return;
            }
            service.reset();
            service.data.runNumber = runNumber;

            service.start();
            service.broadcast('selected');
        };

        service.start = function() {
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: this.data.runNumber
                    }]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (JSON.stringify(data) != cache) {
                        cache = JSON.stringify(data);
                        service.data.runNumber = data.runNumber;
                        service.data.startTime = data.startTime;
                        service.data.endTime = data.endTime ? data.endTime : false;
                        service.data.streams = data.streams;
                        service.data.lastLs = data.lastLs ? data.lastLs[0] : false;
                        service.broadcast('updated');
                    }

                });
            } else {
                //Restart poller
                mypoller = poller.get(resource, {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: service.data.runNumber
                    }]
                });
            }
        };


        service.broadcast = function(msg) {

            $rootScope.$broadcast('runInfo.' + msg);
        };

        return service;
    })


    //Service for the disks information panel
    .factory('disksInfoService', function($resource, $rootScope, poller, configService, indexListService, runInfoService) {
        var mypoller, config;

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/getDisksStatus.php', {
        var resource = $resource('api/getDisksStatus', {
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
            data: {
                buRamDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used!==false && this.total!==false ? (this.used / this.total) : false
                    }
                },
                buOutDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used!==false && this.total!==false ? (this.used / this.total) : false
                    }
                },
                fuOutDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used!==false && this.total!==false ? (this.used / this.total) : false
                    }
                },
            }
        };

        service.start = function() {
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: runInfoService.data.runNumber
                    }]
                });

                mypoller.promise.then(null, null, function(data) {
                    //                    console.log(data);
                    //                    console.log(data.outputused);
                    var d = service.data;
                    d.fuOutDisk.total = data.data.value ? data.data.value : d.fuOutDisk.total;
                    d.fuOutDisk.used = data.dataused.value !== false ? data.dataused.value : d.fuOutDisk.used;
                    d.buOutDisk.total = data.output.value ? data.output.value : d.buOutDisk.total;
                    d.buOutDisk.used = data.outputused.value !== false ? data.outputused.value : d.buOutDisk.used;
                    d.buRamDisk.total = data.ramdisk.value ? data.ramdisk.value : d.buRamDisk.total;
                    d.buRamDisk.used = data.ramdiskused.value !== false ? data.ramdiskused.value : d.buRamDisk.used;
                    //                    console.log(service.data);
                });
            } else {
                //Restart poller
                mypoller = poller.get(resource, {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: runInfoService.data.runNumber
                    }]
                });
            }
        };
        $rootScope.$on('runInfo.selected', function(event) {
            service.start();
        });

        return service;
    })

    //Service for the disks information panel
    .factory('runListService', function($resource, $rootScope, poller, configService, indexListService) {
        var mypoller, cache, config;
        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/runListTable.php', {
        var resource = $resource('api/runListTable', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });



        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            data: {
                numRuns: 0,
                displayTotal: 0,
                currentPage: 1,
                itemsPerPage: 5,
                sortBy: 'startTime',
                sortOrder: 'desc',
                searchText: '',
                displayed: [],
                noData: function() {
                    return this.numRuns == 0;
                }
            }
        };

        service.start = function() {
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        size: service.data.itemsPerPage,
                        from: (service.data.currentPage - 1) * service.data.itemsPerPage,
                        sortBy: service.data.sortBy,
                        sortOrder: service.data.sortOrder,
                        search: service.data.searchText
                    }]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (JSON.stringify(data.aaData) != cache) {
                        cache = JSON.stringify(data.aaData);
                        service.data.displayed = data.aaData;
                        service.data.numRuns = data.iTotalRecords;
                        service.data.displayTotal = data.iTotalDisplayRecords;
                    }
                })
            } else {
                //Restart poller
                mypoller = poller.get(resource, {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        size: service.data.itemsPerPage,
                        from: (service.data.currentPage - 1) * service.data.itemsPerPage,
                        sortBy: service.data.sortBy,
                        sortOrder: service.data.sortOrder,
                        search: service.data.searchText
                    }]
                });
            }
        };

        service.pageChanged = function(newPageNumber) {
            mypoller.stop();
            service.data.currentPage = newPageNumber;
            service.start();
        }

        service.sortedClass = function(field) {
            if (field != this.data.sortBy) {
                return 'fa-unsorted'
            } else {
                return this.data.sortOrder == 'desc' ? 'fa-sort-desc' : 'fa-sort-asc'
            }
        };

        service.changeSorting = function(field) {
            mypoller.stop();
            if (field != service.data.sortBy) {
                service.data.sortBy = field;
                service.data.sortOrder = 'desc';
            } else {
                service.data.sortOrder = (service.data.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            service.start();
        };

        service.search = function() {
            mypoller.stop();
            service.start();
        };

        service.broadcast = function(msg) {
            $rootScope.$broadcast('service.' + msg);
        };

        $rootScope.$on('indices.selected', function(event) {
            service.start();
        });

        return service;
    })

    //Service for the disks information panel
    .factory('riverListService', function($resource, $rootScope, poller, configService, indexListService) {
        var mypoller, closePoller, cache, config;


        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var resource = $resource(prePath+'/api/runRiverListTable.php', {
        var resource = $resource('api/runRiverListTable', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });

        var prePath = window.location.protocol + '//'+window.location.host.split(':')[0]+':80'+window.location.pathname;
        //var closeCollectorRes = $resource(prePath+'/api/closeRun.php', {
        var closeCollectorRes = $resource('api/closeRun', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });


        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            start();
        });



        var start = function() {
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true,
                argumentsArray: [{
                    size: service.data.itemsPerPage,
                    from: (service.data.currentPage - 1) * service.data.itemsPerPage,
                    sortBy: service.data.sortBy,
                    sortOrder: service.data.sortOrder,
                }]
            });
            mypoller.promise.then(null, null, function(data) {
                if (JSON.stringify(data.list) != cache) {
                    cache = JSON.stringify(data.list);
                    service.data.displayed = data.list;
                    service.data.total = data.total;
                }
            })
        }


        var service = {
            data: {
                total: 0,
                currentPage: 1,
                itemsPerPage: 5,
                sortBy: 'role',
                sortOrder: 'desc',
                searchText: '',
                displayed: [],
            }
        };



        service.closeCollector = function(selected) {
            var runNumber = selected.runNumber;
            var subSystem = selected.subSystem;
            closePoller = poller.get(closeCollectorRes, {
                action: 'jsonp_get',
                delay: 5000,
                smart: true,
                argumentsArray: [{
                    runNumber: runNumber,
                    sysName: subSystem
                }]

            })
            closePoller.promise.then(null, null, function(data) {
                //console.log(data);
                closePoller.stop();
            })

        }

        service.restart = function() {
            //Restart poller
            //console.log((service.data.currentPage - 1) * service.data.itemsPerPage);
            mypoller = poller.get(resource, {
                argumentsArray: [{
                    size: service.data.itemsPerPage,
                    from: (service.data.currentPage - 1) * service.data.itemsPerPage,
                    sortBy: service.data.sortBy,
                    sortOrder: service.data.sortOrder,
                }]
            });
        };

        service.pageChanged = function(newPageNumber) {
            //console.log('pageChange');
            mypoller.stop();
            service.data.currentPage = newPageNumber;
            service.restart();
        }

        service.changeSorting = function(field) {
            mypoller.stop();
            if (field != service.data.sortBy) {
                service.data.sortBy = field;
                service.data.sortOrder = 'desc';
            } else {
                service.data.sortOrder = (service.data.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            this.restart();
        };

        service.sortedClass = function(field) {
            if (field != service.data.sortBy) {
                return 'fa-unsorted'
            } else {
                return service.data.sortOrder == 'desc' ? 'fa-sort-desc' : 'fa-sort-asc'
            }
        };

        return service;
    })
})();
