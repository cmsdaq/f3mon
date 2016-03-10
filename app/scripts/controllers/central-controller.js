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

    .controller('mainViewCtrl', function($scope, $rootScope, $window, drillDownService, globalService) {

        $scope.paddingDefault='0';
	$scope.classDefault='col-md-9';
        var setPadding=function() {
          if ($window.innerWidth<992) {
	      //console.log('set padding-right:0')
              $scope.style='padding-left: 0px;padding-right: 0px'
          }
          else {
               $scope.style='padding-left: 6px'
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);
 
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
            service.stop();
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
            if (num===1) $scope.disableDrillDown();
            $scope.status.currentPanel = num;
        }

        $scope.$on('global.reset', function(event) {
            $scope.selectPanel(1);
        })

    })

    //this controller is really fragile, be careful if u need to change
    .controller('drillDownCtrl', function($rootScope, $scope, $window, drillDownChartConfig, drillDownService, secondDrillDownService) {
        var chart;
        var chartConfig;

        $scope.hpxdd=600;
        var setPadding=function() {
          if ($window.innerWidth<992) {
            $scope.hpxdd=450;
          }
          else {
            $scope.hpxdd=600;
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        $scope.queryParams = drillDownService.queryParams;

        var dd2Event,ddserie,dd2serie;
        var isSecondLevel=false;

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

        var destroyChart = function() {
            if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfig.chart.renderTo).empty().unbind();
            }
        }

        var secondDrillDown = function(event) {
            dd2Event = event;
            if ($scope.queryParams.type === 'macromerge')
              $scope.queryParams.stream = false;
            else
              $scope.queryParams.stream = event.point.name;
            drillDownService.stop();
            secondDrillDownService.start();
            isSecondLevel = true;

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
            if (isSecondLevel) {
              dd2serie = false;
              $scope.queryParams.stream = false;
              destroyChart();
              isSecondLevel=false;
            }
            //secondDrillUp();
            $scope.$parent.selectPanel(1);
        }

        $scope.$on('global.reset', function(event) {
            $scope.exitDD()
            destroyChart();
        });

        $scope.$on('ddChart.updated', function(event) {
            if (!chart) initChart();
            chart.xAxis[0].update({labels:{rotation:0}});
            ddserie = chart.series[0];
            ddserie.update({
                data: drillDownService.data
            });
        })

        $scope.$on('dd2Chart.updated', function(event) {
            if (!chart) initChart();
            chart.xAxis[0].update({labels:{rotation:-60}});
            //chart.reflow();
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

    .controller('streamRatesCtrl', function($scope, $rootScope, $window, configService, runInfoService, streamRatesChartConfig,
                                            angularMomentConfig, streamRatesService, microStatesService, colors)
    {
        $scope.isCollapsed = false;
        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) {
            //schedule this immediately after setting visible
            if (chart) setTimeout(function(){ 
              if (chart) initChart(false);
              streamRatesService.resume()
            }, 1);
            else streamRatesService.resume();
          }
          else streamRatesService.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        var config;

        $scope.$on('config.set', function(event) {
            config = configService.config;
            initChart(true);
        });

        $scope.simplifiedView=false;

        var calcView=function() {
          if ($scope.simplifiedView) {
            configService.nbins=8
            streamRatesService.intervalNum=8
            $scope.tooltip = false;
            $scope.displayAux=false;
            $scope.hpx=450;
          } else {
            configService.nbins=25
            streamRatesService.intervalNum=25
            $scope.tooltip = true;
            $scope.displayAux=true;
            $scope.hpx=600;
          }
        }

        var setPadding=function() {
          //console.log($window.innerWidth);
          if ($window.innerWidth<992) {
              if (!$scope.simplifiedView) {
                $scope.simplifiedView=true;
                calcView()
                if (chart) {initChart(false);streamRatesService.pause();streamRatesService.resume();updateChart();}
              }
          }
          else {
              if ($scope.simplifiedView) {
                $scope.simplifiedView=false;
                calcView()
                if (chart) {initChart(false);streamRatesService.pause();streamRatesService.resume();updateChart();}
              }
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        calcView();

        $scope.paramsChanged = streamRatesService.paramsChanged;
        $scope.queryParams = streamRatesService.queryParams;
        $scope.queryInfo = streamRatesService.queryInfo;

        $scope.showInputRate = false;
        var lastRateText = "Built Events";

        $scope.toggleInputRate = function() {
          if (chart) {
            //$scope.showInputRate = !$scope.showInputRate;
            if (inputSerie) {
              inputSerie.setVisible($scope.showInputRate, false)
              chart.yAxis[4].update({
                title: {
                  text: $scope.showInputRate ? lastRateText : ""
                }
              }, false);

              chart.redraw();
            }
          }
        }

        $scope.streams = {};


        var data = streamRatesService.data;
        var runInfoData = runInfoService.data;
        var chart = false;
        var microSerie, miniSerie, macroSerie, streams, chartConfig;
        var isDirty = true;
        var axisSet = false;

        var currentRangeMode = "stream";

        $scope.selectorMode = currentRangeMode;
        $scope.selectorModes = ["stream","micro","mini","macro"]

        $scope.stackedDisabled = true;
        var lastStackedState = false;
        $scope.isStacked=false;

        $scope.divisorDisabled = false;
        $scope.useDivisor = true;

        $scope.accumDisabled = false;
        $scope.useAccum = false;

        $scope.logAxis=false;
        var axisType="linear";

        $scope.toggleAxis = function() {
          $scope.unitChanged();
          initChart(false);
        }

        $scope.updateMaskedStreams = function(maskedStreamList) {
          runInfoService.updateMaskedStreams(maskedStreamList);
        }

        $scope.tooltipToggle = function() {
          runInfoService.updateMaskedStreams([]);
          lastStackedState=false;
          initChart(false);
          console.log('tooltip set: '+ $scope.tooltip);
       }

        $scope.unitChanged = function() {
            var axisTitle = $scope.unit;
            axisType = $scope.logAxis===true ? "logarithmic":"linear";

            if ($scope.unit=='Bytes') {
              $scope.stackedDisabled=false;
              if (!lastStackedState && $scope.isStacked) {

                //deactivate log axis
                $scope.logAxis = false;
                axisType= "linear";

                streamRatesChartConfig.plotOptions.column.stacking = 'normal';
                lastStackedState=true;
                runInfoService.updateMaskedStreams([]);
                initChart(false);
                delete streamRatesChartConfig.plotOptions.column.stacking;
              }
              else if (lastStackedState && $scope.isStacked==false) {
                lastStackedState=false;
                runInfoService.updateMaskedStreams([]);
                initChart(false);
              }
            }
            else {
              //delete streamRatesChartConfig.plotOptions.column.stacking;
              $scope.stackedDisabled=true;
              if (lastStackedState) {
                lastStackedState=false;
                //console.log('reset!b...')
                runInfoService.updateMaskedStreams([]);
                initChart(false);
              }
            }

            //else delete streamRatesChartConfig.plotOptions.column.stacking;

            //check if accum needs to be disabled
            if (axisTitle=="Bytes / Event")
                $scope.accumDisabled=true;
            else
                $scope.accumDisabled=false;

            if (!$scope.accumDisabled && $scope.isAccum) {
               $scope.queryParams.accum = true;
               $scope.divisorDisabled = true;
            }
            else { 
               $scope.queryParams.accum = false;
               $scope.divisorDisabled = false;
               if (axisTitle=="Bytes / Event") $scope.divisorDisabled = true;
            }

            if (!$scope.divisorDisabled && $scope.useDivisor) {
                if (axisTitle!=="Bytes / Event")
                  axisTitle += '/s'
                $scope.queryParams.useDivisor=true;
            }
            else $scope.queryParams.useDivisor=false;

            var isPaused  = streamRatesService.paused;
            if (!isPaused) streamRatesService.pause()
            $scope.paramsChanged();
            if (!isPaused) streamRatesService.resume()
            //streamRatesChartConfig.yAxis[0].title.text = axisTitle; //waiting for fix https://github.com/pablojim/highcharts-ng/issues/247

            chart.yAxis[0].update({
                title: {
                    text: axisTitle
                }
            }, false);

            lastRateText = 'Built '+ axisTitle;
            chart.yAxis[4].update({
                title: {
                    text: $scope.showInputRate ? lastRateText : ""
                }
            }, false);

        }

        //$scope.selectorModeChanged = function() {
        //    currentRangeMode=$scope.selectorMode;
        //}

        $scope.selectorModeSet = function(newmode) {
            currentRangeMode=newmode;
            $scope.selectorMode=newmode;
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

                  var nbins = configService.nbins;
                  if (range < nbins) {
                    min = min - Math.round((nbins - range) / 2);
                    max = max + Math.round((nbins - range) / 2);
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
            var nbins = configService.nbins;
            if (max === lastLs) {
                $scope.queryInfo.isToSelected = false;
                if ((max - min) < 0) { 
                    console.log('warning: min>max! ' + max  + ' ' + min);
                    //$scope.queryInfo.isFromSelected = false;
                }
                if ((max - min) <= nbins) {
                    $scope.queryInfo.isFromSelected = false;
                } else {
                    $scope.queryInfo.isFromSelected = true
                }
            } else {
                //no zoom for lastLS nbins+1 (e.g. 21) or less (early in run)
                if (lastLs>nbins+1) {
                  $scope.queryInfo.isFromSelected = true;
                  $scope.queryInfo.isToSelected = true;
                }
                else {
                  $scope.queryInfo.isFromSelected = false;
                  $scope.queryInfo.isToSelected = false;
                }
            }
            $scope.queryParams.from = min;
            $scope.queryParams.to = max;
            $scope.paramsChanged();
            streamRatesService.start();

            //propagate to microstate service
            microStatesService.updateRange(runInfoService.data.runNumber,min>0?min:1,lastLs<max?lastLs:max,$scope.queryInfo.isFromSelected,$scope.queryInfo.isToSelected);
        }



        var initChart = function(changeUnit) {
            if (changeUnit) {
              $scope.unit = config.streamRatesUnit;
              $scope.selectorMode = "stream"; //todo:use config param
              $scope.isStacked=false;
              $scope.stackedDisabled = true;
              lastStackedState = false; 
            }
            colors.reset();
            if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfig.chart.renderTo).empty().unbind();
                chartConfig = false;
            };

            inputSerie = false;
            microSerie = false;
            miniSerie = false;
            macroSerie = false;

            streamRatesChartConfig.yAxis[0].type = axisType;
            streamRatesChartConfig.yAxis[4].type = axisType;//todo: move this axis to be index 1
            if (axisType==='logarithmic') {
              streamRatesChartConfig.yAxis[0].min = 0.01;
              streamRatesChartConfig.yAxis[4].min = 0.01;
            } else {
              delete streamRatesChartConfig.yAxis[0].min;
              streamRatesChartConfig.yAxis[4].min=0;
            }

            streamRatesChartConfig.xAxis[0].minRange = configService.nbins;
            streamRatesChartConfig.tooltip.enabled = $scope.tooltip;
            if ($scope.simplifiedView) {
              streamRatesChartConfig.yAxis[0].height="37%";
              streamRatesChartConfig.yAxis[0].top="0%";
              streamRatesChartConfig.yAxis[1].height="18%";
              streamRatesChartConfig.yAxis[1].top="40%";
              streamRatesChartConfig.yAxis[2].height="18%";
              streamRatesChartConfig.yAxis[2].top="60%";
              streamRatesChartConfig.yAxis[3].height="18%";
              streamRatesChartConfig.yAxis[3].top="80%";
              streamRatesChartConfig.yAxis[4].height="37%";
              streamRatesChartConfig.yAxis[4].top="0%";

            }
            else {
              streamRatesChartConfig.yAxis[0].height="70%";
              streamRatesChartConfig.yAxis[0].top="0%";
              streamRatesChartConfig.yAxis[1].height="8%";
              streamRatesChartConfig.yAxis[1].top="74%";
              streamRatesChartConfig.yAxis[2].height="8%";
              streamRatesChartConfig.yAxis[2].top="83%";
              streamRatesChartConfig.yAxis[3].height="8%";
              streamRatesChartConfig.yAxis[3].top="92%";
              streamRatesChartConfig.yAxis[4].height="70%";
              streamRatesChartConfig.yAxis[4].top="0%";
            }
            chartConfig = jQuery.extend({}, streamRatesChartConfig);
            setEvents();
            chart = new Highcharts.StockChart(chartConfig);
            chart.showLoading(config.chartWaitingMsg);

            if (changeUnit)
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
              inputSerie.setData(data.input, false, false);
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
                name: 'input',
                id: 'input',
                type: 'line',
                yAxis: "ratesin",
                color: 'grey',//silver
                zIndex: 10
                //type:area,
                //id:'navigator',
            });

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

            inputSerie = chart.get('input');
            microSerie = chart.get('micromerge');
            miniSerie = chart.get('minimerge');
            macroSerie = chart.get('macromerge');
                        
            chart.hideLoading();
            isDirty = true;
            inputSerie.setVisible($scope.showInputRate, false) //invisible by default
        }

        $scope.$on('runInfo.selected', function(event) {            
            if (isDirty) {
                initChart(true);
            };
        })

        $scope.$on('srChart.updated', function(event) {
            updateChart();
        });
        var updateChart = function() {
            var updatedUstates = false;
            var lastLS = runInfoService.data.lastLs;
            if (!axisSet) {
              if (lastLS>0) {
                var nbins = configService.nbins;
                chart.xAxis[0].setExtremes(lastLS>nbins ? lastLS-nbins : 1,lastLS>nbins?lastLS:nbins+1);
                axisSet=true;
                updatedUstates=true;
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

            var din = $scope.unit == 'Events' ? data.input.events : $scope.unit == 'Bytes' ? data.input.bytes : data.input.bytesPerEvt;
            inputSerie.setData(din, false, false);
            microSerie.setData(data.micromerge.percents, false, false);
            miniSerie.setData(data.minimerge.percents, false, false);
            macroSerie.setData(data.macromerge.percents, false, false);

            chart.redraw();

            if (!updatedUstates && data.lsList.length>0) {
              var max = data.lsList[data.lsList.length-1];
              var min = data.lsList[0];
              microStatesService.updateRange(runInfoService.data.runNumber,min>0?min:1,lastLS<max?lastLS:max,$scope.queryInfo.isFromSelected,$scope.queryInfo.isToSelected);
            }
        }

    })

    .controller('microStatesCtrl', function($scope, $rootScope, $window, configService, moment, amMoment, microStatesService, microStatesChartConfig, microStatesChartConfigNVD3, angularMomentConfig) {
        $scope.isCollapsed = false;

        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) {
            //schedule this immediately after setting visible
            if (chart || !cleared) setTimeout(function(){ 
              if (chart || !cleared) { 
                var isDirty_ = isDirty;
                var cleared_ = cleared;
                //destroyChart();
                resetChart();
                if (isDirty_ || !cleared_) processUpdate();  }
                microStatesService.resume()
            }, 500);
            else microStatesService.resume()
          }
          else
            microStatesService.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        $scope.showLegend=true;
        $scope.showLegendView=true;
        microStatesChartConfig.legend.enabled = $scope.showLegend;
        var initial=true;
        var setPadding=function() {
          //console.log($window.innerWidth);
          if ($window.innerWidth<992) {
              if ($scope.showLegend) {
                $scope.showLegend=false;
                $scope.showLegendView=false;
                if (!initial) {resetChart2();processUpdate();}
              }
              $scope.simplifiedView=true;
          }
          else {
              if (!$scope.showLegend) {
                $scope.showLegend=true;
                $scope.showLegendView=true;
                if (!initial) {resetChart2();processUpdate();}
              }
              $scope.simplifiedView=false;
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);
        var initial=false;


        $scope.toggleLegend=function() {
          $scope.showLegend=!$scope.showLegend;
          $scope.showLegendView=$scope.showLegend;
          resetChart2();
          processUpdate(); 
        }

        //defaults
        $scope.chartLib = "highcharts";

        //state
        var nvd3=($scope.chartLib==="nvd3");
        var chartEnabled=false;
        var lastChartLib = "disabled";

        $scope.switchChartLib = function() {
          if (lastChartLib===$scope.chartLib) return;
          if (chartEnabled) {
            destroyChart();
          }
          if ($scope.chartLib === "highcharts") {
            startHC();
            microStatesService.reconfigureFormat("hc",!$scope.isCollapsed)
          }
          if ($scope.chartLib === "nvd3") {
	    startNvd3();
            microStatesService.reconfigureFormat("nvd3",!$scope.isCollapsed)
          }
          if ($scope.chartLib == "disabled") {
             chartEnabled=false;
             $scope.isDisabledNvd3 = true;
             $scope.isDisabledHc = true;
             microStatesService.pause()
             //microStatesService.pause("nvd3")
          }
          lastChartLib=$scope.chartLib;
        }


        //hc
        var chart;
        var chartConfigHc;

        //nvd3
        var cleared = true;

        var destroyChart = function() {
          if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfigHc.chart.renderTo).empty().unbind();
          }
          if (!cleared) {
            $scope.api.clearElement()
            cleared = true;
            $scope.data = []
          }
          //todo:destroy nvd3 properly if api available
        }

        //highcharts
        var isDirty = true;
        var startHC = function() {
          chartEnabled=true;
          nvd3=false;
          $scope.isDisabledNvd3 = true;
          $scope.isDisabledHc = false;
          chartConfigHc = jQuery.extend({}, microStatesChartConfig);
          chartConfigHc.legend.enabled = $scope.showLegend;
          chart = new Highcharts.Chart(chartConfigHc);
          chart.showLoading(config.chartWaitingMsg);
          isDirty = false || $scope.isCollapsed;//force reset after uncollapse
        }

        var startNvd3 = function() {
          chartEnabled=true;
          nvd3=true;
          $scope.isDisabledNvd3 = false;
          $scope.isDisabledHc = true;
        }

        var resetChart = function() {
          if (!$scope.isDisabledNvd3 && !cleared) {
            destroyChart(); 
            startNvd3()
          }
          else {if (!$scope.isDisabledHc && isDirty) {
            destroyChart(); 
            startHC();
          }}
        }

        //always reset
        var resetChart2 = function() {
          destroyChart(); 
          if (!$scope.isDisabledNvd3)
            startNvd3()
          else if (!$scope.isDisabledHc) 
            startHC();
        }

        //init nvd3 chart config
        chartConfigNVD3 = microStatesChartConfigNVD3;
        chartConfigNVD3.chart.xAxis.tickFormat = function(d) {
            if (angularMomentConfig.timezone=='utc')
              var mm = moment.unix(d/1000).utc();
            else
              var mm = moment.unix(d/1000).local();
            return  padDigits(mm.hours(),2)+':'+padDigits(mm.minutes(),2)+':'+padDigits(mm.seconds(),2);
        };
        $scope.options = chartConfigNVD3; //nvd3 scope var

        //initial setup (called once)
        var config;
        $scope.$on('config.set', function(event) {
            config = configService.config;
            /* chart init point */
            $scope.switchChartLib();
        });

        //nvd3 only (hc and moment already seem to work together well)
        $rootScope.$on('timeZone.updated', function(event) {
            if (nvd3)
                $scope.api.refresh();
        });


        $scope.$on('runInfo.selected', function(event) {
            microStatesService.stop();
            resetChart();
        });

        $scope.$on('msChart.updated', function(event) {
            processUpdate();
        });
        var processUpdate = function() {
            if (!chartEnabled) {
              console.log('micro chart disabled');
              return;
            }
            if (!nvd3) {
              var data = microStatesService.data;
              var timeList = microStatesService.queryInfo.timeList;
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
              if(!isDirty){isDirty = true;chart.hideLoading();}
            }
            else {
              $scope.data = microStatesService.data;
              if (cleared) $scope.api.refresh();
              cleared = false;
            }
        }
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


    .controller('streamSummaryCtrl', function($scope, $rootScope, $window, $sce, configService, streamSummaryService)
    {

        var service = streamSummaryService;
        var splitf;
        var updatedOnce=false;
        //var splitf = 10;

        var setPadding=function() {
          //console.log($window.innerWidth);
          if ($window.innerWidth>=1700) splitf = 12;
          else if ($window.innerWidth>=1500) splitf = 10;
          else if ($window.innerWidth>=1250)
              splitf = 8;
          else if ($window.innerWidth>=1000)
              splitf = 6;
          else if ($window.innerWidth>=650)
              splitf = 4;
          else if ($window.innerWidth>=400)
              splitf = 3;
          else
              splitf = 2;
          if (updatedOnce) updateTable();
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        $scope.isCollapsed = false;
        if ($scope.isCollapsed) service.pause();

        $scope.collapseChanged = function() {
          if ($scope.isCollapsed) {service.resume();updateTable();}
          else service.pause()
          $scope.isCollapsed=!$scope.isCollapsed;
        }

        //var config;

        //$scope.$on('config.set', function(event) {
        //    config = configService.config;
        //});

        $scope.$on('ssTable.updated', function(event) {
            updateTable();
            updatedOnce=true;
        });

        var updateTable = function() {
          var vvf = 'width="'+(100/splitf).toFixed(0)+'%"'
          var streamsCopy;
	  var streams = Object.keys(service.data).sort();

          //reset last
          for (var i=1;i<=16;i++) {
            $scope["head"+i] = "";
            $scope["body"+i] = "";
          }

          var splitlevel = Math.floor(streams.length/splitf) + ( streams.length % splitf > 0 )
          if (!streams.length) return

	  var contentTemplate = "<tr><td>micro LS<br>complete/incomplete</td>";
          var content = []

          var splitStreams = function() {
	    if (!streams.length) return "";
            var num = streams.length < splitf ? streams.length : splitf;
            var heading = "<th>Stream</th><th "+vvf+" valign=\"top\">"+  streams.splice(0,splitf).join("</th><th "+vvf+" valign=\"top\">")  +"</th>";
            for (var k=0;k<splitf-num;k++) heading+='<th '+vvf+' valign="top"/>'
	    content.push(contentTemplate);
            return heading
          }
          for (var i=1;i<=splitlevel;i++)
            //$scope["head"+i] = splitStreams();//works in angular 1.4
            $scope["head"+i] = $sce.trustAsHtml(splitStreams());//for angular 1.5 compatibility

          streams = Object.keys(service.data).sort();

          for (var j=0;j<streams.length;j++) {
            var key=streams[j]
            var val = service.data[key]
            var contidx = Math.floor(j/splitf);
	    var complete = val[0];
	    var incomplete = val[1];
	    if(incomplete < 3)
	      content[contidx]+="<td class='text-left'>"+complete+"/"+incomplete+"</td>";
	    else if(incomplete < 6)
	      content[contidx]+="<td class='text-left warning'>"+complete+"/"+incomplete+"</td>";
	    else 
	      content[contidx]+="<td class='text-left danger'>"+complete+"/"+incomplete+"</td>";
	  }
          for (var i=0;i<splitlevel;i++) {
            if (content[i] && content[i].length)
              //$scope['body'+(i+1)]=content[i]+"</tr>";//angular 1.4
              $scope["body"+(i+1)] = $sce.trustAsHtml(content[i]+"</tr>");//angular 1.5
            else break;
          }
        }
    });


})();
