'use strict';



/**
 * @ngdoc overview
 * @name f3monApp
 * @description
 * # f3monApp
 *
 * Main module of the application.
 */

(function() {

    $.ajaxSetup({cache:false});

  angular.module('f3monApp', [
    'ngAnimate',
    'ngMessages',
    'ngResource',
    'ngCookies',
    'ngTouch',
    'ngResource',
    'ngSanitize',
    'emguo.poller',
    'percentage',
    'ui.bootstrap',
    'angularUtils.directives.dirPagination',    
    'mgcrea.ngStrap',
    'angularMoment',
    'ngTimezone',
    'nvd3',
    'disableAll'
  ]);

  angular.module('f3monApp').controller('bodyCtrl', function($scope,$rootScope,$window) {
        setPadding=function() {
          if ($window.innerWidth<992) {
              $scope.paddingDefault='64';
          }
          else $scope.paddingDefault='0'
        }
        setPadding();
        $rootScope.resizeList = [setPadding];
        angular.element($window).bind('resize', function(){for (var i=0;i<$rootScope.resizeList.length;i++) $rootScope.resizeList[i]()} );
    })


})();
