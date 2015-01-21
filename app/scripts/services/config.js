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
            'chartWaitingMsg': 'No monitoring information.'
        })

    //Required by the dirpagination plugin
    .config(function(paginationTemplateProvider) {
        paginationTemplateProvider.setPath('views/dirPagination.tpl.html');
    })

    .factory('colors', function() {
        var colors = {};
        colors.list = Highcharts.getOptions(colors).colors;
        colors.index = 0;

        colors.get = function() {
            var i = this.index;
            if (this.index == (this.list.length - 1)) {
                this.index = 0
            } else {
                this.index += 1
            }
            return this.list[i];
        }

        return colors;
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
                marginTop: 10,
                spacingTop: 10,
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
                    title: {
                        text: 'Totals'
                    },
                    labels: {
                        enabled: true,
                        formatter: function() {
                            return numeral(this.value).format('0a')
                        }
                    },
                },
                xAxis: {
                    tickPixelInterval: 100,
                    title: {
                        text: 'Ls'
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
                    events: {
                        setExtremes: function(event) {
                            //console.log('nav set')


                        },
                        afterSetExtremes: function(event) {
                            //console.log('nav after')

                        }
                    }
                }
            },
            rangeSelector: {
                enabled: false,
                allButtonsEnabled: true,

                buttons: [{
                    type: 'all',
                    text: 'All'
                }],
                buttonTheme: {
                    width: 50
                },
                inputDateFormat: '%H:%M:%S.%L',
                inputEditDateFormat: '%H:%M:%S.%L',
                // Custom parser to parse the %H:%M:%S.%L format
                inputDateParser: function(value) {
                    value = value.split(/[:\.]/);
                    return Date.UTC(
                        1970,
                        0,
                        1,
                        parseInt(value[0], 10),
                        parseInt(value[1], 10),
                        parseInt(value[2], 10),
                        parseInt(value[3], 10)
                    );
                }

            },

            navigation: {
                enabled: false
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
            labels: {
                formatter: function() {
                    //console.log(this.value)
                    return this.value;
                },
            },
            gridLineWidth: 1,
            id: "ls",
            allowDecimals: false,
            title: {
                text: ''
            },
            //categories: true,
            //type: "category",
            tickmarkPlacement: 'on',
            minRange: 19,
            tickInterval: 1,
            events: {
                //                setExtremes: function(event) {
                //                    console.log('main set')
                //                    console.log(event.min)
                //                    console.log(event.max)
                //                    
                //                },
                //                afterSetExtremes: function(event) {
                //                    console.log('main after')
                //                    
                //                }
            }
        }],
        yAxis: [{
            title: {
                text: 'Events'
            },
            id: "rates",
            height: "74%",
            lineWidth: 1,
            offset: 0,
            //opposite: false,
        }, {
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
        series: [{
            showInLegend: false,
            visible: false,
            name: 'navigator',
            //type:area,
            //id:'navigator',
        }, {
            borderWidth: 0.5,
            type: 'column',
            id: "minimerge",
            name: "minimerge",
            yAxis: "minipercent",
            showInLegend: false,
            cursor: "pointer",
            minPointLength: 5,
        }, {
            borderWidth: 0.5,
            type: 'column',
            id: "macromerge",
            name: "macromerge",
            yAxis: "macropercent",
            showInLegend: false,
            cursor: "pointer",
            minPointLength: 5,
        }, ],
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


})();
