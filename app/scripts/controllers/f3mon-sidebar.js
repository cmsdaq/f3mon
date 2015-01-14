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
        $scope.numFiltered = 0;
        $scope.currentPage = 1;
        $scope.itemsPerPage = 5;
        $scope.searchText = '';
        $scope.sortBy = 'runNumber';
        $scope.sortOrder = 'desc';

        $scope.pageChanged = function(newPageNumber) {
            runListService.pageChanged(newPageNumber);
        };

        $scope.sortedClass = function(field){
            if(field != $scope.sortBy){return 'fa-unsorted'}
                else { return $scope.sortOrder == 'desc' ? 'fa-sort-desc' : 'fa-sort-asc' }
        };
        
        $scope.changeSorting = function(field){
            if(field != $scope.sortBy ) {
                $scope.sortBy = field;
                $scope.sortOrder = 'desc';
            } else {
                $scope.sortOrder = ($scope.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            sortingChanged();
        };

        var sortingChanged = function(){
            runListService.sortingChanged($scope.sortBy,$scope.sortOrder);
        };

        $scope.search = function(){
            runListService.search($scope.searchText);
        }

        $scope.$on( 'runList.updated', function( event ) {
            $scope.displayed = runListService.displayed;
            $scope.numRuns = runListService.total;
            $scope.numFiltered = runListService.numFiltered;

            $scope.noData = false;
        })
        
    })

    .controller('riverListCtrl', function($scope, riverListService) {        
        $scope.noData = true;
        $scope.displayed = [];
        $scope.total = 0;
        $scope.numFiltered = 0;
        $scope.currentPage = 1;
        $scope.itemsPerPage = 5;
        $scope.sortBy = 'role';
        $scope.sortOrder = 'desc';

        $scope.pageChanged = function(newPageNumber) {
            riverListService.pageChanged(newPageNumber);
        };

        $scope.sortedClass = function(field){
            if(field != $scope.sortBy){return 'fa-unsorted'}
                else { return $scope.sortOrder == 'desc' ? 'fa-sort-desc' : 'fa-sort-asc' }
        };
        
        $scope.changeSorting = function(field){
            if(field != $scope.sortBy ) {
                $scope.sortBy = field;
                $scope.sortOrder = 'desc';
            } else {
                $scope.sortOrder = ($scope.sortOrder == 'desc') ? 'asc' : 'desc';
            }
            sortingChanged();
        };

        var sortingChanged = function(){
            riverListService.sortingChanged($scope.sortBy,$scope.sortOrder);
        };

        $scope.$on( 'riverList.updated', function( event ) {
            console.log('updated')
            $scope.displayed = riverListService.displayed;
            $scope.total = riverListService.total;
            $scope.numFiltered = riverListService.numFiltered;
            $scope.noData = false;
        })
        
    })


})();
