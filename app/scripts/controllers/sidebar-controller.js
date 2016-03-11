'use strict';

/**
 * @ngdoc overview
 * @name f3monSidebar
 * @description
 * # f3monHeader
 *
 * Module handling the header navbar.
 */

(function() {
    angular.module('f3monApp')

    .directive('f3monSidebar', function() {
        return {
            restrict: 'E',
            templateUrl: 'views/f3mon-sidebar.html'
        };
    })

    .controller('sidebarCtrl', function($scope,$rootScope,$window) {

        var setPadding=function() {
          //console.log($window.innerWidth);
          if ($window.innerWidth<992) {
              $scope.style='padding-left: 0;padding-right: 0;'
              //console.log('padding 0')
          }
          else {
              $scope.style='padding-right: 0;'
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        $scope.selectTour = function(id) {
            console.log(tourConfig.tour)
            if (!tourConfig.tour.__inited) {
                tourConfig.tour.init()
            }

            var id = "#" + id;
            var steps = tourConfig.tour._options.steps;
            var i = steps.map(function(e) {
                return e.element;
            }).indexOf(id);
            tourConfig.tour.restart();
            tourConfig.tour.goTo(i);
        }

    })

    .controller('runInfoCtrl', function($rootScope, $scope, $modal, runInfoService) {
        $scope.isCollapsed = false;

        var modal = $modal({
            scope: $scope,
            templateUrl: 'views/restartModal.tpl.html',
            placement: 'center',
            show: false,
            backdrop: true
        });
        $scope.data = runInfoService.data;
        $scope.selected = false;
        $scope.restartCollector = runInfoService.restartCollector;

        $scope.restartCollectorDialog = function(runNumber) {
            console.log(runNumber)
            $scope.selected = runNumber;
            modal.$promise.then(modal.show);
        };

        $scope.minHeight="";
        $rootScope.setMinHeight = function(val) {
          if (val!=="")
            $scope.minHeight = val+'px';
            else $scope.minHeight=""
        }
    })

    .controller('disksInfoCtrl', function($scope, disksInfoService) {
        $scope.isCollapsed = false;
        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) disksInfoService.resume()
          else disksInfoService.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        $scope.data = disksInfoService.data;
    })

    .controller('runListCtrl', function($scope, runListService, runRangerService, runInfoService, globalService) {
        $scope.isCollapsed = false;
        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) runListService.resume()
          else runListService.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        //$scope.noData = true;
        $scope.data = runListService.data;
        var service = runListService;
        $scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;

        $scope.selectRun = function(runNumber) {
            //srchart need to have a container visible to set high and width properly
            globalService.status.reset();

            window.setTimeout(
                function() {
                    runRangerService.shutdown();
                    runInfoService.select(runNumber,true);
                }, 10);


        };

    })

    .controller('riverListCtrl', function($scope, $rootScope, $window, $modal, riverListService) {
        $scope.isCollapsed = false;

        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) riverListService.resume()
          else riverListService.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        var collapsedWithResize = false;
        var setPadding=function() {
          if ($window.innerWidth<992) {
            if (!$scope.isCollapsed) {
              console.log('collapsing!')
              collapsedWithResize=true;
              $scope.collapseChanged();
            }
          }
          else {
            if ($scope.isCollapsed && collapsedWithResize) {
              $scope.collapseChanged();
            }
            collapsedWithResize=false;
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        var modal = $modal({
            scope: $scope,
            templateUrl: 'views/closeModal.tpl.html',
            show: false
        });
        var service = riverListService;

        //$scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;

        $scope.selected = false;
        $scope.data = service.data;

        $scope.closeCollectorDialog = function(name, subSystem) {
            $scope.selected = {
                //"runNumber": name.split("_")[1],
                "runNumber": name,
                "subSystem": subSystem
            };
            modal.$promise.then(modal.show);
        };

        $scope.pageChanged = service.pageChanged;

        $scope.closeCollector = service.closeCollector;


    })


})();
