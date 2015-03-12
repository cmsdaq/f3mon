'use strict';

/**
 * @ngdoc service
 * @name f3monApp.navbar
 * @description
 * # core
 * Factory in the f3monApp.
 */

(function() {
    angular.module('f3monApp')

    //Service for the system selector
    .factory('indexListService', function($resource, $rootScope, poller, config) {
        var mypoller;
        var resource = $resource('api/getIndices.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        var mypoller = poller.get(resource, {
            action: 'jsonp_get',
            delay: config.fastPollingDelay,
            smart: true
        });

        mypoller.promise.then(null, null, function(data) {
            if (data.list && data.list.length != 0) {
                indices.setList(data.list);
                mypoller.stop();
            } else {
                console.error('Empty Indices List');
            }
        })

        var indices = {}
        indices.selected = {};
        indices.selected.index = "";
        indices.selected.subSystem = "";
        indices.list = [];
        indices.setList = function(list) {
            if (list.length === 0) {
                console.error('Empty Indices List');
                return;
            };
            this.list = list;
            this.broadcast('list');
            this.select(config.defaultSubSystem)
        };
        indices.select = function(subSystem) {
            var item = $.grep(this.list, function(e) {
                return e.subSystem == subSystem;
            })[0];
            if (!item) {
                console.error("Invalid subSystem: " + subSystem);
                return;
            };
            this.selected.index = item.index;
            this.selected.subSystem = item.subSystem;
            this.broadcast('selected');
        };
        indices.broadcast = function(msg) {
            $rootScope.$broadcast('indices.' + msg);
        }

        return indices;
    })

    //Service for the run ranger button
    .factory('runRangerService', function($resource, $rootScope, config, poller, indexListService, runInfoService) {
        var mypoller;
        var resource = $resource('api/runList.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });

        var runRanger = {};
        runRanger.isActive = true;

        runRanger.start = function() {
            if (!this.isActive) {
                return
            };
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        size: 1
                    }]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (data.runlist.length != 0 && !data.runlist[0].endTime) {
                        runInfoService.select(data.runlist[0].runNumber);
                        //runInfoService.select(123234);
                    };
                })
            } else {
                //Restart poller
                mypoller = poller.get(resource, {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        size: 1
                    }]
                });
            }
        };

        runRanger.toggle = function() {
            this.isActive = !this.isActive;
            if (this.isActive) {
                runRanger.start()
            } else {
                mypoller.stop()
            }
            this.broadcast('status');
        };

        runRanger.shutdown = function() {
            mypoller.stop();
            this.isActive = false;
            this.broadcast('status');
        };

        runRanger.broadcast = function(msg) {
            $rootScope.$broadcast('runRanger.' + msg);
        };

        $rootScope.$on('indices.selected', function(event) {
            runInfoService.reset();
            runRanger.start();
        });

        return runRanger;
    })


    //Service for the river status button
    .factory('riverStatusService', function($resource, $rootScope, config, poller, runInfoService, indexListService) {
        var mypoller;

        var resource = $resource('api/riverStatus.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });


        var service = {
            data: {
                messages: [{
                    msg: 'Loading...',
                    color: 'orange'
                }],
                isWorking: false,
                main: false, //it need to be running at the beginnin
                collector: true, //it doesn't need to be running at the beginning

            }
        };

        service.restart = function() {
            
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true
                });

                mypoller.promise.then(null, null, function(data) {
                    var runInfo = runInfoService.data;
                    var systemSelected = indexListService.selected.subSystem;
                    var item = _.find(data.systems, function(e) {
                        return systemSelected == e.subSystem
                    })
                    if (item) {
                        service.data.main = item;
                    } else {
                        service.data.main = false;
                    }
                    if (runInfo.runNumber && runInfo.isRunning()) {
                        item = _.find(data.runs, function(e) {
                            return e.runNumber == runInfo.runNumber
                        })
                        service.data.collector = item || false;
                    } else {
                        service.data.collector = true
                    }
                    updateMessages();
                })
            } else {
                mypoller.restart();
            }
        }

        var updateMessages = function() {

            var runInfo = runInfoService.data;
            var d = service.data;

            d.isWorking = (d.main && d.collector) ? 'btn-success' : 'btn-danger' ;
            if (d.main) {
                d.messages[0] = {
                    msg: "Main role running on server: " + d.main.host,
                    isWorking: true
                }
            } else {
                d.messages[0] = {
                    msg: "Main role not running on server: ",
                    isWorking: false
                }
            }
            if (d.collector) {
                if (d.collector.status) {
                    d.messages[1] = {
                        msg: "Collector for run " + runInfo.runNumber + " is running on server: " + d.collector.host,
                        isWorking: true
                    }
                } else {
                    if (d.messages.length > 1) {
                        d.messages.splice(1, 1);
                    }
                }
            } else {
                d.messages[1] = {
                    msg: "Collector for run " + runInfo.runNumber + " is not running",
                    isWorking: false
                }
            }
        };

        $rootScope.$on('runInfo.updated', function(event) {
            service.restart();
        });
        //$rootScope.$on('runInfo.selected', function(event) {
        //    service.restart();
        //});

        $rootScope.$on('indices.selected', function(event) {
            service.restart();
        });

        return service;
    })
})();
