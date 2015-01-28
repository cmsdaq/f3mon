'use strict';

Object.size = function(obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/**
 * @ngdoc overview
 * @name f3monCentral
 * @description
 * # f3monHeader
 *
 * Module handling the header navbar.
 */

(function() {
    angular.module('f3monApp')

    .directive('f3monCentral', function() {
        return {
            restrict: 'E',
            templateUrl: 'views/f3mon-central.html'
        };
    })

    .controller('mainViewCtrl', function($scope, drillDownService, globalService) {
        $scope.service = drillDownService;
        $scope.queryParams = drillDownService.queryParams;
        $scope.globalStatus = globalService.status;
        $scope.status = {
            showDrillDown: false,
            currentPanel: 1
        }

        $scope.selectTour = function(id) {
            if (!tourConfig.tour.__inited) {
                tourConfig.tour.init()
            }

            var id = "#" + id;
            var steps = tourConfig.tour._options.steps;
            var i = steps.map(function(e) {
                return e.element;
            }).indexOf(id);
            tourConfig.tour.restart();
            tourConfig.tour.goTo(i);
        }

        $scope.enableDrillDown = function(type, x, interval) {
            $scope.status.showDrillDown = true;
            $scope.queryParams.type = type;
            $scope.queryParams.from = x;
            $scope.queryParams.to = x + interval - 1;
            $scope.service.start();
            $scope.selectPanel(2);
        }
        $scope.disableDrillDown = function() {
            $scope.status.showDrillDown = false;
        }
        $scope.panelSelected = function(num) {
            return $scope.status.currentPanel == num;
        }

        $scope.selectPanel = function(num) {
            $scope.status.currentPanel = num;
        }

        $scope.$on('runInfo.selected', function(event) {})

    })

    //this controller is really fragile, be careful if u need to change
    .controller('drillDownCtrl', function($scope, drillDownChartConfig, drillDownService, secondDrillDownService) {
        drillDownChartConfig.options.chart.events.drilldown = function(event) {
            secondDrillDown(event)
        }
        drillDownChartConfig.options.chart.events.drillup = function(event) {
            secondDrillUp(event)
        }
        $scope.chartConfig = drillDownChartConfig;
        $scope.serie = $scope.chartConfig.series[0];
        var ddserie, dd2serie = false,
            dd2Event

        $scope.queryParams = drillDownService.queryParams;


        var secondDrillUp = function(event) {
            if (event) {
                event.preventDefault()
            };
            dd2serie = false;
            $scope.queryParams.stream = false;
            secondDrillDownService.stop();
            drillDownService.start();
            var chart = $scope.chartConfig.getHighcharts();
            if (chart.drilldownLevels && chart.drilldownLevels.length > 0) {
                chart.drillUp();
            }
        }

        var secondDrillDown = function(event) {
            dd2Event = event;
            $scope.queryParams.stream = event.point.name;
            drillDownService.stop();
            secondDrillDownService.start();

        }

        $scope.exitDD = function() {
            drillDownService.stop();
            secondDrillDownService.stop();
            secondDrillUp();
            $scope.$parent.selectPanel(1);
        }

        $scope.$on('ddChart.updated', function(event) {
            ddserie = $scope.chartConfig.getHighcharts().series[0]
            ddserie.update({
                data: drillDownService.data
            });
        })

        $scope.$on('dd2Chart.updated', function(event) {
            var chart = $scope.chartConfig.getHighcharts();
            if (!dd2serie) {
                var newSerie = {
                    type: 'column',
                    id: "drilldown2",
                    name: "drilldown2",
                    yAxis: "percent",
                    data: secondDrillDownService.data,
                }
                $scope.chartConfig.getHighcharts().addSeriesAsDrilldown(dd2Event.point, newSerie)
                dd2serie = chart.series[0];
            } else dd2serie.update({
                data: secondDrillDownService.data,
            })
        })

    })

    .controller('streamRatesCtrl', function($scope, config, runInfoService, streamRatesChartConfig, streamRatesService, colors) {
        $scope.service = streamRatesService;
        $scope.queryParams = streamRatesService.queryParams;
        $scope.queryInfo = streamRatesService.queryInfo;
        $scope.chartConfig = streamRatesChartConfig;
        $scope.chartConfig.loading = config.chartWaitingMsg;
        
        var chart = false;

        var selectionRules = function(min, max) {
            streamRatesService.stop();
            var lastLs = runInfoService.data.lastLs;
            if (min == 0) {
                min = 1
            }
            if (max == lastLs) {
                $scope.queryInfo.isToSelected = false;
                if ((max - min) < 20) {
                    $scope.queryInfo.isFromSelected = false;
                } else {
                    $scope.queryInfo.isFromSelected = true
                }
            } else {
                $scope.queryInfo.isFromSelected = true;
                $scope.queryInfo.isToSelected = true;
            }
            $scope.queryParams.from = min;
            $scope.queryParams.to = max;
            $scope.service.paramsChanged();
        }


        //setExtremes
        $scope.chartConfig.xAxis[0].events.setExtremes = function(event) {
            event.preventDefault();
            var min = Math.round(event.min);
            var max = Math.round(event.max);
            selectionRules(min, max)
        };

        //zoom selection
        $scope.chartConfig.options.chart.events.selection = function(event) {
            event.preventDefault();

            var min = Math.round(event.xAxis[0].min);
            var max = Math.round(event.xAxis[0].max);
            var range = max - min;

            if (range < 20) {
                min = min - Math.round((20 - range) / 2)
                max = max + Math.round((20 - range) / 2)
            }

            selectionRules(min, max)
        }

        //minimacro background clicks
        $scope.chartConfig.options.chart.events.click = function(event) {
            //var xRawValue = Math.round(Math.abs(event.xAxis[0].value)); 
            //var xRealValue = data.lsList[xRawValue - 1]; 
            var xRealValue = Math.round(Math.abs(event.xAxis[0].value));

            var y2RawValue = Math.ceil(event.yAxis[2].value);
            var y3RawValue = Math.ceil(event.yAxis[3].value);

            if (y3RawValue < 100) {
                $scope.$parent.enableDrillDown('macromerge', xRealValue, data.interval)
            } else if (y2RawValue < 100) {
                $scope.$parent.enableDrillDown('minimerge', xRealValue, data.interval)
            }
        }

        //$scope.miniSerie = $scope.chartConfig.series[1];
        //$scope.macroSerie = $scope.chartConfig.series[2];

        $scope.miniSerie = false;
        $scope.macroSerie = false;

        $scope.streams = {};
        $scope.unit = 'e';




        $scope.unitChanged = function() {
            var axisTitle = $scope.unit == 'e' ? 'Events' : 'Bytes';
            if ($scope.queryParams.useDivisor) {
                axisTitle += '/s'
            }
            $scope.service.paramsChanged();
            //streamRatesChartConfig.yAxis[0].title.text = axisTitle; //waiting for fix https://github.com/pablojim/highcharts-ng/issues/247
            streamRatesChartConfig.getHighcharts().yAxis[0].update({
                title: {
                    text: axisTitle
                }
            }, false);
        }

        //is possible to set the series in the config.js but then the chart render with grind and empty values at beginning
        var initChart = function() {
            $scope.chartConfig.series.push({
                showInLegend: false,
                visible: true,
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
            })

            //console.log($scope.chartConfig.series);

            $scope.miniSerie = $scope.chartConfig.series[1];
            $scope.macroSerie = $scope.chartConfig.series[2];

            //link first drilldown on points click
            $scope.miniSerie.point = {
                events: {
                    click: function(event) {
                        $scope.$parent.enableDrillDown(event.currentTarget.series.name, event.currentTarget.category, data.interval)
                    }
                }
            };
            //link first drilldown on points click
            $scope.macroSerie.point = {
                events: {
                    click: function() {
                        $scope.$parent.enableDrillDown(this.series.name, this.x, data.interval)
                    }
                }
            };

            $scope.$apply(); //this cause an error ant the beginning .. is not important but i dont know how to fix for now

        }

        $scope.$on('srChart.updated', function(event) {
            var data = streamRatesService.data;
            console.log(data.lsList,data.lsList.length)
            if (!$scope.miniSerie) {
                initChart();
            }
            
            

            if (!chart) {
                chart = $scope.chartConfig.getHighcharts();
            }
            
            //axis label update
            chart.xAxis[0].update({
                tickPositions: data.lsList
            }, true);

            var out = $scope.unit == 'e' ? data.navbar.events : data.navbar.files;

            //navigator update
            var navSerie = _.findWhere(chart.series,{name:'Navigator'});
            navSerie.setData(out);

            $scope.miniSerie.data = data.minimerge.percents;
            $scope.macroSerie.data = data.macromerge.percents;

            data.streams.data.forEach(function(item) {
                var out = $scope.unit == 'e' ? item.dataOut : item.fileSize;
                //add new series if doesnt exists
                if ($.inArray(item.stream, Object.keys($scope.streams)) == -1) {
                    var newcolor = colors.get();
                    var newSerie = {
                        type: 'column',
                        id: item.stream,
                        name: item.stream,
                        yAxis: "rates",
                        color: newcolor,
                        data: out,
                    }
                    $scope.chartConfig.series.push(newSerie);
                    $scope.streams[item.stream] = $scope.chartConfig.series[$scope.chartConfig.series.length - 1];
                    var serieName = item.stream + '_complete';
                    newSerie = {
                        type: 'spline',
                        id: serieName,
                        name: serieName,
                        yAxis: "percent",
                        color: newcolor,
                        data: item.percent,
                        showInLegend: false,
                    }
                    $scope.chartConfig.series.push(newSerie);
                    $scope.streams[serieName] = $scope.chartConfig.series[$scope.chartConfig.series.length - 1];
                } else { //update series if exists
                    $scope.streams[item.stream].data = out;
                    $scope.streams[item.stream + '_complete'].data = item.percent;
                }
            })

            if ($scope.chartConfig.loading) {
                $scope.chartConfig.loading = false
            }

        });

        $scope.$on('runInfo.selected', function(event) {
            //GENERAL RESET!!
            if($scope.miniSerie){
                streamRatesService.stop();
                $scope.chartConfig.loading = config.chartWaitingMsg;
                $scope.chartConfig.series.splice(0, $scope.chartConfig.series.length);
                $scope.streams = {};
                $scope.miniSerie = false;
                $scope.macroSerie = false;
                var chart = $scope.chartConfig.getHighcharts();
                chart.series[3].setData([]);
                colors.reset();    
            }
            
        })

    })

    .controller('microStatesCtrl', function($scope, config, moment, amMoment, microStatesService, microStatesChartConfig) {
        var states = {};

        $scope.chartConfig = microStatesChartConfig;
        $scope.chartConfig.loading = config.chartWaitingMsg;

        $scope.$on('msChart.updated', function(event) {
            return
            var maxPoint = config.msChartMaxPoints;
            var service = microStatesService;
            var timestamp = Math.round(service.queryInfo.timestamp);

            Object.keys(service.data).forEach(function(state) {
                var stateValue = service.data[state];
                if ($.inArray(state, Object.keys(states)) == -1) {
                    $scope.chartConfig.series.push({
                        type: 'area',
                        id: state,
                        name: state,
                        data: [
                            [timestamp, stateValue]
                        ],
                    });
                    states[state] = $scope.chartConfig.series[$scope.chartConfig.series.length - 1];
                } else {
                    if (states[state].data.length > maxPoint) {
                        states[state].data.shift()
                    }
                    states[state].data.push([timestamp, stateValue]);
                }

            })


            if ($scope.chartConfig.loading) {
                $scope.chartConfig.loading = false
            }
            //var serie = $scope.chartConfig.getHighcharts().series[0].data.length;

        })
        $scope.$on('runInfo.selected', function(event) {
            microStatesService.stop();
            $scope.chartConfig.loading = config.chartWaitingMsg;
            $scope.chartConfig.series.splice(0, $scope.chartConfig.series.length);
            states = {};

        })

    })


    .controller('logsCtrl', function($scope, logsService) {

        $scope.queryParams = logsService.queryParams;
        $scope.service = logsService;
        $scope.data = logsService.data;




    })


})();
