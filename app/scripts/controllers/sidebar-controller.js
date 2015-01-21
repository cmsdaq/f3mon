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

    .controller('runInfoCtrl', function($scope, runInfoService) {        
        $scope.data = runInfoService.data;
    })

    .controller('disksInfoCtrl', function($scope, disksInfoService) {     
        $scope.data = disksInfoService.data;   
    })

    .controller('runListCtrl', function($scope, runListService, runRangerService, runInfoService) {    
        //$scope.noData = true;
        $scope.data = runListService.data;
        $scope.service = runListService;
        $scope.selectRun = function(runNumber){
            runRangerService.shutdown();
            runInfoService.select(runNumber);
        };
    })

    .controller('riverListCtrl', function($scope, riverListService) {   
        $scope.service = riverListService;
        $scope.data = riverListService.data;
    })


})();
