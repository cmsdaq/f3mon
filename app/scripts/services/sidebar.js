'use strict';

/**
 * @ngdoc service
 * @name f3monApp.sidebar
 * @description
 * # core
 * Factory in the f3monApp.
 */
angular.module('f3monApp')

//Service for the status of run selected; Check StartTime, EndTime, streams and lastls
.factory('runInfoService', function($resource, $rootScope, poller, config, indexListService) {
    var mypoller;

    var resource = $resource('api/runInfo.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP',
        }
    });


    var runInfo = {};
    runInfo.runNumber = false;
    runInfo.isRunning = false;
    runInfo.startTime = false;
    runInfo.endTime = false;
    runInfo.streams = false;
    runInfo.lastls = false;

    runInfo.select = function(runNumber) {
        if (runNumber == this.runNumber) {
            return;
        }
        this.runNumber = runNumber;
        this.startTime = false;
        this.endTime = false;
        this.isRunning = false;
        this.start();
        this.broadcast("selected");
    };

    runInfo.start = function() {
        if (angular.isUndefined(mypoller)) {
            // Initialize poller and its callback
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true,
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    runNumber: this.runNumber
                }]
            });

            mypoller.promise.then(null, null, function(data) {
                var update = false;
                if (data.startTime != runInfo.startTime) {
                    runInfo.startTime = data.startTime;
                    runInfo.isRunning = true;
                    update = true;
                }

                if (data.endTime && data.endTime != runInfo.endTime) {
                    runInfo.endTime = data.endTime;
                    runInfo.isRunning = false;
                    update = true;
                }
                var newStreams = $.map(data.streams, function(item) {
                    return item.term;
                }).join(", ");
                var newLs = data.lastls ? data.lastls[0] : false;
                if (runInfo.streams != newStreams) {
                    runInfo.streams = newStreams;
                    update = true;
                }
                if (runInfo.lastls != newLs) {
                    runInfo.lastls = newLs;
                    update = true;
                }
                if (update) {
                    runInfo.broadcast("updated")
                }
            });
        } else {
            //Restart poller
            mypoller = poller.get(resource, {
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    runNumber: this.runNumber
                }]
            });
        }
    };

    runInfo.broadcast = function(msg) {
        $rootScope.$broadcast('runInfo.' + msg);
    };

    return runInfo;
})


//Service for the disks information panel
.factory('disksInfoService', function($resource, $rootScope, poller, config, indexListService, runInfoService) {
    var mypoller;

    var resource = $resource('api/getDisksStatus.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP',
        }
    });


    var disksInfo = {};
    disksInfo.buRamDisk = {
        total: false,
        used: false
    };
    disksInfo.buOutDisk = {
        total: false,
        used: false
    };
    disksInfo.fuOutDisk = {
        total: false,
        used: false
    };

    disksInfo.start = function() {
        if (angular.isUndefined(mypoller)) {
            // Initialize poller and its callback
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true,
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    runNumber: runInfoService.runNumber
                }]
            });

            mypoller.promise.then(null, null, function(data) {
                var update = false;
                if (data.data.value) {
                    disksInfo.fuOutDisk.total = data.data.value;
                    update = true;
                };
                if (data.dataused.value) {
                    disksInfo.fuOutDisk.used = data.dataused.value;
                    update = true;
                };
                if (data.output.value) {
                    disksInfo.buOutDisk.total = data.output.value;
                    update = true;
                };
                if (data.outputused.value) {
                    disksInfo.buOutDisk.used = data.outputused.value;
                    update = true;
                };
                if (data.ramdisk.value) {
                    disksInfo.buRamDisk.total = data.ramdisk.value;
                    update = true;
                };
                if (data.ramdiskused.value) {
                    disksInfo.buRamDisk.used = data.ramdiskused.value;
                    update = true;
                };
                if (update) {
                    disksInfo.broadcast('updated')
                };
            });
        } else {
            //Restart poller
            mypoller = poller.get(resource, {
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    runNumber: runInfoService.runNumber
                }]
            });
        }
    };

    disksInfo.broadcast = function(msg) {
        $rootScope.$broadcast('disksInfo.' + msg);
    };

    $rootScope.$on('runInfo.selected', function(event) {
        disksInfo.start();
    });

    return disksInfo;
})

//Service for the disks information panel
.factory('runListService', function($resource, $rootScope, poller, config, indexListService) {
    var mypoller, cache;
    var resource = $resource('api/runListTable.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP'
        }
    });

    var runList = {};
    runList.total = 0;
    runList.currentPage = 1;
    runList.itemPerPage = 5;
    runList.sortBy = 'runNumber';
    runList.sortOrder = 'desc';
    runList.searchText = '';
    runList.displayed = [];

    runList.start = function() {
        if (angular.isUndefined(mypoller)) {
            // Initialize poller and its callback
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true,
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    size: runList.itemPerPage,
                    from: (runList.currentPage - 1) * runList.itemPerPage,
                    sortBy: runList.sortBy,
                    sortOrder: runList.sortOrder,
                    search: runList.searchText
                }]
            });
            mypoller.promise.then(null, null, function(data) {
                var update = false;
                if (JSON.stringify(data.aaData) != cache) {
                    cache = JSON.stringify(data.aaData);
                    runList.displayed = data.aaData;
                    update = true;
                }
                if (runList.total != data.iTotalRecords) {
                    runList.total = data.iTotalRecords;
                    update = true;
                }
                if (runList.numFiltered != data.iTotalDisplayRecords) {
                    runList.numFiltered = data.iTotalDisplayRecords;
                    update = true;
                }

                if (update) {
                    runList.broadcast("updated");
                }
            })
        } else {
            //Restart poller
            mypoller = poller.get(resource, {
                argumentsArray: [{
                    sysName: indexListService.selected.subSystem,
                    size: runList.itemPerPage,
                    from: (runList.currentPage - 1) * runList.itemPerPage,
                    sortBy: runList.sortBy,
                    sortOrder: runList.sortOrder,
                    search: runList.searchText
                }]
            });
        }
    };

    runList.pageChanged = function(newPageNumber) {
        mypoller.stop();
        runList.currentPage = newPageNumber;
        this.start();

    }

    runList.sortingChanged = function(sortBy, sortOrder) {
        mypoller.stop();
        runList.sortBy = sortBy;
        runList.sortOrder = sortOrder;
        this.start();
    };

    runList.search = function(text) {
        mypoller.stop();
        runList.searchText = text;
        this.start();
    };

    runList.broadcast = function(msg) {
        $rootScope.$broadcast('runList.' + msg);
    };


    $rootScope.$on('indices.selected', function(event) {
        runList.start();
    });

    return runList;
})

//Service for the disks information panel
.factory('riverListService', function($resource, $rootScope, poller, config) {
    var mypoller, cache;
    var resource = $resource('api/runRiverListTable.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP'
        }
    });

    var riverList = {};
    riverList.total = 0;
    riverList.currentPage = 1;
    riverList.itemPerPage = 5;
    riverList.sortBy = 'role';
    riverList.sortOrder = 'desc';
    riverList.searchText = '';
    riverList.displayed = [];

    mypoller = poller.get(resource, {
        action: 'jsonp_get',
        delay: config.fastPollingDelay,
        smart: true,
        argumentsArray: [{
            size: riverList.itemPerPage,
            from: (riverList.currentPage - 1) * riverList.itemPerPage,
            sortBy: riverList.sortBy,
            sortOrder: riverList.sortOrder,
        }]
    });
    mypoller.promise.then(null, null, function(data) {
        //console.log(data);
        //console.log(JSON.stringify(data.list));
        var update = false;
        if (JSON.stringify(data.list) != cache) {
            cache = JSON.stringify(data.list);
            riverList.displayed = data.list;
            update = true;
        }
        if (riverList.total != data.total) {
            riverList.total = data.total;
            update = true;
        }

        if (update) {
            riverList.broadcast("updated");
        }
    })


    riverList.restart = function() {
        //Restart poller
        //console.log(riverList.currentPage);
        mypoller = poller.get(resource, {
            argumentsArray: [{
                size: riverList.itemPerPage,
                from: (riverList.currentPage - 1) * riverList.itemPerPage,
                sortBy: riverList.sortBy,
                sortOrder: riverList.sortOrder,
            }]
        });
    };

    riverList.pageChanged = function(newPageNumber) {
        mypoller.stop();
        riverList.currentPage = newPageNumber;
        this.restart();
    }

    riverList.sortingChanged = function(sortBy, sortOrder) {
        mypoller.stop();
        riverList.sortBy = sortBy;
        riverList.sortOrder = sortOrder;
        console.log(riverList.sortOrder);
        this.restart();
    };

    riverList.search = function(text) {
        mypoller.stop();
        riverList.searchText = text;
        this.restart();
    };

    riverList.broadcast = function(msg) {
        $rootScope.$broadcast('riverList.' + msg);
    };

    return riverList;
})
