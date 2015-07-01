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

    .factory('configService', function($resource, $rootScope, $cookieStore, poller) {

        var statusPoller, configPoller;
        var statusRes = $resource('api/serverStatus.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });

        var configRes = $resource('api/getConfig.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });




        var waitingForGreenStatus = function() {
            if (angular.isUndefined(statusPoller)) {
                // Initialize poller and its callback
                statusPoller = poller.get(statusRes, {
                    action: 'jsonp_get',
                    delay: 3000,
                    smart: true,
                    argumentsArray: []
                });

                statusPoller.promise.then(null, null, function(data) {
                    var status = data.status;
                    if (status == "green") {
                        statusPoller.stop();
                        waitingForConfig();
                    }
                });

            }
        }

        var waitingForGreenOrYellowStatus = function() {
            if (angular.isUndefined(statusPoller)) {
                // Initialize poller and its callback
                statusPoller = poller.get(statusRes, {
                    action: 'jsonp_get',
                    delay: 3000,
                    smart: true,
                    argumentsArray: []
                });

                statusPoller.promise.then(null, null, function(data) {
                    var status = data.status;
                    if (status == "green" || status == "yellow") {
                        statusPoller.stop();
                        waitingForConfig();
                    }
                });

            }
        }


        var waitingForConfig = function() {
            var configName = $cookieStore.get('f3monConfigName') || 'default';
            configPoller = poller.get(configRes, {
                action: 'jsonp_get',
                delay: 3000,
                smart: true,
                argumentsArray: [{
                    configName: configName
                }]
            });

            configPoller.promise.then(null, null, function(data) {
                configPoller.stop();
                service.config = data.config;
                broadcast("set");

                //console.log(data.config);

            });
        }


        var broadcast = function(msg) {
            $rootScope.$broadcast('config.' + msg);
        }


        waitingForGreenOrYellowStatus();

//$rootScope.$watch(function() {
//  return service.config
//}, function watchCallback(newValue, oldValue) {
//  console.log(newValue)
//});



        var service = {
            config:false
        };
        //var service = {
        //    'defaultSubSystem': "cdaq",
        //    'fastPollingDelay': 3000,
        //    'slowPollingDelay': 5000,
        //    'chartWaitingMsg': 'No monitoring information.',
        //    'msChartMaxPoints': 60,
        //    'defaultTimezone': 'Locale',
        //}

        return service;

    })



    //Service for the system selector
    .factory('indexListService', function($resource, $rootScope, poller, configService) {
        var config = false;
        var mypoller;
        var resource = $resource('api/getIndices.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
        });



        var start = function() {

            if (angular.isUndefined(mypoller)) {
                var mypoller = poller.get(resource, {
                    action: 'jsonp_get',
                    delay: config.fastPollingDelay,
                    smart: true
                });

                mypoller.promise.then(null, null, function(data) {
                    if (data.list && data.list.length != 0) {
                        setList(data.list);
                        mypoller.stop();
                    } else {
                        console.error('Empty Indices List');
                    }
                })
            }
        }

        var setList = function(list) {
            if (list.length === 0) {
                console.error('Empty Indices List');
                return;
            };
            service.list = list;
            broadcast('list');
            service.select(config.defaultSubSystem);
        };


        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            start();
        });

        var broadcast = function(msg) {
            $rootScope.$broadcast('indices.' + msg);
        }


        var service = {}
        service.selected = {};
        service.selected.index = "";
        service.selected.subSystem = "";
        service.list = [];

        service.select = function(subSystem) {
            var item = $.grep(this.list, function(e) {
                return e.subSystem == subSystem;
            })[0];
            if (!item) {
                console.error("Invalid subSystem: " + subSystem);
                return;
            };
            this.selected.index = item.index;
            this.selected.subSystem = item.subSystem;
            broadcast('selected');
        };


        return service;
    })

    //Service for the run ranger button
    .factory('runRangerService', function($resource, $rootScope, configService, poller, indexListService, runInfoService) {
        var mypoller,config;
        var resource = $resource('api/runList.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP'
            }
        });

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
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
    .factory('riverStatusService', function($resource, $rootScope, configService, poller, runInfoService, indexListService) {
        var mypoller,config;

        var resource = $resource('api/riverStatus.php', {
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

            d.isWorking = (d.main && d.collector) ? 'btn-success' : 'btn-danger';
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
