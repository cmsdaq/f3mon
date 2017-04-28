'use strict';

/**
 * @ngdoc overview
 * @name f3monHeader
 * @description
 * # f3monHeader
 *
 * Module handling the header navbar.
 */

(function() {
    var app = angular.module('f3monApp')

    .directive('f3monNavbar', function() {
        return {
            restrict: 'E',
            templateUrl: 'views/f3mon-header.html'
        };
    })

    .controller('guideCtrl', function($scope) {

        $scope.startTour = function() {
            console.log(tourConfig)
            if (!tourConfig.tour.__inited) {
                tourConfig.tour.init()
            }
            tourConfig.tour.restart();

        }

    })

    .controller('timezoneSelectorCtrl', function($scope, $rootScope, $timezone, configService, angularMomentConfig, microStatesChartConfig) {
        var config;

        $scope.list = ['UTC', 'Locale'];
        $scope.selected = 'UTC';
        angularMomentConfig.timezone = 'utc';


        //angularMomentConfig.preprocess = 'utc';
        //angularMomentConfig.format = 'MMM D YYYY, HH:mm'; //not working
        //console.log($timezone.getName())
        //setInterval(function(){$scope.selected = 'locale'},3000)

        $scope.select = function(name) {
            if (name == 'Locale') {
                angularMomentConfig.timezone = $timezone.getName();
                $scope.selected = 'Locale';
                Highcharts.theme.global.useUTC=false;
            } else {
                angularMomentConfig.timezone = 'utc';
                $scope.selected = 'UTC';
                Highcharts.theme.global.useUTC=true;
            }
            highchartsOptions = Highcharts.setOptions(Highcharts.theme);
            $rootScope.$broadcast('timeZone.updated');
        }

        $scope.$on('config.set', function(event) {
            config = configService.config;
            $scope.select(config.defaultTimezone);
        });

        
    })

    .controller('runRangerCtrl', function($scope, $location, runRangerService) {

        $scope.$on('config.set', function(event) {
            checkUrl();
        });

        $scope.$on('runRanger.status', function(event) {
            $scope.isActive = runRangerService.isActive;
        });

        var lastScheduled = null;
        $scope.isActive = runRangerService.isActive;
        $scope.showTooltip = false;
        $scope.toggle = function() {
            runRangerService.toggle();
        }

        runRangerService.flipAction = function() {
          $scope.showTooltip=false;
          clearTimeout(lastScheduled);
          lastScheduled = setTimeout(runRangerCheck,10000);
        }

        var runRangerCheck = function() {
          $scope.showTooltip = !$scope.showTooltip;
          lastScheduled = setTimeout(runRangerCheck,$scope.showTooltip?10000:30000);
        }
        //run this after 60 seconds, every 30 seconds
        lastScheduled = setTimeout(runRangerCheck,10000);

        var checkUrl = function() {
          var loc = $location.path().split('/');
          //console.log('pathvec ' + location)
          var run = undefined;
          loc.forEach(function(item) {
            var pitem = item.split('=');
            //console.log('pitem:'+ pitem)
            if (pitem.length==2 && pitem[0]=='run')
              run=pitem[1];
          });
          if (!angular.isUndefined(run)) {
            var loc_new = [];
            //clear run from path location
            loc.forEach(function(item) {
              if (!item.startsWith("run=")) loc_new.push(item);
            });
            $location.path(loc_new.join('/'));
              runRangerService.preloadRun=run;
          }
        }
    })

    .controller('pollerCtrl', function($scope,poller) {
            $scope.isActive = true;
            $scope.toggle =  function() {
              $scope.isActive = !$scope.isActive;
              if (!$scope.isActive)
                poller.pauseAll();
              else
                poller.resumeAll();
            }
    })

    .controller('settingsCtrl', function($scope, $cookieStore) {
        //console.log('settingsCtrl')


    })

    .controller('systemSelectorCtrl', function($scope, indexListService, $location, configService) {
        var config = configService.config;

        $scope.$on('config.set', function(event) {
            config = configService.config;
            checkUrl();
        });

        $scope.$on('indices.list', function(event) {
            $scope.list = indexListService.list;
        });
        $scope.$on('indices.selected', function(event) {
            $scope.selected = indexListService.selected.subSystem;
        })
        $scope.selected = indexListService.selected.subSystem;
        $scope.list = indexListService.list;

        $scope.change = function(subSystem) {
            indexListService.select(subSystem);
            var loc = $location.path().split('/');
            //console.log('pathvec ' + location)
            var locparams = {}
            loc.forEach(function(item) {
              var pitem = item.split('=');
              if (pitem.length==2)
                locparams[pitem[0]]=pitem[1];
            });
            locparams["setup"]=subSystem;
            var lockeys = Object.keys(locparams).sort();
            var new_path = "";
            for (var i=lockeys.length-1;i>=0;i--)
              new_path+="/"+lockeys[i]+'='+locparams[lockeys[i]]
            console.log('pre ' + $location.path())
            $location.path(new_path);
            //$location.path('/setup=' + subSystem);
            console.log('post ' + $location.path())
        };

        var checkUrl = function() {
            var loc = $location.path().split('/');
            //console.log('pathvec ' + location)
            var subSystem = undefined;
            loc.forEach(function(item) {
              var pitem = item.split('=');
              //console.log('pitem:'+ pitem)
              if (pitem.length==2 && pitem[0]=='setup')
                subSystem=pitem[1];
            });
            if (!angular.isUndefined(subSystem)) {
                config.defaultSubSystem = subSystem;
            }
        }

    })

    .controller('riverStatusCtrl', function($scope, riverStatusService) {
        $scope.data = riverStatusService.data;

        //prevent button dropdown to close when click on a message (eg if you want to copy paste)
        $scope.preventClose = function(event) {
            return event.stopPropagation();
        };
    })

    .controller('tabsCtrl', function($scope, logsService, globalService) {
        $scope.logdata = logsService.data;
        $scope.globalStatus = globalService.status;
        //$scope.globalStatus.changeTab(1);
        //console.log($scope.globalStatus)



    })



})();
