'use strict';

/**
 * @ngdoc service
 * @name f3monApp.config
 * @description
 * # config
 * Constant in the f3monApp.
 */
(function() {
    angular.module('f3monApp')
        .constant('config', {
            'defaultSubSystem': "cdaq",
            'fastPollingDelay': 3000,
            'slowPollingDelay': 5000,
            'chartWaitingMsg': 'No monitoring information.',
            'msChartMaxPoints': 10,
            'defaultTimezone': 'UTC',
        })

    //Template required by the dirpagination plugin
    .config(function(paginationTemplateProvider) {
        paginationTemplateProvider.setPath('views/dirPagination.tpl.html');
    })

//TimeZone settings
.constant('angularMomentConfig', {
    format: 'MMM D YYYY, HH:mm',
    //preprocess: 'UNIX',
    //timezone: 'Europe/London' // e.g. 'Europe/London'
})

    .service('colors', function() {
        var list = Highcharts.getOptions('colors').colors;
        var index = 0;

        this.get = function() {
            var i = index;
            if (index == (list.length - 1)) {
                index = 0
            } else {
                index += 1
            }
            return list[i];
        }

        this.reset = function() {
            index = 0;
        }
    })


    .constant('streamRatesChartConfig', {
        options: { //not handled by angular controller
            useHighStocks: true,
            exporting: {
                enabled: false
            },
            chart: {
                animation: {
                    duration: 500,
                    easing: 'linear'
                },
                //marginTop: 10,
                //spacingTop: 10,
                zoomType: 'x',
                events: {},
            },
            legend: {
                enabled: true,
                align: 'center',
                verticalAlign: 'bottom',
                //maxHeight: 50,
            },
            plotOptions: {
                series: {
                    animation: {
                        duration: 500,
                        easing: 'linear'
                    },
                },
                column: {
                    groupPadding: 0.01,
                    pointPadding: 0,
                    borderWidth: 0.01,
                    events: {
                        legendItemClick: function(event) {
                            var cSerie = this.chart.get(this.name + "_complete");
                            cSerie.setVisible(!this.visible, false);
                        },
                    }
                }
            },
            tooltip: {
                enabled: true,
                followPointer: false,
                //crosshairs: [true, true], //not visible with the grid
                //shared: true,
                //position on the left or right side of the point only with shared:false
                                positioner: function(labelWidth, labelHeight, point) {
                
                                    var tooltipX, tooltipY;
                                    if (point.plotX + labelWidth > this.chart.plotWidth) {
                                        tooltipX = point.plotX + this.chart.plotLeft - labelWidth - 20;
                                    } else {
                                        tooltipX = point.plotX + this.chart.plotLeft + 20;
                                    }
                                    tooltipY = point.plotY + this.chart.plotTop - 20;
                                    return {
                                        x: tooltipX,
                                        y: tooltipY
                                    };
                                }
            },

            navigator: {

                enabled: true,
                adaptToUpdatedData: false,
                series: {
                    type: 'area',
                    animation: {

                        duration: 500,
                    },
                    fillOpacity: 0.3,
                },
                height: 25,
                margin: 15,
                yAxis: {
                    tickPixelInterval: 5,
                    title: {
                        text: 'Totals'
                    },
                    labels: {
                        enabled: true,
                        formatter: function() {
                            //return numeral(this.value).format('0a')
                        }
                    },
                },
                xAxis: {
                    tickPixelInterval: 50,
                    title: {
                        text: ''
                    },
                    labels: {
                        formatter: function() {
                            //console.log(this.value)
                            return this.value;
                        },
                        style: {
                            color: "black",
                            //fontWeight: "bold"
                        },
                    },
                    events: {}
                }
            },
            rangeSelector: {
                enabled: false,
            },

            navigation: {
                enabled: true
            },
            scrollbar: {
                enabled: true,
                liveRedraw: false,
            },


        },
        //handled by angular controller
        chart: {
            zoomType: 'x',
        },
        title: {
            text: ''
        },
        xAxis: [{
            //            labels: {
            //                formatter: function() {
            //                    return this.value;
            //                },
            //            },
            minPadding: 0,
            maxPadding: 0,
            //             startOnTick: true,
            gridLineWidth: 1,
            id: "ls",
            allowDecimals: false,
            title: {
                text: 'Ls'
            },
            //            categories: [],
            //            type: "category",
            //            tickmarkPlacement: 'on',
            minRange: 20,
            //tickInterval: 1,
            events: {}
        }],
        yAxis: [{
            minPadding: 0,
            maxPadding: 0,
            title: {
                text: 'Events'
            },
            id: "rates",
            height: "74%",
            lineWidth: 1,
            offset: 0,
            //opposite: false,
        }, {
            minPadding: 0,
            maxPadding: 0,
            title: {
                text: 'Completeness %',
                align: 'middle',
                //margin: 30,
            },
            max: 100,
            min: 0,
            height: "74%",

            id: "percent",
            lineWidth: 1,
            offset: 0,
            opposite: true,
            labels: {
                //align: 'right',
            }
        }, {
            title: {
                text: 'miniMerge %',

            },
            max: 100,
            min: 0,
            id: "minipercent",
            height: "10%",
            top: "78%",
            lineWidth: 1,
            offset: 0,
            //opposite: false,
        }, {
            title: {
                text: 'macroMerge %',
                align: 'middle',
                //margin: 30,
            },
            max: 100,
            min: 0,
            id: "macropercent",
            height: "10%",
            top: "90%",
            lineWidth: 1,
            offset: 0,
            opposite: true,
            labels: {
                //align: 'right'
            }
        }],
        series: [],
    })

    .constant('drillDownChartConfig', {
        options: { //not handled by angular controller
            chart: {
                animation: {
                    duration: 500,
                    easing: 'linear'
                },
                marginRight: 50,
                events: {
                    drilldown: function(event) {
                        //console.log('old dd2')
                    },
                    drillup: function(event) {
                        //console.log('old du2')
                    }
                } //placeholder for drilldown function
            },
            plotOptions: {
                series: {
                    minPointLength: 3
                }
            },
            tooltip: {
                //enabled: false,
                followPointer: true
            },
            legend: {
                enabled: false
            }
        },
        //handled by angular controller
        title: {
            text: ''
        },
        xAxis: [{
            lineWidth: 0,
            gridLineWidth: 1,
            allowDecimals: false,
            title: {
                text: ''
            },
            tickmarkPlacement: 'on',
            type: "category"
        }],
        yAxis: [{
            title: {
                text: 'Completeness %'
            },
            max: 100,
            min: 0,
            //opposite : true,
            id: "percent",
            lineWidth: 1,
            offset: 0
        }],
        series: [{
            type: 'column',
            id: "drilldown",
            name: "drilldown",
            yAxis: "percent",
            cursor: 'pointer',
            minPointLength: 10,
        }],
        drilldown: {
            series: []
        }
    })


    .constant('microStatesChartConfig',

        {
            options: {
                useHighStocks: true,
                chart: {
                    animation: true, //animation for stacked area is not supported
                    ignoreHiddenSeries: true,
                    //height: 400,
                    zoomType: 'xy',
                },
                plotOptions: {
                    area: {
                        gapsize: 1,
                        stacking: 'percent',
                        connectNulls: false,
                        lineWidth: 0,
                        marker: {
                            enabled: false,
                            states: {
                                hover: {
                                    enabled: false,
                                }
                            }
                        }
                    },
                    areaspline: {
                        stacking: 'percent',
                        //pointPadding: 0,
                        //groupPadding: 0,
                        //fillOpacity: 0.5,
                        //connectNulls: true,
                        //lineColor: '#ffffff',
                        lineWidth: 0,
                        //gapSize: 2,
                        //marker: {
                        //    enabled: false
                        //}
                    },
                    column: {
                        stacking: 'percent',
                        pointPadding: 0,
                        groupPadding: 0,
                        borderWidth: 0,
                        //fillOpacity: 0.5,
                        //connectNulls: false,
                        //lineColor: '#ffffff',
                        //lineWidth: 0,
                        //marker: {
                        //    enabled : false
                        //}
                    }
                },
                //colors: Colors.colorList(),
                legend: {
                    layout: "vertical",
                    align: "right",
                    verticalAlign: 'top',
                    //floating: true,
                    borderRadius: 5,
                    borderWidth: 1,
                    itemDistance: 5,
                    symbolRadius: 5
                },
                xAxis: {
                    minPadding: 0,
                    maxPadding: 0,
                    category: true,
                    type: 'datetime',
                    tickmarkPlacement: 'on',
                    //title: {
                    //    enabled: false
                    //}
                },
            },
            //handled by angular
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            yAxis: {
                title: {
                    text: 'Percent'
                }
            },
            series: [],
        })


})();
