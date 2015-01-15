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
        'defaultSubSystem': "cdaq",
        'fastPollingDelay': 3000,
        'slowPollingDelay': 5000,
    })
    .config(function(paginationTemplateProvider) {
        paginationTemplateProvider.setPath('views/dirPagination.tpl.html');
    })

.constant('streamRatesChartConfig', {
    options: {
        chart: {
            //animation: false,
            borderWidth: 1,
            animation: {
                duration: 500,
                easing: 'linear'
            },
            //renderTo: "streamrates-chart",

            zoomType: 'x',
            events: {},
        },
        //    colors: Colors.colorList(),    
    },

    tooltip: {
        followPointer: false
    },
    legend: {
        align: 'center',
        verticalAlign: 'bottom',
        maxHeight: 50,
    },
    title: {
        text: 'StreamChart Rates'
    },
    xAxis: [{
        //lineWidth:0,
        gridLineWidth: 1,
        id: "ls",
        allowDecimals: false,
        title: {
            text: 'LS'
        },
        categories: true,
        tickmarkPlacement: 'on',
        type: "category"
    }],
    yAxis: [{
        title: {
            text: 'Events'
        },
        id: "rates",
        height: "74%",
        lineWidth: 1,
        offset: 0,
    }, {
        title: {
            text: 'Completeness %'
        },
        max: 100,
        min: 0,
        height: "74%",
        opposite: true,
        id: "percent",
        lineWidth: 1,
        offset: 0,
    }, {
        title: {
            text: 'miniMerge %'
        },
        max: 100,
        min: 0,
        id: "minipercent",
        height: "10%",
        top: "78%",
        lineWidth: 1,
        offset: 0,

    }, {
        title: {
            text: 'macroMerge %'
        },
        max: 100,
        min: 0,
        id: "macropercent",
        height: "10%",
        top: "90%",
        lineWidth: 1,
        offset: 0,
        opposite: true,
    }],
    plotOptions: {
        series: {
            //minPointLength: 10,
            groupPadding: 0.01,
            pointPadding: 0,
            borderWidth: 0.01,
            events: {
                legendItemClick: function(event) {
                    cSerie = this.chart.get(this.name + "_complete");
                    cSerie.setVisible(!this.visible, false);
                }
            }
        }
    }
})
