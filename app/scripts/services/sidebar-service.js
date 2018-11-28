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
    .factory('runInfoService', function($rootScope, poller, configService, indexListService) {
        var mypoller, restartPoller, cache, config;

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {

            data: {
                runNumber: false,
                startTime: false,
                endTime: false,
                streams: [],
                streamListINI: [],
                maskedStreams: [],
                queryStreams: [],
                lastLs: false,
                activeBUs: 0,
                totalBUs: 0,
                CMSSW_version:'',
                HLT_menu:'',
                smartStreamsAsString: function() {
                    if (this.streamListINI.length>this.streams.length) return this.iniStreamsAsString();
                    else return this.streamsAsString();
                },
                iniStreamsAsString: function() {
                  return this.streamListINI.length != 0 ? this.streamListINI.join(', ') : 'N/A';
                },
                streamsAsString: function() {
                    return this.streams.length != 0 ? this.streams.join(', ') : 'N/A';
                },
                isRunning: function() {
                    return this.endTime == false
                }
            },
            resetHeightNext : false 
        };

        service.reset = function() {            
            if (!angular.isUndefined(mypoller)) {
                mypoller.stop()
            };

            service.data.runNumber = false;
            service.data.startTime = false;
            service.data.endTime = false;
            service.data.streams = [];
            service.data.streamListINI = [];
            service.data.maskedStreams = [];
            service.data.queryStreams = [];
            service.data.lastLs = false;
            service.data.activeBUs = 0;
            service.data.totalBUs = 0;
            service.data.CMSSW_version='';
            service.data.HLT_menu='';
            service.resetHeightNext = true;
            cache = false;

            service.broadcast('selected');
        };



        service.restartCollector = function(runNumber) {
            restartPoller = poller.get('api/startCollector', {
                action: 'jsonp',
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

        service.select = function(runNumber,forceReset) {
            if (runNumber == this.data.runNumber && !forceReset) {
                return;
            }
            if (this.data.runNumber && runNumber)
              $rootScope.setMinHeight(angular.element(document.getElementById('runInfoElement')).prop('offsetHeight'));
            service.reset();
            service.data.runNumber = runNumber;

            service.start();
            service.broadcast('selected');
        };

        service.start = function() {
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get('api/runInfo', {
                    action: 'jsonp',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: this.data.runNumber
                    }]
                });
                mypoller.promise.then(null, null, function(data) {
                    if (service.resetHeightNext) {
                      $rootScope.setMinHeight("");service.resetHeightNext=false;
                    }
                    if (JSON.stringify(data) != cache) {
                        cache = JSON.stringify(data);
                        service.data.runNumber = data.runNumber;
                        service.data.startTime = data.startTime;
                        service.data.endTime = data.endTime ? data.endTime : false;
                        service.data.streams = data.streams;
                        service.data.activeBUs = data.activeBUs;
                        service.data.totalBUs = data.totalBUs;
                        if (data.hasOwnProperty("CMSSW_version"))
                          service.data.CMSSW_version=data.CMSSW_version;
                        else service.data.CMSSW_version="";
                        if (data.hasOwnProperty("HLT_menu"))
                          service.data.HLT_menu=data.HLT_menu.split(" ")[0];
                        else service.data.HLT_menu="";
                        service.data.streamListINI = data.streamListINI;
                        service.updateMaskedStreams(undefined);
                        service.data.lastLs = data.lastLs ? data.lastLs : false;
                        service.broadcast('updated');
                    }

                });
            } else {
                //Restart poller
                mypoller = poller.get('api/runInfo', {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: service.data.runNumber
                    }]
                });
            }
        };

        service.updateMaskedStreams = function(maskedStreamList)  {
            if (maskedStreamList!==undefined)
                service.data.maskedStreams = maskedStreamList;
            service.data.queryStreams = [];
            service.data.streams.forEach(function(stream) {
                var masked=false;
                service.data.maskedStreams.forEach(function(mstream) {
                    if (mstream == stream) {
                        masked=true;
                    }
                });
                if (!masked)
                    service.data.queryStreams.push(stream);
            });
            //console.log(service.data.queryStreams);
            service.broadcast('updated');
        }

        service.broadcast = function(msg) {
            $rootScope.$broadcast('runInfo.' + msg);
        };

        return service;
    })


    //Service for the disks information panel
    .factory('disksInfoService', function($rootScope, poller, configService, indexListService, runInfoService) {
        var mypoller, config;

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            active:false,
            paused:false,
            runNumber:false,
            data: {
                buRamDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used && this.total ? (this.used / this.total) : false
                    }
                },
                buOutDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used && this.total ? (this.used / this.total) : false
                    }
                },
                fuOutDisk: {
                    total: false,
                    used: false,
                    percent: function() {
                        return this.used && this.total ? (this.used / this.total) : false
                    }
                },
                resourceFrac: {
                    perc:false,
                    total:false,
                    active:false,
                    paused:false,
                    percent : function() { if (this.paused) return false; else return this.perc }
                }
            }
        };

        service.start = function() {
            service.active = true;
            if (service.paused) return;
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get('api/getDisksStatus', {
                    action: 'jsonp',
                    delay: config.fastPollingDelay,
                    smart: true,
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: runInfoService.data.runNumber
                    }]
                });
                service.runNumber=runInfoService.data.runNumber;

                mypoller.promise.then(null, null, function(data) {
                    //                    console.log(data);
                    //                    console.log(data.outputused);
                    var d = service.data;
                    d.fuOutDisk.total = data.data.value ? data.data.value : d.fuOutDisk.total;
                    d.fuOutDisk.used = data.dataused.value  ? data.dataused.value : d.fuOutDisk.used;
                    d.buOutDisk.total = data.output.value ? data.output.value : d.buOutDisk.total;
                    d.buOutDisk.used = data.outputused.value  ? data.outputused.value : d.buOutDisk.used;
                    d.buRamDisk.total = data.ramdisk.value ? data.ramdisk.value : d.buRamDisk.total;
                    d.buRamDisk.used = data.ramdiskused.value  ? data.ramdiskused.value : d.buRamDisk.used;
                    d.resourceFrac.perc = data.resourceFrac.value ? data.resourceFrac.value : false
                    d.resourceFrac.total = data.resourceFrac.value ? data.resourceCount.value : false
                    d.resourceFrac.active = data.resourceFrac.value ? data.resourceCountActive.value : false
                });
            } else {
                //Restart poller
                mypoller = poller.get('api/getDisksStatus', {
                    argumentsArray: [{
                        sysName: indexListService.selected.subSystem,
                        runNumber: runInfoService.data.runNumber
                    }]
                });
                service.runNumber=runInfoService.data.runNumber;
            }
        };

        service.stop = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.active = false;
        }

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.paused = true;
          service.data.resourceFrac.paused = true;
        }

        service.resume = function() {
          if (service.paused && service.active) {
             if (!angular.isUndefined(mypoller)) {//make sure existing poller is restarted
               mypoller.start();
             }
          }
          service.paused = false;
          service.data.resourceFrac.paused = false;
        }

        $rootScope.$on('runInfo.selected', function(event) {
            service.start();
        });

        //$rootScope.$on('runInfo.updated', function(event) {
        //    if (service.runNumber!=runInfoService.data.runNumber)
        //      service.start();
        //});

        return service;
    })

    //Service for the disks information panel
    .factory('runListService', function($rootScope, poller, configService, indexListService, runInfoService) {
        var mypoller, cache, config;

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
        });


        var service = {
            active:false,
            paused:false,
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
            service.active=true;
            if (service.paused) return;
            if (angular.isUndefined(mypoller)) {
                // Initialize poller and its callback
                mypoller = poller.get('api/runListTable', {
                    action: 'jsonp',
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
                        //mark currently viewed run
                        for (var i=0;i<service.data.displayed.length;i++) {
                          if (runInfoService.data.runNumber==service.data.displayed[i].runNumber)
                            service.data.displayed[i].selected=true;
                          else
                            service.data.displayed[i].selected=false;
                        }
                        service.data.numRuns = data.iTotalRecords;
                        service.data.displayTotal = data.iTotalDisplayRecords;
                    }
                })
            } else {
                //Restart poller
                mypoller = poller.get('api/runListTable', {
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

        service.stop = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.active = false;
        }

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.paused = true;
        }

        service.resume = function() {
          if (service.paused && service.active) {
             if (!angular.isUndefined(mypoller)) {//make sure existing poller is restarted
               mypoller.start();
             }
          }
          service.paused = false;
        }

        service.pageChanged = function(newPageNumber) {
            service.stop();
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
            service.stop();
            if (field != service.data.sortBy) {
                service.data.sortBy = field;
                service.data.sortOrder = 'desc';
            } else {
                service.data.sortOrder = (service.data.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            service.start();
        };

        service.search = function() {
            service.stop();
            service.start();
        };

        service.broadcast = function(msg) {
            $rootScope.$broadcast('service.' + msg);
        };

        $rootScope.$on('indices.selected', function(event) {
            //reset user-modifiable state of run selector
            service.data.searchText='';
            service.start();
        });

        $rootScope.$on('runInfo.selected', function(event) {
          for (var i=0;i<service.data.displayed.length;i++) {
            if (runInfoService.data.runNumber==service.data.displayed[i].runNumber)
              service.data.displayed[i].selected=true;
            else
              service.data.displayed[i].selected=false;
              //break;
          }
        });

        return service;
    })

    //Service for the disks information panel
    .factory('riverListService', function($rootScope, poller, configService, indexListService) {
        var mypoller, closePoller, cache, config;

        $rootScope.$on('config.set', function(event) {
            config = configService.config;
            start();
        });

        var start = function() {
            service.active = true;
            if (service.paused) return;
            if (angular.isUndefined(mypoller)) {
              mypoller = poller.get('api/runRiverListTable', {
                action: 'jsonp',
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
              });
            } else {
                //Restart poller
                mypoller = poller.get('api/runRiverListTable', {
                  argumentsArray: [{
                    size: service.data.itemsPerPage,
                    from: (service.data.currentPage - 1) * service.data.itemsPerPage,
                    sortBy: service.data.sortBy,
                    sortOrder: service.data.sortOrder,
                  }]
                });
            }
        }


        var service = {
            active:false,
            paused:false,
            data: {
                total: 0,
                currentPage: 1,
                itemsPerPage: 6,
                sortBy: 'role',
                sortOrder: 'desc',
                searchText: '',
                displayed: [],
            }
        };

        service.stop = function() {
          if (!angular.isUndefined(mypoller)) {
              mypoller.stop();
          }
          service.active = false;
        }

        service.pause = function() {
          if (!angular.isUndefined(mypoller)) {
              console.log('service3 paused')
              mypoller.stop();
          }
          service.paused = true;
        }

        service.resume = function() {
          if (service.paused && service.active) {
             if (!angular.isUndefined(mypoller)) {//make sure existing poller is restarted
               mypoller.start();
               console.log('service3 resumed')
             }
          }
          service.paused = false;
        }

        service.closeCollector = function(selected) {
            var runNumber = selected.runNumber;
            var subSystem = selected.subSystem;
            closePoller = poller.get('api/closeRun', {
                action: 'jsonp',
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

        service.pageChanged = function(newPageNumber) {
            //console.log('pageChange');
            service.stop();
            service.data.currentPage = newPageNumber;
            start();
        }

        service.changeSorting = function(field) {
            service.stop();
            if (field != service.data.sortBy) {
                service.data.sortBy = field;
                service.data.sortOrder = 'desc';
            } else {
                service.data.sortOrder = (service.data.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            start();
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
