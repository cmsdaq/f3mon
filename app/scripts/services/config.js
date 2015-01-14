'use strict';

/**
 * @ngdoc service
 * @name f3monApp.config
 * @description
 * # config
 * Constant in the f3monApp.
 */
angular.module('f3monApp')
    .constant('config', {
      'defaultSubSystem' : "cdaq",
      'fastPollingDelay' : 3000,
      'slowPollingDelay' : 5000,
    })
    .config(function(paginationTemplateProvider) {
        paginationTemplateProvider.setPath('views/dirPagination.tpl.html');
    });

