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

    .directive('f3monCentralSrOptionsRight',function () {
        return {
            restrict: 'E',
            templateUrl: 'views/central/sr-panel-options-right.html'
        }
     })

    .directive('f3monCentralSrButtonsUnits',function () {
        return {
            restrict: 'E',
            templateUrl: 'views/central/sr-panel-buttons-units.html'
        }
     })

    .directive('f3monCentralSrRangeselect',function () {
        return {
            restrict: 'E',
            templateUrl: 'views/central/sr-panel-rangeselect.html'
        }
    })

    .directive('optionsDropdownMultichoice', function() {
        return {
            restrict: 'E',
            scope: {
                    model: '=',
                    options: '=',
            },
            templateUrl: 'views/all/options-dropdown-multichoice.html',

            controller: function ($scope) {
                    $scope.openDropdown = function () {
                        $scope.open = !$scope.open;
                    };

                    $scope.selectAll = function () {
                        $scope.model = [];
                        angular.forEach($scope.options, function (item, index) {
                            $scope.model.push(item.id);
                        });
                    };

                    $scope.deselectAll = function () {
                        $scope.model = [];
                    };

                    $scope.toggleSelectItem = function (option) {
		        if (!option.enabled) return;
                        var intIndex = -1;
                        angular.forEach($scope.model, function (item, index) {
                            if (item == option.id) {
                                intIndex = index;
                            }
                        });

                        if (intIndex >= 0) {
                            $scope.model.splice(intIndex, 1);
                        }
                        else {
                            $scope.model.push(option.id);
                        }
			if (option.onclick) option.onclick();
                    };

                    $scope.getClassName = function (option) {
		        if (!option.enabled) return ('fa fa-lock');
                        var varClassName = 'fa fa-square';
                        angular.forEach($scope.model, function (item, index) {
                            if (item == option.id) {
                                varClassName = 'fa fa-check-square';
                            }
                        });
                        return (varClassName);
                    };
            }

        };
    })
 
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

        $scope.hpxdd=630;
        var setPadding=function() {
          if ($window.innerWidth<992) {
            $scope.hpxdd=450;
          }
          else {
            $scope.hpxdd=630;
          }
        }
        setPadding();
        $rootScope.resizeList.push(setPadding);

        $scope.queryParams = drillDownService.queryParams;

        var dd2Event,ddserie,dd2serie;
        var isSecondLevel=false;

        var setEventsDD = function(){
           
            chartConfig.chart.events.drilldown = function(event) {
                secondDrillDown(event)
            }
            chartConfig.chart.events.drillup = function(event) {
                secondDrillUp(event)
            }    
        };

        var initChartDD = function(){
            chartConfig = jQuery.extend({}, drillDownChartConfig);
            setEventsDD();
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
            if (['macromerge','transfer'].indexOf($scope.queryParams.type) > -1)
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
            if (!chart) initChartDD();
            //chart.xAxis[0].update({labels:{rotation:0}});
            ddserie = chart.series[0];
            ddserie.update({
                data: drillDownService.data
            });
        })

        $scope.$on('dd2Chart.updated', function(event) {
            if (!chart) initChartDD();
            //chart.xAxis[0].update({labels:{rotation:-60}});
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

        var config;

        $scope.$on('config.set', function(event) {
            config = configService.config;
	    //first init (only set up variables)
            initChart(true);
        });

        //called when collapse button is clicked
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

        var calcView=function() {
          if ($scope.simplifiedView) {
            configService.nbins=8
            streamRatesService.intervalNum=8
	    getStreamOptionObj("tooltip").enabled=false;
            $scope.displayAux=false;
            $scope.hpx=450;
          } else {
            configService.nbins=25
            streamRatesService.intervalNum=25
	    getStreamOptionObj("tooltip").enabled=true;
            $scope.displayAux=true;
            $scope.hpx=630;
          }
        }

        //called on window resolution change
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

        //initialize and register with resize handler
        $scope.simplifiedView=false;
        $rootScope.resizeList.push(setPadding);

        //link controller scope variables to service
        $scope.paramsChanged = streamRatesService.paramsChanged;
        $scope.queryParams = streamRatesService.queryParams;
        $scope.queryInfo = streamRatesService.queryInfo;

        var data = streamRatesService.data;
        var runInfoData = runInfoService.data;
        var chart = false;
        var microSerie, miniSerie, macroSerie, transSerie, streams, chartConfig;
        var customLoading = false;
        var isDirty = true;
        var axisSet = false;

        //input rate switch handling
        $scope.showInputRate = false;
        var lastRateText = "Built Events";
        $scope.toggleInputRate = function() {
          if (chart) {
            //$scope.showInputRate = !$scope.showInputRate;
            if (inputSerie) {
              inputSerie.setVisible($scope.showInputRate, false)
	      var ymax = transSerie === undefined ? 4 : 5;
              chart.yAxis[ymax].update({
                title: {
                  text: $scope.showInputRate ? lastRateText : ""
                }
              }, false);

              chart.redraw();
            }
          }
        }

        //range mode selection variables
        $scope.selectorModes = ["stream","micro","mini","macro","transfer"]
        $scope.selectorMode = "stream";

        var lastStackedState = false;

        var lastTransState = false;
        $scope.showTrans=false;

        var axisType="linear"; // actual axis type because logAxis setting could be disabled

        $scope.updateMaskedStreams = function(maskedStreamList) {
          runInfoService.updateMaskedStreams(maskedStreamList);
        }

        //callbacks
        $scope.tooltipToggle = function() {
          runInfoService.updateMaskedStreams([]);
          initChart(false);
        }

        $scope.unitChanged = function() {
            var axisTitle = $scope.unit;
            axisType = streamOptionSelected("logAxis") && getStreamOptionObj("logAxis").enabled ? "logarithmic":"linear";

            var pending_init_chart = false;

            if ($scope.unit=='Bytes') {
	      getStreamOptionObj("stacked").enabled=true;
              if (!lastStackedState && streamOptionSelected("stacked")) {

                //deactivate log axis
		setStreamOption("logAxis",false)
                axisType= "linear";
                lastStackedState=true;
                pending_init_chart=true;
              }
              else if (lastStackedState && !streamOptionSelected("stacked")) {
                lastStackedState=false;
                pending_init_chart=true;
              }
            }
            else {
	      getStreamOptionObj("stacked").enabled=false;
              if (lastStackedState) {
                lastStackedState=false;
                pending_init_chart=true;
              }
            }

            if (!lastTransState && $scope.showTrans) {
              lastTransState=true;
              pending_init_chart=true;
            }
            else if (lastTransState && !$scope.showTrans) {
              lastTransState=false;
              pending_init_chart=true;
            }

            //if needed for display changes
            if (pending_init_chart) {
              runInfoService.updateMaskedStreams([]);
	      initChart(false);
	    }


            //check if accum needs to be disabled
            if (axisTitle=="Bytes / Event")
		 getStreamOptionObj("accum").enabled=false;
            else
		 getStreamOptionObj("accum").enabled=true;

            if (getStreamOptionObj("accum").enabled && streamOptionSelected("accum")) {
               $scope.queryParams.accum = true;
	       getStreamOptionObj("secLS").enabled=false;
            }
            else { 
               $scope.queryParams.accum = false;
	       getStreamOptionObj("secLS").enabled = axisTitle=="Bytes / Event" ? false:true;
            }

            if (getStreamOptionObj("secLS").enabled && streamOptionSelected("secLS")) {
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
	    var ymax = transSerie === undefined ? 4 : 5
            chart.yAxis[ymax].update({
                title: {
                    text: $scope.showInputRate ? lastRateText : ""
                }
            }, false);

        }

        $scope.toggleAxis = function() {
          $scope.unitChanged();
          initChart(false);
        }

        //init chart options
        $scope.streamOptions = {};
        $scope.selectedStreamOptions = {};

        var defaultStreamOptions = function(optId) {
          var streamOptions = [
                { "id": "stacked", "name": "stacked", "enabled":false, "onclick": $scope.unitChanged  },
                { "id": "accum"  , "name": "accumulated",   "enabled":true,  "onclick": $scope.unitChanged  },
                { "id": "logAxis", "name": "logarithmic axis",     "enabled":true,  "onclick": $scope.toggleAxis   },
                { "id": "tooltip", "name": "tooltip", "enabled":true,  "onclick": $scope.tooltipToggle},
                { "id": "secLS"  , "name": "per sec/per LS",  "enabled":true,  "onclick": $scope.unitChanged  }
            ];
	  if (!optId) {
	    $scope.streamOptions = streamOptions;
            $scope.selectedStreamOptions = ["tooltip", "secLS"];
	  }
	  else {
	    //overwrite only a single element if optId is specified
	    for (var i=0;i<$scope.streamOptions.length;i++) {
	      if ($scope.streamOptions[i].id==optId) {
	        for (var j=0;j<streamOptions.length;j++) {
	          if (streamOptions[j].id==optId) {
	            $scope.streamOptions[i].id=streamOptions[j];
		    break;
		  }
		}
		break;
              }
	    }
	  }
	}
        var getStreamOptionObj = function(id) {
	  for (var i=0;i<$scope.streamOptions.length;i++) {
	    if ($scope.streamOptions[i].id==id) return $scope.streamOptions[i];
	  }
	  return null;
	}
	var streamOptionSelected = function(id) {
          return ($scope.selectedStreamOptions.indexOf(id)!=-1);
	}
	var setStreamOption = function(id,selected) {
	  var index = $scope.selectedStreamOptions.indexOf(id)
	  if (selected && index==-1) $scope.selectedStreamOptions.push(id);
	  else if (index!=-1) $scope.selectedStreamOptions.splice(index,1);
	}

        //do init options
        defaultStreamOptions();
        setPadding();
        calcView();

        //reset on tab change
        $scope.$on('global.reload', function(event) {
          if (!$rootScope.chartInitDone) {
	    console.log('glob reload/reset ... ' )
            runInfoService.updateMaskedStreams([]);
	    //reset parameters
            setTimeout(function() {initChart(true)},1);
          }
        });

        $scope.selectorModeSet = function(newmode) {
            $scope.selectorMode=newmode;
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

                if ($scope.selectorMode==="stream") {

                  var nbins = configService.nbins;
                  if (range < nbins) {
                    min = min - Math.round((nbins - range) / 2);
                    max = max + Math.round((nbins - range) / 2);
                  }

                  selectionRules(min, max);
                }
                else if ($scope.selectorMode==="micro") {
                   $scope.$parent.enableDrillDown('micromerge', min, range);
                }
                else if ($scope.selectorMode==="mini") {
                   $scope.$parent.enableDrillDown('minimerge', min, range);
                }
                else if ($scope.selectorMode==="macro") {
                   $scope.$parent.enableDrillDown('macromerge', min, range);
                }
                else if ($scope.selectorMode==="transfer") {
                   $scope.$parent.enableDrillDown('transfer', min, range);
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
                var y4RawValue = transSerie===undefined? 9999 : Math.ceil(event.yAxis[4].value);

                if (y4RawValue < 100) {
                    $scope.$parent.enableDrillDown('transfer', xRealValue, data.interval)
                } else if (y3RawValue < 100) {
                    $scope.$parent.enableDrillDown('macromerge', xRealValue, data.interval)
                } else if (y2RawValue < 100) {
                    $scope.$parent.enableDrillDown('minimerge', xRealValue, data.interval)
                } else if (y1RawValue < 100) {
                    $scope.$parent.enableDrillDown('micromerge', xRealValue, data.interval)
                }
            }
        }

        //create chart object, optionally with resetting some of the optional series setup (selector mode, input, stacked, transfers)
        var initChart = function(resetConfig) {
            if (resetConfig) {

              defaultStreamOptions();
	      //or just re-init everything?
	      //setStreamOption("stacked",false);
	      //getStreamOptionObj("stacked").enabled=false;
              //lastStackedState = false; 

              //other defaults
              $scope.unit = config.streamRatesUnit; //default unit
              $scope.selectorMode = "stream";
              $scope.showInputRate = false;
              $scope.showTrans = false;
              lastTransState = false;
              axisSet = false;
	      //TODO:should update/reset masked streams?
            }
            colors.reset();

	    //highcharts destroy
            if (chart) {
                chart.destroy();
                chart = false;
                $("#" + chartConfig.chart.renderTo).empty().unbind();
                chartConfig = false;
                customLoading=false;

            };

            inputSerie = false;
            microSerie = false;
            miniSerie = false;
            macroSerie = false;
            transSerie = false;

            chartConfig = jQuery.extend(true,{}, streamRatesChartConfig); //deep copy

            if (streamOptionSelected("stacked") && getStreamOptionObj("stacked").enabled)
              chartConfig.plotOptions.column.stacking = 'normal';

            chartConfig.xAxis[0].minRange = configService.nbins;
            chartConfig.tooltip.enabled = streamOptionSelected("tooltip") && getStreamOptionObj("tooltip").enabled;
	    var heights,tops,ymax;
	    if ($scope.showTrans) {
	      ymax=5
              if ($scope.simplifiedView) {
	        heights = ["37%","14%","14%","14%","14%","37%"]
		tops = ["0%","40%","55%","70%","85%","0%"]
              } else {
	        heights = ["68%","6.5%","6.5%","6.5%","6.5%","68%"]
		tops = ["0%","72%","79%","86%","93%","0%"]
              }
	    }
	    else {
	      //axis is smaller 
	      ymax=4
              transSerie = undefined;
	      chartConfig.yAxis = [chartConfig.yAxis[0], chartConfig.yAxis[1],chartConfig.yAxis[2],chartConfig.yAxis[3],chartConfig.yAxis[5]];
              if ($scope.simplifiedView) {
	        heights = ["37%","18%","18%","18%","37%"]
		tops = ["0%","40%","60%","80%","0%"]
              } else {
	        heights = ["70%","8%","8%","8%","70%"]
		tops = ["0%","74%","83%","92%","0%"]
              }
	    }
	    for (var i=0;i<=ymax;i++) {
	      chartConfig.yAxis[i].height=heights[i];
	      chartConfig.yAxis[i].top=tops[i];
	    }
            chartConfig.yAxis[0].type = axisType;
            chartConfig.yAxis[ymax].type = axisType;//todo: move this axis to be index 1
            if (axisType==='logarithmic') {
              chartConfig.yAxis[0].min = 0.01;
              chartConfig.yAxis[ymax].min = 0.01;
            } else {
              delete chartConfig.yAxis[0].min;
              chartConfig.yAxis[ymax].min=0;
            }

	    //console.log(JSON.stringify(chartConfig))
            setEvents();
            chart = new Highcharts.StockChart(chartConfig);
            chart.showLoading(config.chartWaitingMsg);

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
	      if (data.transfer)
                data.transfer.percents.forEach(function(s){
                  s.color="darkgreen"
                })
              inputSerie.setData(data.input, false, false);
              microSerie.setData(data.micromerge.percents, false, false);
              miniSerie.setData(data.minimerge.percents, false, false);
              macroSerie.setData(data.macromerge.percents, false, false);
	      if (data.transfer && transSerie)
                transSerie.setData(data.transfer.percents, false, false);
              chart.redraw();
            }

            //add function to chart to communicate with stream config
            chart.getTimezoneCustom = function() {
              return angularMomentConfig.timezone;
            }
        
            streams = {};
            isDirty = false;
            $rootScope.chartInitDone = true;

            //refresh unit setup. This can call this function again recursively and init chart again, but not more than once
	    //the chart config and init procedure should be revisited to address this
            $scope.unitChanged();
            
        }

	//postponed init of chart series (called when data arrives)
        //it is possible to set some of the series earlier but then the chart render with grid and empty values at beginning
        var startChart = function() {

            chart.addSeries({
                showInLegend: false,
                visible: true,
                name: 'input',
                id: 'input',
                type: 'line',
                yAxis: "ratesin",
                color: 'grey',//silver
                zIndex: 10,
                marker:{radius:2,fillColor:'grey',enabled:true}
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
                            $scope.$parent.enableDrillDown(this.series.name, this.x, data.interval)
                            //$scope.$parent.enableDrillDown(event.currentTarget.series.name, event.currentTarget.category, data.interval)
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
                            $scope.$parent.enableDrillDown(this.series.name, this.x, data.interval)
                            //$scope.$parent.enableDrillDown(event.currentTarget.series.name, event.currentTarget.category, data.interval)
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

            //add series only if transSerie value is false
            if (transSerie!==undefined) chart.addSeries({
                borderWidth: 0.5,
                type: 'column',
                id: "transfer",
                name: "transfer",
                yAxis: "transferpercent",
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
            if (transSerie!==undefined) transSerie = chart.get('transfer');
                        
            //if no streams yet, loading will be changed later when stream list appears
            if (runInfoService.data.streamListINI.length || runInfoService.data.streams.length) {
              chart.hideLoading();
              customLoading=false;
            }

            isDirty = true;
            inputSerie.setVisible($scope.showInputRate, false) //invisible by default
        }

        //reset chart when run changes. Does not execute startChart yet at this point
        $scope.$on('runInfo.selected', function(event) {            
            if (isDirty) {
                initChart(false);
            };
        })

        //update or switch off loading info message depending on available run information
        $scope.$on('runInfo.updated', function(event) {
            if (runInfoService.data.runNumber && runInfoService.data.endTime==false && chart) {
                customLoading=true;
                if (!runInfoService.data.streamListINI.length)
                  chart.showLoading('<img src="images/wheel.gif"><br><br>waiting for HLT initialization');
                else if (runInfoService.data.lastLs===false)
                  chart.showLoading('<img src="images/wheel.gif"><br><br>waiting for first end-of-lumisection file');//todo:combine with input information
                else if (!runInfoService.data.streams.length)
                  chart.showLoading('<img src="images/wheel.gif"><br><br>waiting for stream output from HLT');
                else {
                  customLoading=false;
                  chart.hideLoading();
                }
            }
            else if (customLoading && chart && !isDirty) {chart.showLoading('no monitoring information');customLoading=false;}
        });


        //data update event
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
            if (!$scope.showInputRate) {
              if (runInfoData.streams.length===0) {
                if (isDirty) stopChart();
                return;
              }
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
	    if (data.transfer && transSerie)
              transSerie.setData(data.transfer.percents, false, false);

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

        var resetCPUSlots = function() {
          $scope.cpuSlotsMax = microStatesService.queryParams.cputype;
          $scope.cpuSlotsMaxList = microStatesService.cputypes;
        }
        $scope.cpuSlotsMaxSet = function(newcputype) {
          microStatesService.pause();
          microStatesService.queryParams.cputype = newcputype;
          microStatesService.queryInfo.lastTime = false
          $scope.cpuSlotsMax = newcputype;
          microStatesService.resume();
        }
        microStatesService.slotsResetCB = resetCPUSlots;
        resetCPUSlots();

        $scope.toggleCorr20 = function() {
          microStatesService.pause();
          microStatesService.queryParams.hteff = $scope.corr20 ? 0.2 : 1;
          microStatesService.queryInfo.lastTime = false
          microStatesService.resume();
        }
        var resetCorr20 = function() {
          $scope.corr20 = microStatesService.queryParams.hteff==1 ? false:true
        }
        microStatesService.resetHTeffCB = resetCorr20;
        resetCorr20();

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

        //defaults
        $scope.chartType = "micro";
        //state
        var isMicro=($scope.chartLib==="micro");
        var lastChartType = "micro";

        $scope.switchChartType = function() {
          if (lastChartType===$scope.chartType) return;
          if (chartEnabled) {
            destroyChart();
          }
          var chartTypes = {'micro':'nstates-summary','input':'istates-summary'}
          microStatesService.stop()
          microStatesService.setServiceResource(chartTypes[$scope.chartType]);

          if ($scope.chartLib === "highcharts") {
            startHC();
            microStatesService.reconfigureFormat("hc",!$scope.isCollapsed)
          }
          if ($scope.chartLib === "nvd3") {
           startNvd3();
            microStatesService.reconfigureFormat("nvd3",!$scope.isCollapsed)
          }
          lastChartType=$scope.chartType;
          microStatesService.start()
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

        //on log tab switch back or clicking on f3mon title
        var onReload = function(event) {
          if (!$rootScope.chartInitDone) {
            if (chart || !cleared) setTimeout(function(){ 
              if (chart || !cleared) { 
                var isDirty_ = isDirty;
                var cleared_ = cleared;
                resetChart();
                if (isDirty_ || !cleared_) processUpdate();
              }
            },1);
          }
        };

        //on tab change
        $scope.$on('global.reload', function (event) {
          resetCorr20();
          microStatesService.resetParams(true);
          onReload();
        });

        //on run view change
        $scope.$on('global.refresh', onReload);

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
              if(!isDirty){isDirty = true;chart.hideLoading();customLoading=false;}
            }
            else {
              $scope.data = microStatesService.data;
              if (cleared) $scope.api.refresh();
              cleared = false;
            }
            $scope.cpuSlotsMaxList = microStatesService.cputypes;
        }
    })


    .controller('logsCtrl', function($scope, $sce, logsService, globalService) {
        var service = logsService;

        $scope.queryParams = logsService.queryParams;
        $scope.data = logsService.data;
        $scope.search = service.search;
        $scope.pageChanged = service.pageChanged;
        $scope.sortedClass = service.sortedClass;
        $scope.changeSorting = service.changeSorting;
        $scope.showHLTd=false;
        $scope.showHLT=false;

        //on log tab switch back or clicking on f3mon title
        var onReload = function(event) {
          var tabnum = globalService.status.currentTab;
          if (tabnum===0) {
            $scope.showHLTd=false;
            $scope.showHLT=false;
            service.data.itemsPerPage=0;
            logsService.data.displayTotal=0
            logsService.data.displayed = [];//clear existing data
            //logsService.data.size=0;
            logsService.queryParams.docType='hltdlog,cmsswlog';
            return;
          }
          else if (tabnum===1) {
            $scope.showHLTd=true;
            $scope.showHLT=false;
            //logsService.data.size=20;
            service.data.itemsPerPage=20;
            $scope.setType('hltdlog')
          }
          else if (tabnum===2) {
            $scope.showHLTd=false;
            $scope.showHLT=true;
            //logsService.data.size=20;
            service.data.itemsPerPage=20;
            $scope.setType('cmsswlog')
          }
        }

        $scope.$on('global.reload', onReload);
        $scope.$on('global.refresh', onReload);

        $scope.toggleHLT =function () {
          $scope.detectType();
        }

        $scope.toggleHLTd =function () {
          $scope.detectType();
        }

        $scope.detectType =function () {
          if ($scope.showHLT && $scope.showHLTd)
            $scope.setType('hltdlog,cmsswlog')
          else if ($scope.showHLT)
            $scope.setType('cmsswlog')
          else if ($scope.showHLTd)
            $scope.setType('hltdlog')
          else
            $scope.setType('hltdlog,cmsswlog')
        }

        $scope.setType =function (docType) {
          logsService.data.displayed = [];
          logsService.queryParams.docType=docType;
          logsService.data.displayTotal=0
          logsService.stop()
          logsService.start()
        }

    })


    .controller('streamSummaryCtrl', function($scope, $rootScope, $window, $sce, configService, streamSummaryService)
    {

        var service = streamSummaryService;
        var splitf;
        var updatedOnce=false;
        //var splitf = 10;

        var setPadding=function() {
          //console.log($window.innerWidth);
          if ($window.innerWidth>=1700) splitf = 11;
          else if ($window.innerWidth>=1500) splitf = 9;
          else if ($window.innerWidth>=1250)
              splitf = 7;
          else if ($window.innerWidth>=1000)
              splitf = 5;
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
          var streamsCopy;
	  var streams = Object.keys(service.data).sort();

          //reset last
          for (var i=1;i<=25;i++) {
            $scope["head"+i] = "";
            $scope["body"+i] = "";
          }

          var splitf_eff = splitf;
          var splitlevel = Math.floor(streams.length/splitf_eff) + ( streams.length % splitf_eff > 0 );

          //recalculate for cases where long stream names doen't fit
          var checkLen=function(off,rowlen) {
            var totLen=0;
            for (var i=off;i<streams.length && i<off+rowlen;i++) {totLen+=streams[i].length;}
            return totLen;
          }
          while (true) {
            var too_long=false;
            if (splitf_eff<=2) break;
            for  (var i=1;i<=splitlevel;i++) {
              //console.log(splitf +' '+ splitf_eff + ' ' + checkLen((i-1)*splitf_eff,splitf_eff))
              if (checkLen((i-1)*splitf_eff,splitf_eff) < 12*splitf) continue;
              else too_long=true;
            }
            if (too_long) {
              splitf_eff--;
              splitlevel = Math.floor(streams.length/splitf_eff) + ( streams.length % splitf_eff > 0 );
            }
            else break;
          }
          var vvf = 'width="'+(100/splitf_eff).toFixed(0)+'%"'

          if (!streams.length) return

	  var contentTemplate = "<tr><td>micro LS<br>complete/incomplete</td>";
          var content = []

          var splitStreams = function() {
	    if (!streams.length) return "";
            var num = streams.length < splitf_eff ? streams.length : splitf_eff;
            var heading = "<th>Stream</th><th "+vvf+" valign=\"top\">"+  streams.splice(0,splitf_eff).join("</th><th "+vvf+" valign=\"top\">")  +"</th>";
            for (var k=0;k<splitf_eff-num;k++) heading+='<th '+vvf+' valign="top"/>';
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
            var contidx = Math.floor(j/splitf_eff);
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
