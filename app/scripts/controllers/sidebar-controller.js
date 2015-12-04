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

    .controller('sidebarCtrl', function($scope) {
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

    .controller('runInfoCtrl', function($scope, $modal, runInfoService) {

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
    })

    .controller('disksInfoCtrl', function($scope, disksInfoService) {
        $scope.data = disksInfoService.data;
    })

    .controller('runListCtrl', function($scope, runListService, runRangerService, runInfoService, globalService) {
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
                    runInfoService.select(runNumber);
                }, 10);


        };

    })

    .controller('riverListCtrl', function($scope, $modal, riverListService) {
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
                "runNumber": name.split("_")[1],
                "subSystem": subSystem
            };
            modal.$promise.then(modal.show);
        };

        $scope.pageChanged = service.pageChanged;

        $scope.closeCollector = service.closeCollector;


    })


})();
