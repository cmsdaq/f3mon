'use strict';

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
        var service = drillDownService;
        var queryParams = drillDownService.queryParams;
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
            queryParams.type = type;
            queryParams.from = x;
            queryParams.to = x + interval - 1;
            service.start();
            $scope.selectPanel(2);
        }
        $scope.disableDrillDown = function() {
            $scope.status.showDrillDown = false;
        }
        $scope.panelSelected = function(num) {
            return $scope.status.currentPanel === num;
        }

        $scope.selectPanel = function(num) {
            $scope.status.currentPanel = num;
        }

        $scope.$on('global.reset', function(event) {
            $scope.selectPanel(1);
        })

    })

    //this controller is really fragile, be careful if u need to change
    .controller('drillDownCtrl', function($scope, drillDownChartConfig, drillDownService, secondDrillDownService) {
        var chart;
        var chartConfig;
        $scope.queryParams = drillDownService.queryParams;

        var dd2Event,ddserie,dd2serie;

        var setEvents = function(){
           
            chartConfig.chart.events.drilldown = function(event) {
                secondDrillDown(event)
            }
            chartConfig.chart.events.drillup = function(event) {
                secondDrillUp(event)
            }    
        };

        var initChart = function(){
            chartConfig = jQuery.extend({}, drillDownChartConfig);
            setEvents();
            chart = new Highcharts.Chart(chartConfig);
        };

        initChart();

        var secondDrillDown = function(event) {
            dd2Event = event;
            $scope.queryParams.stream = event.point.name;
            drillDownService.stop();
            secondDrillDownService.start();

        }

        var secondDrillUp = function(event) {
            if (event) {
                event.preventDefault()
            }
            dd2serie = false;
            $scope.queryParams.stream = false;
            secondDrillDownService.stop();
            drillDownService.start();
            if (chart.drilldownLevels && chart.drilldownLevels.length > 0) {
                chart.drillUp();
            }
        }

        $scope.exitDD = function() {
            drillDownService.stop();
            secondDrillDownService.stop();
            secondDrillUp();
            $scope.$parent.selectPanel(1);
        }

        $scope.$on('ddChart.updated', function(event) {
            ddserie = chart.series[0];
            ddserie.update({
                data: drillDownService.data
            });
        })

        $scope.$on('dd2Chart.updated', function(event) {
            if (!dd2serie) {
                var newSerie = {
                    type: 'column',
                    id: "drilldown2",
                    name: "drilldown2",
                    yAxis: "percent",
                    data: secondDrillDownService.data,
                }
                chart.addSeriesAsDrilldown(dd2Event.point, newSerie)
                dd2serie = chart.series[0];
            } else {dd2serie.update({
                data: secondDrillDownService.data,
            })}
        })
    })

    .controller('streamRatesCtrl', function($scope, configService, runInfoService, streamRatesChartConfig, angularMomentConfig, streamRatesService, colors) {
        var config;

        $scope.$on('config.set', function(event) {
            config = configService.config;
            initChart();
        });


        $scope.paramsChanged = streamRatesService.paramsChanged;
        $scope.queryParams = streamRatesService.queryParams;
        $scope.queryInfo = streamRatesService.queryInfo;

        $scope.streams = {};


        var data = streamRatesService.data;
        var runInfoData = runInfoService.data;
        var chart = false;
        var microSerie, miniSerie, macroSerie, streams, chartConfig;
        var isDirty = true;
        var axisSet = false;

        var currentRangeMode="stream";

        $scope.updateMaskedStreams = function(maskedStreamList) {
          runInfoService.updateMaskedStreams(maskedStreamList);
        }

        $scope.unitChanged = function() {
            var axisTitle = $scope.unit;
            if ($scope.queryParams.useDivisor && axisTitle!=="Bytes / Event") {
                axisTitle += '/s'
            }
            $scope.paramsChanged();
            //streamRatesChartConfig.yAxis[0].title.text = axisTitle; //waiting for fix https://github.com/pablojim/highcharts-ng/issues/247
            chart.yAxis[0].update({
                title: {
                    text: axisTitle
                }
            }, false);
        }

        $scope.selectorModeChanged = function() {
            currentRangeMode=$scope.selectorMode;
        }

        var setEvents = function() {
            //setExtremes
            chartConfig.xAxis[0].events.afterSetExtremes = function(event) {
                return;
                //event.preventDefault();
            };
            chartConfig.xAxis[0].events.setExtremes = function(event) {
                event.preventDefault();
                var min = Math.round(event.min);
                var max = Math.round(event.max);
                selectionRules(min, max)

            };

            //zoom selection
            chartConfig.chart.events.selection = function(event) {
                event.preventDefault();


                var min = Math.round(event.xAxis[0].min);
                var max = Math.round(event.xAxis[0].max);
                var range = max - min;

                if (currentRangeMode==="stream") {

                  if (range < 20) {
                    min = min - Math.round((20 - range) / 2);
                    max = max + Math.round((20 - range) / 2);
                  }

                  selectionRules(min, max);
                }
                else if (currentRangeMode==="micro") {
                   $scope.$parent.enableDrillDown('micromerge', min, range);
                }
                else if (currentRangeMode==="mini") {
                   $scope.$parent.enableDrillDown('minimerge', min, range);
                }
                else if (currentRangeMode==="macro") {
                   $scope.$parent.enableDrillDown('macromerge', min, range);
                }
            }

            //minimacro background clicks
            chartConfig.chart.events.click = function(event) {
                //var xRawValue = Math.round(Math.abs(event.xAxis[0].value)); 
                //var xRealValue = data.lsList[xRawValue - 1]; 
                var xRealValue = Math.round(Math.abs(event.xAxis[0].value));

                var y1RawValue = Math.ceil(event.yAxis[1].value);
                var y2RawValue = Math.ceil(event.yAxis[2].value);
                var y3RawValue = Math.ceil(event.yAxis[3].value);

                if (y3RawValue < 100) {
                    $scope.$parent.enableDrillDown('macromerge', xRealValue, data.interval)
                } else if (y2RawValue < 100) {
                    $scope.$parent.enableDrillDown('minimerge', xRealValue, data.interval)
                } else if (y1RawValue < 100) {
                    $scope.$parent.enableDrillDown('micromerge', xRealValue, data.interval)
                }
            }
        }

        var selectionRules = function(min, max) {

            streamRatesService.stop();
            var lastLs = runInfoService.data.lastLs;
            if (min === 0) {
                min = 1
            }
            if (max === lastLs) {
                $scope.queryInfo.isToSelected = false;
                if ((max - min) < 0) { 
                    console.log('warning: min>max! ' + max  + ' ' + min);
                    //$scope.queryInfo.isFromSelected = false;
                }
                if ((max - min) <= 20) {
                    $scope.queryInfo.isFromSelected = false;
                } else {
                    $scope.queryInfo.isFromSelected = true
                }
            } else {
                if (lastLs>21) {
                  //only allow range selection if ls count exceeds 21 (initial range)
                  $scope.queryInfo.isFromSelected = true;
                  $scope.queryInfo.isToSelected = true;
                }
                else {
                  $scope.queryInfo.isFromSelected = false;
                  $scope.queryInfo.isFromSelected = false;
                }
            }
            $scope.queryParams.from = min;
            $scope.queryParams.to = max;
            $scope.paramsChanged();
        }



        var initChart = function() {
            $scope.unit = config.streamRatesUnit;
            $scope.selectorMode = "stream"; //todo:use config param
            colors.reset();
            if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfig.chart.renderTo).empty().unbind();
                chartConfig = false;
                
            };

            microSerie = false;
            miniSerie = false;
            macroSerie = false;

            chartConfig = jQuery.extend({}, streamRatesChartConfig);
            setEvents();
            chart = new Highcharts.StockChart(chartConfig);
            chart.showLoading(config.chartWaitingMsg);

            axisSet=false;
            //var nav = chart.get('navigator');

            //set masked stream callback
            chart.setMaskedStreams = function(maskedStreamList) {
              $scope.updateMaskedStreams(maskedStreamList);

              data.micromerge.percents.forEach(function(s){
                s.color="darkgreen"
              })
              data.minimerge.percents.forEach(function(s){
                s.color="darkgreen"
              })
              data.macromerge.percents.forEach(function(s){
                s.color="darkgreen"
              })
              microSerie.setData(data.micromerge.percents, false, false);
              miniSerie.setData(data.minimerge.percents, false, false);
              macroSerie.setData(data.macromerge.percents, false, false);
              chart.redraw();
            }

            //add function to chart to communicate with stream config
            chart.getTimezoneCustom = function() {
              return angularMomentConfig.timezone;
            }
        
            streams = {};
            isDirty = false;
            $scope.unitChanged();
            
        }

        //is possible to set the series in the config.js but then the chart render with grind and empty values at beginning
        var startChart = function() {

            chart.addSeries({
                showInLegend: false,
                visible: true,
                name: 'navigator',
                //type:area,
                //id:'navigator',
            });

            chart.addSeries({
                borderWidth: 0.5,
                type: 'column',
                id: "micromerge",
                name: "micromerge",
                yAxis: "micropercent",
                showInLegend: false,
                cursor: "pointer",
                //minPointLength: 5,
                point: {
                    events: {
                        click: function(event) {
                            $scope.$parent.enableDrillDown(event.currentTarget.series.name, event.currentTarget.category, data.interval)
                        }
                    }
                }
            })

            chart.addSeries({
                borderWidth: 0.5,
                type: 'column',
                id: "minimerge",
                name: "minimerge",
                yAxis: "minipercent",
                showInLegend: false,
                cursor: "pointer",
                //minPointLength: 5,
                point: {
                    events: {
                        click: function(event) {
                            $scope.$parent.enableDrillDown(event.currentTarget.series.name, event.currentTarget.category, data.interval)
                        }
                    }
                }
            })
            chart.addSeries({
                borderWidth: 0.5,
                type: 'column',
                id: "macromerge",
                name: "macromerge",
                yAxis: "macropercent",
                showInLegend: false,
                cursor: "pointer",
                //minPointLength: 5,
                point: {
                    events: {
                        click: function() {
                            $scope.$parent.enableDrillDown(this.series.name, this.x, data.interval)
                        }
                    }
                }
            })

            microSerie = chart.get('micromerge');
            miniSerie = chart.get('minimerge');
            macroSerie = chart.get('macromerge');
                        
            chart.hideLoading();
            isDirty = true;
        }

        $scope.$on('runInfo.selected', function(event) {            
            if (isDirty) {
                initChart();
            };
        })

        $scope.$on('srChart.updated', function(event) {

            if (!axisSet) {
              var lastLS = runInfoService.data.lastLs;
              if (lastLS>0) {
                chart.xAxis[0].setExtremes(lastLS>20 ? lastLS-20 : 1,lastLS>20?lastLS:21);
                axisSet=true;
              }
            }
            //stop chart if no stream label information is available
            if (runInfoData.streams.length===0) {
                if (isDirty) stopChart();
                return;
            }
 
            if (!isDirty) {
                startChart();
            }
           
            data.streams.data.forEach(function(item) {
                    //var out = $scope.unit == 'Events' ? item.dataOut : item.fileSize;
                    var out = $scope.unit == 'Events' ? item.dataOut : $scope.unit == 'Bytes' ? item.fileSize : item.sizePerEvt;
                    //add new series if doesnt exists
                    if ($.inArray(item.stream, Object.keys(streams)) == -1) {
                        var newcolor = colors.get();
                        var newSerie = {
                            type: 'column',
                            id: item.stream,
                            name: item.stream,
                            yAxis: "rates",
                            color: newcolor,
                            data: out,
                        }
                        chart.addSeries(newSerie, false, false);
                        streams[item.stream] = chart.get(item.stream);

                    } else { //update series if exists
                        streams[item.stream].setData(out, false, false);
                    }
                })
                //DO NOT CHANGE THE UPDATE ORDER
            chart.xAxis[0].update({
                tickPositions: data.lsList
            }, false, false);
            //always show event count in navbar (not file count)
            //var out = $scope.unit == 'Events' ? data.navbar.events : data.navbar.files;
            var out = data.navbar.events;

            var navSerie = chart.series[1];
            navSerie.setData(out, false, false);

            microSerie.setData(data.micromerge.percents, false, false);
            miniSerie.setData(data.minimerge.percents, false, false);
            macroSerie.setData(data.macromerge.percents, false, false);

            chart.redraw();

        });

        //initChart();
    })

    .controller('microStatesCtrl', function($scope, configService, moment, amMoment, microStatesService, microStatesChartConfig) {
        var config;
        
        $scope.$on('config.set', function(event) {
            config = configService.config;
            initChart();
        });



        var chart;
        var isDirty = true;
        var chartConfig;

        var initChart = function(){
          if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfig.chart.renderTo).empty().unbind();
            };

            chartConfig = jQuery.extend({}, microStatesChartConfig);
            chart = new Highcharts.Chart(chartConfig);
            chart.showLoading(config.chartWaitingMsg);
            isDirty = false;
        }

        $scope.$on('runInfo.selected', function(event) {
            microStatesService.stop();
            if(isDirty){initChart()};
        })

        $scope.$on('msChart.updated', function(event) {
            //var series = $scope.chartConfig.series;
            var data = microStatesService.data;
            var timeList = microStatesService.queryInfo.timeList;

            //console.log(timeList)
            //$scope.chartConfig.options.xAxis.categories = timeList;
            //$scope.chartConfig.getHighcharts().xAxis[0].setCategories(timeList,false)

            Object.keys(data).forEach(function(state) {

                var stateData = data[state];

                var serie = chart.get(state);
                if (!serie) {
                    chart.addSeries({
                        type: 'area',
                        id: state,
                        name: state,
                        data: stateData,
                    },false,false);
                } else {
                    serie.setData(stateData,false,false);
                };
            })
            chart.redraw();
            //chart.hideLoading();
            if(!isDirty){isDirty = true;chart.hideLoading();}
        })

    })


    .controller('logsCtrl', function($scope, logsService) {
        var service = logsService;

        $scope.queryParams = logsService.queryParams;
        $scope.data = logsService.data;
        $scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;

    })


})();
