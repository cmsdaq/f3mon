'use strict';

/**
 * @ngdoc service
 * @name f3monApp.config
 * @description
 * # config
 * Constant in the f3monApp.
 */


//NOTE: default page config in api/config.php
(function() {
    angular.module('f3monApp')



    .config(function($provide, paginationTemplateProvider) {
        //Template required by the dirpagination plugin
        paginationTemplateProvider.setPath('views/modals/dirPagination.tpl.html');


//        $provide.constant('config', {
//            'defaultSubSystem': "cdaq",
//            'fastPollingDelay': 3000,
//            'slowPollingDelay': 5000,
//            'chartWaitingMsg': 'No monitoring information.',
//            'msChartMaxPoints': 60,
//            'defaultTimezone': 'Locale',
//        })

    })


    //TimeZone settings
    .constant('angularMomentConfig', {
        //format: 'MMM D YYYY, HH:mm', //problematic angular-moment 0.10.3, while this already is default
        preprocess: 'utc',
        //timezone: 'Europe/London' // e.g. 'Europe/London'
    })

    .service('colors', function() {
        var list = Highcharts.getOptions('colors').colors;
        //var list = [ '#fd4338','#ff782e','#ffb632', '#a4ce3a','#44cc8a'];//'#ffdb00','#a9f1f6','#fff6cf','#ffcd80','#ffe9a6'];
        //var list = [ '#fd4338','#ff782e','#ffb632', '#a4ce3a','#44cc8a','#ffdb00','#a9f1f6','#fff6cf','#ffcd80','#ffe9a6'];
        //var list =  ['#FFB300','#803E75','#FF6800','#A6BDD7','#C10020','#CEA262','#817066','#007D34','#F6768E','#00538A','#FF7A5C','#53377A','#FF8E00','#B32851','#F4C800','#7F180D','#93AA00','#593315','#F13A13','#232C16',];
        var index = 2;

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
            index = 2;
        }
    })


    .constant('streamRatesChartConfig', {
        chart: {
            renderTo: 'srchart',
            zoomType: 'x',
            animation: {
                duration: 500,
                easing: 'linear'
            },
            events: {},
        },
        exporting: {
            enabled: true
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
            spline: {
                lineWidth: 3,
                marker: {
                    enabled: true,
                }
            },

            column: {
                groupPadding: 0.01,
                pointPadding: 0,
                borderWidth: 0.01,
                events: {
                    legendItemClick: function(event) {
                        var selectedName = this.name;
                        var series = this.chart.series;
                        var hideAllOthers = event.browserEvent.ctrlKey || event.browserEvent.shiftKey;

                        if (hideAllOthers) {
                            series.forEach(function(serie) {
                                if (['navigator', 'Navigator', 'micromerge', 'minimerge', 'macromerge','transfer','input'].indexOf(serie.name) > -1) {
                                    return
                                } else if (serie.name == selectedName) {
                                    serie.setVisible(true, false)

                                } else {
                                    serie.setVisible(!serie.visible, false)
                                }
                            })
                            this.chart.redraw();
                        } else {
                            series.forEach(function(serie) {
                              if (serie.name == selectedName) {
                                serie.setVisible(!serie.visible, false)
                              }
                            });
                        }
                        //build list of invisible streams for next merge completion update
                        maskedStreamList = []
                        series.forEach(function(serie) {
                              if (!serie.visible) {
                                if (['navigator', 'Navigator', 'micromerge', 'minimerge', 'macromerge','transfer','input'].indexOf(serie.name) <= -1)
                                  maskedStreamList.push(serie.name);
                              }
                        });
                        this.chart.setMaskedStreams(maskedStreamList);
                        return false;
                    }
                }
            }
        },
        tooltip: {
            useHTML:true,
            formatter: function(tooltip) {

                function padDigits(number, digits) {
                    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
                }

                var percents={};

                var items = this.points || splat(this),
                    series = items[0].series,
                    s;

                // build the header
                var tiptype;
                if (series.chart.yAxis[0].axisTitle==null || series.chart.yAxis[0].axisTitle.textStr.indexOf('Events')=== 0)
                  tiptype = 0;
                else if (series.chart.yAxis[0].axisTitle.textStr.indexOf('Bytes / Event')=== 0)
                  tiptype = 2;
                else if (series.chart.yAxis[0].axisTitle.textStr.indexOf('Bytes')=== 0)
                  tiptype = 1;

                var timestr="";
                items.forEach(function(itm){
                    if (itm.series.name == 'macromerge') {
                      if (itm.point.eolts!==undefined) {
                        var mm;
                        if (series.chart.getTimezoneCustom()=='utc')
                          mm = moment(itm.point.eolts).utc();
                        else
                          mm = moment(itm.point.eolts).local();
                        timestr = padDigits(mm.hours(),2)+':'+padDigits(mm.minutes(),2)+':'+padDigits(mm.seconds(),2);
                      }
                    }
                });
                if (tiptype==0)
                  s = ['<b> LS: ' + items[0].key + ' rate </b> - '+ timestr +'<br/>'];
                else if (tiptype==1)
                  s = ['<b> LS: ' + items[0].key + ' throughput </b> - '+ timestr+'<br/>'];
                else if (tiptype==2)
                  s = ['<b> LS: ' + items[0].key + ' output event size </b> - '+ timestr+'<br/>'];

                //get percents
                var totals = $.grep(items,function(item,index){
                    return $.inArray(item.series.name,['micromerge', 'minimerge','macromerge','transfer']) <0;
                })

                totals.forEach(function(item){
                    var name = item.series.name;
                    percents[name] = item.point.p;
                })

                var totalsRate = $.grep(items,function(item,index){
                    return $.inArray(item.series.name,['micromerge', 'minimerge','macromerge','transfer','input']) <0;
                })

                var sumRate = 0;
                if (tiptype==0 || tiptype==2)
                  sumRate=-1;
                else {
                  totalsRate.forEach(function(item){
                    sumRate += item.point.y;
                  });
                }

                //define functions to help with formatting (this should probably be defined elsewhere)
                //function padL(a,b,c){//string/number,length+1,char
                //  return (new Array(b||2).join(c||0)+a).slice(-b)
                //}

                function bytesToSize(bytes, precision,pers) {
                  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                  var sizes_s = ['Bytes/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
                  var posttxt = 0;
                  if (bytes == 0)
                    if (pers) return '0 '+sizes_s[0];
                    else return '0 '+sizes[0];
                  if (bytes < 1000) {
                    if (pers)
                      return Number(bytes) + " " + sizes_s[posttxt];
                    else
                      return Number(bytes) + " " + sizes[posttxt];
                  }
                  while( bytes >= 1000 ) {
                    posttxt++;
                    bytes = bytes / 1000;
                  }
                  if (pers)
                    return bytes.toFixed(precision) + " " + sizes_s[posttxt];
                  else
                    return bytes.toFixed(precision) + " " + sizes[posttxt];
                }

                var hasBSeconds = series.chart.yAxis[0].axisTitle!=null && series.chart.yAxis[0].axisTitle.textStr==="Bytes/s";
                var table_open = false;
                var even_entry = true;

                var streamcount = 0;
                items.forEach(function(item) {
                  var name = item.series.name;
                  if (-1==$.inArray(name,['micromerge','minimerge','macromerge','transfer','input'])) streamcount++;
                });

                // build the values
                s.push('<table><tbody>');

                var mrgcount=0;
                items.forEach(function(item) {
                    var name = item.series.name;

                    series = item.series;
                    var isMerge = $.inArray(name,['micromerge','minimerge','macromerge','transfer']) !== -1;
                    var isInput = name=='input';

                    var formatString;

                    if (isMerge || isInput) {

                    var pref="";
                    var suf="";
                    if (streamcount>30) {
                    if (even_entry) {even_entry=false;pref="<tr>";}
                    else  {even_entry=true;suf="</tr>";}
                    }
                    else {pref="<tr>";suf="</tr>";}


                    formatString=pref+'<td style="padding-right:3px">'+item.series.name
                      +'</td><td style="padding-right:3px;text-align:right"><td/><b>'//+ (isMerge?'<td/><i>':'')
                      + (isInput && tiptype!=0?bytesToSize(item.point.y,2,hasBSeconds):(isInput?item.point.y.toFixed(2):item.point.y))+ (isMerge? '%':'')+'</b></td></td>'+suf;
                    s.push(formatString);
                    mrgcount++;

                    }
                });
                if (mrgcount%2 && streamcount>30) s.push("</tr>");
                even_entry = true;

                //handle non-micromerge or transfer
                items.forEach(function(item) {
                    var name = item.series.name;

                    series = item.series;
                    var isMerge = $.inArray(name,['micromerge','minimerge','macromerge','transfer']) !== -1;
                    var isInput = name=='input';

                    var formatString;

                    if (!isMerge && !isInput) {
                      var pref="";
                      var suf="";
                      if (streamcount>30) {
                        if (even_entry) {even_entry=false;pref="<tr>";}
                        else  {even_entry=true;suf="</tr>";}
                      }
                      else {pref="<tr>";suf="</tr>";}
                      var ss = "padding-right:3px;text-align:right";
                      if (tiptype==1) {
                        var fact = hasBSeconds?1:23.31
                        if (item.point.y<5000000*fact) ss+=';color:grey';
                        else if (item.point.y<50000000*fact) ss+=';color:black';
                        else if (item.point.y<300000000*fact) ss+=';color:darkred';
                        else if (item.point.y<800000000*fact) ss+=';color:firebrick';
                        else /*if (item.point.y>=700000000)*/ ss+=';color:red';
                      }
                      formatString=pref+'<td style="padding-right:3px"><span style="color:'+item.series.color+'">●</span>'+item.series.name
                        +'</td><td style="'+ss+'"><b>'+(tiptype==0 ? item.point.y.toFixed(2):bytesToSize(item.point.y,2,hasBSeconds))
                        +'</b></td>'+'<td style="padding-right:3px;text-align:right"><i>'+percents[name]+'%</i></td>'
                        +suf;
                      s.push(formatString);
                    }
                });

                if (!even_entry) s.push('</tr>');
                s.push('</tbody></table>')

                if (sumRate>=0) {
                  var sumEst = sumRate / (hasBSeconds? 1000000. :23310000.);
                  if (sumEst>6000)
                    s.push('<br><span style="font-weight:bold;font-size: 14px;" >Total: </span> <span style="color:red;font-weight:bold;font-size: 14px;" >'
                           + bytesToSize(sumRate,2,hasBSeconds) + "</span>");
                  else if (sumEst>4000)
                    s.push('<br><span style="font-weight:bold;font-size: 14px;" >Total: </span> <span style="color:#FF5733;font-weight:bold;font-size:14px;" >'
                           + bytesToSize(sumRate,2,hasBSeconds) + "</span>");
                  else
                    s.push('<br><span style="font-weight:bold;font-size: 14px;" >Total: '
                           + bytesToSize(sumRate,2,hasBSeconds) + "</span>");
                }
                // footer
                s.push(tooltip.options.footerFormat || '');
                return s.join('');
            },
            enabled: true,
            followPointer: false,
            //crosshairs: [true, true], //not visible with the grid
            //shared: true,
            //position on the left or right side of the point only with shared:false
            positioner: function(labelWidth, labelHeight, point) {
                var tooltipX, tooltipY;
                if (point.plotX + labelWidth > this.chart.plotWidth) {
                    tooltipX = point.plotX + this.chart.plotLeft - labelWidth - 25;
                } else {
                    tooltipX = point.plotX + this.chart.plotLeft + 25;
                }
                //tooltipY = point.plotY + this.chart.plotTop - 20;
                tooltipY = this.chart.plotTop;
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
            margin: 0,
            yAxis: {
                tickPixelInterval: 5,
                min: 0,
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
                events: {
                    afterSetExtremes: function(event) {
                        console.log('navAfter')
                    },
                    setExtremes: function(event) {
                        console.log('navSet')
                    },

                }
            }
        },
        rangeSelector: {
            enabled: false,
        },
        navigation: {
            enabled: false,
        },
        scrollbar: {
            enabled: true,
            liveRedraw: false,
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
            gridLineWidth: 0,
            minorGridLineWidth: 0.5,
            minorTickInterval: 0.5,
            id: "ls",
            allowDecimals: false,
            title: {
                text: 'LS'
            },
            //            categories: [],
            //            type: "category",
            //            tickmarkPlacement: 'on',
            minRange: 20,//overriden
            //tickInterval: 1,
            events: {}
        }],
        yAxis: [{
            title: {
                text: 'Events'
            },
            type:'linear',
            showLastLabel: true,
            minPadding: 0,
            maxPadding: 0,
            id: "rates",
            height: "68%",
            lineWidth: 1,
            offset: 0,
            opposite: false,
            minorGridLineWidth: 0.7,
            gridLineWidth:1
        }, {
            title: {
                text: 'Micro %',
                margin: 20
            },
            showLastLabel: true,
            max: 100,
            min: 0,
            id: "micropercent",
            height: "6.5%",
            top: "72%",
            lineWidth: 1,
            offset: 0,
            opposite: false,
        }, {
            title: {
                text: 'Mini %',
                align: 'middle',
                margin: 10
            },
            showLastLabel: true,
            max: 100,
            min: 0,
            id: "minipercent",
            height: "6.5%",
            top: "79%",
            lineWidth: 1,
            offset: 0,
            opposite: true,
            labels: {
                align: 'center',
            }
        }, {
            title: {
                text: 'Macro %',
            },
            showLastLabel: true,
            minPadding: 0,
            maxPadding: 0,
            max: 100,
            min: 0,
            id: "macropercent",
            height: "6.5%",
            top: "86%",
            lineWidth: 1,
            offset: 0,
            opposite: false,
        }, {
            title: {
                text: 'Transfer %',
                align: 'middle',
                margin: 20
            },
            showLastLabel: true,
            //minPadding: 0,
            //maxPadding: 0,
            max: 100,
            min: 0,
            id: "transferpercent",
            height: "6.5%",
            top: "93%",
            lineWidth: 1,
            offset: 0,
            opposite: true,
            labels: {
                align: 'center'
            }
        }, {
            title: {
                text: 'Built Events' ,
                align: 'middle',
                margin: 10,
            },
            //type:'logarithmic',
            showLastLabel: true,
            //minPadding: 0,
            //maxPadding: 0,
            id: "ratesin",
            height: "68%",
            lineWidth: 1,
            offset: 0,
            minorGridLineWidth: 0.,
            gridLineWidth:0,
            opposite: true,
            labels:{align:'center'},
            //min:0
            //alignTicks:false
        }],
    })

    .constant('drillDownChartConfig', {

        chart: {
            renderTo: 'ddchart',
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
            followPointer: true,
        },
        legend: {
            enabled: false
        },


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
            type: "category"//,
            //labels:{rotation: 0}
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
            minPointLength: 10,
        }],
        drilldown: {
            series: []
        }
    })

    .constant('microStatesChartConfig', {
        chart: {
            renderTo: 'mschart',
            animation: false, //animation for stacked area is not supported
            ignoreHiddenSeries: true,
            //height: 400,
            zoomType: 'xy',
        },

        plotOptions: {
            column: {
                pointRange: 5500,
                gapsize: 0,
                stacking: 'percent',
                groupPadding: 0,
                pointPadding: 0,
                borderWidth: 0,
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
        },
        tooltip: {
            enabled:true,
            shared:true,
            folowPointer:false,
            crosshairs: [true, false], //not visible with the grid
            useHTML:true, 
            formatter: function(tooltip) {

                var items = this.points || splat(this);
                var series = items[0].series;
                var s=[];

                var sumHits=0;
                var totalShow = 0;
                items.forEach(function(item){
                  if (item.point.y<=0) return;
                  totalShow++;
                  sumHits += item.point.y;
                  
                });

                var table_open = false;
                var even_entry = true;

                // build the values
                s.push('<table><tbody>');
                items.forEach(function(item) {
                    if (item.point.y<=0) return;
                    var formatString;
                    var pref="";
                    var suf="";
                    if (totalShow>30) {
                    if (even_entry) {even_entry=false;pref="<tr>";}
                    else  {even_entry=true;suf="</tr>";}
                    }
                    else {pref="<tr>";suf="</tr>";}
                    var ss = "padding-right:3px;text-align:right";
                    formatString=pref+'<td style="padding-right:3px"><span style="color:'+item.series.color+'">●</span>'+item.series.name
                    +'</td><td style="'+ss+'"><b>'+(item.point.y*100/sumHits).toFixed(2)+'%'
                    +'</b></td>'
                    +suf;
                    s.push(formatString);
                    });
                if (!even_entry) s.push('</tr>');
                s.push('</tbody></table>')
                // footer
                s.push(tooltip.options.footerFormat || '');
                return s.join('');
            },
            //position on the left or right side of the point only with shared:false
            positioner: function(labelWidth, labelHeight, point) {
                var tooltipX, tooltipY;
                if (point.plotX + labelWidth > this.chart.plotWidth) {
                    tooltipX = point.plotX + this.chart.plotLeft - labelWidth - 25;
                } else {
                    tooltipX = point.plotX + this.chart.plotLeft + 25;
                }
                //tooltipY = point.plotY + this.chart.plotTop - 20;
                tooltipY = this.chart.plotTop;
                return {
                    x: tooltipX,
                    y: tooltipY
                };
            }
        },
        colors: Colors.colorList(),
        legend: {
            layout: "vertical",
            align: "right",
            verticalAlign: 'top',
            //floating: true,
            borderRadius: 5,
            borderWidth: 1,
            itemDistance: 5,
            symbolRadius: 5,

               labelFormatter: function(){
                
                    var s = this.name;
                    var r = "";
                    var lastAppended = 0;
                    var lastSpace = -1;
                    for (var i = 0; i < s.length; i++) {
                        if (s.charAt(i) == ' ') lastSpace = i;
                        if (i - lastAppended > 50) {
                            if (lastSpace == -1) lastSpace = i;
                            r += s.substring(lastAppended, lastSpace);
                            lastAppended = lastSpace;
                            lastSpace = -1;
                            r += "<br>";
                        }
                    }
                    r += s.substring(lastAppended, s.length);
                    return r;
               }

        },
        xAxis: {
            ordinal: false,
            //categories:[],
            minPadding: 0,
            maxPadding: 0,
            //category: true,
            type: 'datetime',
            tickmarkPlacement: 'on',
            //title: {
            //    enabled: false
            //}
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
            },
            tickInterval:5,
            minorGridLineWidth:0
        },
        series: [],
    })

    .constant('microStatesChartConfigNVD3', {
        chart: {
          type: "stackedAreaChart",
          style: "expand",
          visible : false, //default
          height: 450,
          margin: {
            top: 20,
            right: 55,
            bottom: 30,
            left: 55
          },
          x: (function(d) { return d[0] }),
          y: (function(d) { return d[1] }),
          useVoronoi: false,
          clipEdge: true,
          duration: 100,
          useInteractiveGuideline: true,
          xAxis: {
            showMaxMin: false,
            tickPadding: 15
          },
          yAxis: {},
          zoom: {
                  enabled: true,
                  scaleExtent: [
                          1,
                          10
                  ],
                  useFixedDomain: false,
                  useNiceScale: false,
                  horizontalOff: false,
                  verticalOff: true,
                  unzoomEventType: "dblclick.zoom"
          },
          color: Colors.colorListNVD3(),
          noData : "No monitoring information"
        }
    })


})();
