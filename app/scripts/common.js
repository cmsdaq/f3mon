'use strict';
/**
 * @ngdoc overview
 * @name f3monCommon
 * @description
 * # f3monCommon
 *
 * Directives and other globally used components
 */
(function() {
    angular.module('f3monApp')
    .directive('f3monCollapseControl', function() {
           return {
               restrict: 'E',
               templateUrl: 'views/all/f3mon-collapse-control.html'
           };
    })
})
