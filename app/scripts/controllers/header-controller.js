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

    .controller('timezoneSelectorCtrl', function($scope, $timezone, configService, angularMomentConfig) {
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
            } else {
                angularMomentConfig.timezone = 'utc';
                $scope.selected = 'UTC';
            }
        }

        $scope.$on('config.set', function(event) {
            config = configService.config;
            $scope.select(config.defaultTimezone);
        });

        
    })




    .controller('runRangerCtrl', function($scope, runRangerService) {
        $scope.$on('runRanger.status', function(event) {
            $scope.isActive = runRangerService.isActive;
        });
        $scope.isActive = runRangerService.isActive;
        $scope.toggle = function() {
            runRangerService.toggle();
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
            $location.path('/' + subSystem);
        };

        var checkUrl = function() {
            var path = $location.path().split('/');
            var subSystem = path[1];
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
