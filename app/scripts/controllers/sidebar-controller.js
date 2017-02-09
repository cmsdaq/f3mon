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

    .controller('runInfoCtrl', function($rootScope, $scope, $modal, runInfoService, disksInfoService) {
        $scope.isCollapsed = false;

        var modal = $modal({
            scope: $scope,
            templateUrl: 'views/restartModal.tpl.html',
            placement: 'center',
            show: false,
            backdrop: true
        });
        $scope.data = runInfoService.data;
        $scope.dataDisks = disksInfoService.data;
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
        $scope.buFracColor = function(){
          return ""//todo:figure out color when stopping
          //console.log('bufraccolor ' + runInfoService.data.totalBUs +' '+ runInfoService.data.activeBUs)
          if (isNaN(runInfoService.data.totalBUs) || isNaN(runInfoService.data.activeBUs)) return "";
          if (!runInfoService.data.totalBUs || !runInfoService.data.activeBUs) return "";
          var bufrac = runInfoService.data.activeBUs/runInfoService.data.totalBUs;
          if (bufrac<0.5) return "red";
          if (bufrac<0.75) return "orange";
          if (bufrac<0.90) return "yellow";
          if (bufrac<0.95) return "khaki";
          return ""
        }
        $scope.resFracColor = function(){
          return ""//todo:figure out color when stopping
          var resfrac = disksInfoService.data.resourceFrac.percent();
          //console.log('resfrac '+resfrac)
          if (resfrac===false) return "";
          if (resfrac<0.5) return "red";
          if (resfrac<0.75) return "orange";
          if (resfrac<0.90) return "yellow";
          if (resfrac<0.95) return "khaki";
          return ""
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

        $scope.diskFracColor = function(call){
          var resfrac = disksInfoService.data[call].percent();
          if (resfrac==false) return "";
          if (resfrac>0.80) return "red";
          if (resfrac>0.65) return "orange";
          if (resfrac>0.50) return "yellow";
          if (resfrac>0.40) return "khaki";
          return ""
        }

        $scope.diskFracColor2 = function(){
          var resfrac = disksInfoService.data.buOutDisk.percent();
          if (resfrac==false) return "";
          if (resfrac>0.80) return "red";
          if (resfrac>0.65) return "orange";
          if (resfrac>0.50) return "yellow";
          if (resfrac>0.40) return "khaki";
          return ""
        }

        $scope.diskFracColor3 = function(){
          var resfrac = disksInfoService.data.fuOutDisk.percent();
          if (resfrac==false) return "";
          if (resfrac>0.80) return "red";
          if (resfrac>0.65) return "orange";
          if (resfrac>0.50) return "yellow";
          if (resfrac>0.40) return "khaki";
          return ""
        }
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
            globalService.status.reset(false);

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
