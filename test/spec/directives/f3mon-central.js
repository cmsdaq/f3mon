'use strict';

describe('Directive: f3monCentral', function () {

  // load the directive's module
  beforeEach(module('f3monApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<f3mon-central></f3mon-central>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the f3monCentral directive');
  }));
});
