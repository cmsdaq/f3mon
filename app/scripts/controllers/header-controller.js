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

    .controller('runRangerCtrl', function($scope, runRangerService) {        
        $scope.$on( 'runRanger.status', function( event ) {
            $scope.isActive = runRangerService.isActive;
        });
        $scope.isActive = runRangerService.isActive;
        $scope.toggle = function() {
            runRangerService.toggle();
        }
    })

    .controller('systemSelectorCtrl', function($scope, indexListService) {
        $scope.$on( 'indices.list', function( event ) {
            $scope.list = indexListService.list;
        });
        $scope.$on( 'indices.selected', function( event ) {
            $scope.selected = indexListService.selected.subSystem;
        })
        $scope.selected = indexListService.selected.subSystem;
        $scope.list = indexListService.list;

        $scope.change = function(subSystem){
            indexListService.select(subSystem);
        };
    })

    .controller('riverStatusCtrl', function($scope, riverStatusService) {
        $scope.messages = [];
        $scope.isWorking = false;
        $scope.preventClose = function(event) { event.stopPropagation(); };

        $scope.$on( 'riverStatus.updated', function( event ) {
            $scope.messages = riverStatusService.messages;
            $scope.isWorking = riverStatusService.isWorking;
        });

    })


})();
