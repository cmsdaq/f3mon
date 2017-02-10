'use strict';

var do_destroyCharts=false;

var allPlot=null;
var allPlotCloud=null;
var allPlotBU=null;

var cpuPlots = []
var cpuPlotsCloud = []

var lastbinf=20

var binfrac = 1;
var sleeptime=2000

var textPre = "CPU frequency (MHz) - "
var textPost = ""

var timeoutVar = null;

var requesting = false;

var bootstrap_all = function() {

    $.ajaxSetup({
                headers : {   
                  'f3mon-compression' : 'true'
                }
    });

    $('#setups').buttonset();
    $('#variables').buttonset();

    $('#plots0').hide();
    $('#plots1').hide();
    $('#plots2').hide();
    $('#plots3').hide();
    $('#plots4').hide();
    $('#plots5').hide();
    $('#plotsbu').hide();

    $('#subdiv').html("Bin:"+binfrac*lastbinf);

    run_iteration();
}

var destroyCharts=function() {

  if (allPlot!=null) allPlot.destroy();
  if (allPlotCloud!=null) allPlotCloud.destroy();
  if (allPlotBU!=null) allPlotBU.destroy();
  for (var i=0;i<cpuPlots.length;i++) cpuPlots[i].destroy();
  for (var i=0;i<cpuPlotsCloud.length;i++) cpuPlotsCloud[i].destroy();
  allPlot=null;
  allPlotCloud=null;
  allPlotBU=null;
  cpuPlots = []
  cpuPlotsCloud = [];

  $('#plots0').hide();
  $('#plots1').hide();
  $('#plots2').hide();
  $('#plots3').hide();
  $('#plots4').hide();
  $('#plots5').hide();
  $('#plotsbu').hide();
 
}


var start = function() {

  if (do_destroyCharts) return;
  binfrac=1;
  do_destroyCharts=true;

  if (!requesting && timeoutVar!==null) {
    clearTimeout(timeoutVar);
    timeoutVar=null;
    run_iteration();
  }
  $('#subdiv').html("Bin:"+binfrac*lastbinf);

}


var start2 = function() {
  if (do_destroyCharts) return;
  do_destroyCharts=true;

  if (!requesting && timeoutVar!==null) {
    clearTimeout(timeoutVar);
    timeoutVar=null;
    run_iteration();
  }
  $('#subdiv').html("Bin:"+binfrac*lastbinf);

}

var biggerbins = function() {binfrac*=2;start2()}
var smallerbins = function() {binfrac/=2;start2()}

$( window ).resize(function() { start2()});


function genOptions(plotname,fumode,futype,serie,min,max,intv) {

  var xlabels='value'
  if (min===undefined && max==undefined) {
    //var xaxis = {type:'category',labels:{rotation: -45}}
    //var xaxis = {type:'category',labels:{rotation: -60}}
    var xaxis = {type:'category'}
    var sumfus=false;
  } else {
    var xaxis = {min:min,max:max}
    var sumfus=true;
  }
  return {
    chart:{
      type:'column',
      renderTo:plotname
    },
    series:[{data:serie,dataLabels:{enabled:false}}],
    legend:{
      enabled:false
    },
    title:{
      text:textPre+fumode+textPost+' - '+futype,
    },
    xAxis:xaxis,
    yAxis:{
      title:{
        text:(sumfus?"#FUs":"")
      },
      type: $('input[name=axistype]:checked', '#axistypes').val()
    },
    plotOptions:{
      column:{ 
        pointRange:intv
      }
    }
  }
}

function run_iteration(){

    //console.log($('input[name=variable]:checked', '#variables').val());

    if (do_destroyCharts) {
      destroyCharts();
      do_destroyCharts=false;
    }
    var selectedvar = $('input[name=variable]:checked', '#variables').val();

    var buplot=false;
    var min=0;
    var cpudetails=false;
    if (selectedvar.indexOf('_MHz_') > -1) {
      cpudetails=true;
      var max=3500;
      var binsize=20*binfrac
      lastbinf = 20;
      textPre = "CPU frequency (MHz) - "
    }
    else if (selectedvar==='cpu_usage_frac') {
      cpudetails=true;
      var max=1;
      var binsize=0.01*binfrac;
      lastbinf = 0.01;
      textPre = "CPU usage frac. - ";
    }
    else if (selectedvar==='memUsedFrac') {
      cpudetails=true;
      var max=1;
      var binsize=0.01*binfrac;
      lastbinf = 0.01;
      textPre = "Memory usage frac. - ";
    }
    else {
      buplot=true;
      var max=undefined;
      var buplotbinsize=1;
      var binsize=0.3*binfrac;
      lastbinf = 0.3;
      if (selectedvar==='dataNetOut') {max=undefined;binsize=0.01*binfrac;}
      textPre = "Network (MB/s) - "
    }

    //do not allow decimals with > 1
    if (binsize>1) binsize=Math.round(binsize);

    requesting=true;
    timeoutVar=null;
    $.getJSON("api/fuhistos?setup="+$('input[name=setup]:checked', '#setups').val()+'&interval='+binsize+'&monitored='+selectedvar+'&perbu='+buplot
      ,function(data) {
            requesting=false;


            if (do_destroyCharts) {timeoutVar = setTimeout(run_iteration,100);return;}
	    if(allPlot !== null){
                if (data["all"]["cpufreqhlt"]!=[])
		  allPlot.series[0].update({data:data["all"]["cpufreqhlt"]},true,false);
                //if (do_destroyCharts) timeoutVar = setTimeout(run_iteration,100);
                timeoutVar = setTimeout(run_iteration,sleeptime);
	    }else{
                $('#plots0').show()
                allPlot = new Highcharts.chart(genOptions('cpuplot1','HLT','all',data["all"]["cpufreqhlt"],min,max,binsize));
                if (data["all"]["cpufreqhlt"]!=[])
		  allPlot.series[0].setData(data["all"]["cpufreqhlt"],true,false);
                timeoutVar = setTimeout(run_iteration,100);
                //if (do_destroyCharts) timeoutVar = setTimeout(run_iteration,100);
                //else timeoutVar = setTimeout(run_iteration,100);
	    }

	    if(allPlotCloud !== null){
                if (data["all"]["cpufreqcloud"].length)
		  allPlotCloud.series[0].update({data:data["all"]["cpufreqcloud"]},true,false);
	    }else{
                allPlotCloud = new Highcharts.chart(genOptions('cpuplot2','CLOUD','all',data["all"]["cpufreqcloud"],min,max,binsize));
                if (data["all"]["cpufreqcloud"].length)
		  allPlotCloud.series[0].setData(data["all"]["cpufreqcloud"],true,false);
            }

            if (buplot)
	    if(allPlotBU !== null){
                if (data["perbu"].length)
		  allPlotBU.series[0].update({data:data["perbu"]},true,false);
	    }else{
                $('#plotsbu').show()
                allPlotBU = new Highcharts.chart(genOptions('perbuplot','HLT',' sum per BU appliance',data["perbu"],undefined,undefined,buplotbinsize));
                if (data["perbu"].length)
		  allPlotBU.series[0].setData(data["perbu"],true,false);
            }


            if (!cpudetails) return;

            //get rid of 'all' which is already plotted
            var vkeys = Object.keys(data).sort();
            var index = vkeys.indexOf('all');
            vkeys.splice(index, 1);

            index = vkeys.indexOf('perbu');
            vkeys.splice(index, 1);

            for (var i=0;i<vkeys.length;i++) {
	      if(cpuPlots.length <=i) {
                $('#plots'+(i+1)).show()
                var percpuPlot = new Highcharts.chart(genOptions('percpuplot'+i,'HLT',vkeys[i],data[vkeys[i]]["cpufreqhlt"],min,max,binsize));
                cpuPlots.push(percpuPlot);
                cpuPlots[i].series[0].setData(data[vkeys[i]]["cpufreqhlt"],true,false);
              }
              else 
                cpuPlots[i].series[0].update({data:data[vkeys[i]]["cpufreqhlt"]},true,false);

              if(cpuPlotsCloud.length <=i) {
                if (data[vkeys[i]].hasOwnProperty("cpufreqcloud") && data[vkeys[i]]["cpufreqcloud"].length)
                var percpuPlotCloud = new Highcharts.chart(genOptions('percpuplotcloud'+i,'CLOUD',vkeys[i],data[vkeys[i]]["cpufreqcloud"],min,max,binsize));
                else
                var percpuPlotCloud = new Highcharts.chart(genOptions('percpuplotcloud'+i,'CLOUD',vkeys[i],[],min,max,binsize));
                cpuPlotsCloud.push(percpuPlotCloud)
                if (data[vkeys[i]].hasOwnProperty("cpufreqcloud") && data[vkeys[i]]["cpufreqcloud"].length)
                  cpuPlotsCloud[i].series[0].setData(data[vkeys[i]]["cpufreqcloud"],true,false);
              }
              else
                if (data[vkeys[i]].hasOwnProperty("cpufreqcloud") && data[vkeys[i]]["cpufreqcloud"].length)
                  cpuPlotsCloud[i].series[0].update({data:data[vkeys[i]]["cpufreqcloud"]},true,false);
	    }
 

    })
} 
