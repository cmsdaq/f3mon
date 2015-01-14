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
    var app = angular.module('f3monApp')

    .directive('f3monSidebar', function() {
        return {
            restrict: 'E',
            templateUrl: 'views/f3mon-sidebar.html'
        };
    })

    .controller('runInfoCtrl', function($scope, runInfoService) {        
        $scope.isRunning = "N/A";
        $scope.startTime = "N/A";
        $scope.endTime = "N/A";
        $scope.runNumber = "No Run ongoing";
        $scope.lastls = "N/A";
        $scope.streams = "N/A";

        $scope.$on( 'runInfo.updated', function( event ) {
            $scope.isRunning = runInfoService.isRunning;
            $scope.startTime = runInfoService.startTime;
            $scope.endTime = runInfoService.endTime;
            $scope.runNumber = runInfoService.runNumber;     
            $scope.streams = runInfoService.streams;
            $scope.lastls = runInfoService.lastls;       
        });
        
    })

    .controller('disksInfoCtrl', function($scope, disksInfoService) {        
        $scope.buRamDisk = false;
        $scope.buOutDisk = false;
        $scope.fuOutDisk = false;

        $scope.$on( 'disksInfo.updated', function( event ) {
            $scope.buRamDisk = disksInfoService.buRamDisk.used/disksInfoService.buRamDisk.total;
            $scope.buOutDisk = disksInfoService.buOutDisk.used/disksInfoService.buOutDisk.total;
            $scope.fuOutDisk = disksInfoService.fuOutDisk.used/disksInfoService.fuOutDisk.total;
        });
        
    })

    .controller('runListCtrl', function($scope, runListService) {        
        $scope.noData = true;
        $scope.displayed = [];
        $scope.numRuns = 0;
        $scope.currentPage = 1;
        $scope.pageNum = 200;
        $scope.searchText = '';



        $scope.search = function(){
            console.log('search')
        }

        $scope.$on( 'runList.updated', function( event ) {
            $scope.displayed = runListService.displayed;
            $scope.numRuns = 100;
            $scope.noData = false;
        })


    
        $scope.pagination = {
            current: 1
        };
    
        $scope.pageChanged = function(newPage) {
            getResultsPage(newPage);
        };
    
        function getResultsPage(pageNumber) {
            // this is just an example, in reality this stuff should be in a service
            console.log('resultpage')
        }
        
    })



})();
