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

        var modal = $modal({scope: $scope, template: 'views/restartModal.tpl.html',placement:'center', show: false, backdrop:true});
        $scope.data = runInfoService.data;
        $scope.selected = false;
        $scope.restartCollector = runInfoService.restartCollector;

        $scope.restartCollectorDialog = function (runNumber) {
            console.log(runNumber)
            $scope.selected = runNumber;
            modal.$promise.then(modal.show);
        };
    })

    .controller('disksInfoCtrl', function($scope, disksInfoService) {
        $scope.data = disksInfoService.data;
    })

    .controller('runListCtrl', function($scope, runListService, runRangerService, runInfoService) {
        //$scope.noData = true;
        $scope.data = runListService.data;
        var service = runListService;
        $scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;

        $scope.selectRun = function(runNumber) {
            runRangerService.shutdown();
            runInfoService.select(runNumber);
        };

    })

    .controller('riverListCtrl', function($scope,$modal, riverListService) {
        var modal = $modal({scope: $scope, template: 'views/closeModal.tpl.html', show: false});
        var service = riverListService;

        //$scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;
        
        $scope.selected = false;
        $scope.data = service.data;

        $scope.closeCollectorDialog = function (name) {
            $scope.selected = name.split("_")[1];
            modal.$promise.then(modal.show);
        };

        $scope.pageChanged = service.pageChanged;

        $scope.closeCollector = service.closeCollector;


    })


})();
