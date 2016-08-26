var refseries=[];
var plots=[];


function bootstrap(){

    autoplot=false
    minmax=false
    //console.log(location.hash.length)
    if (location.hash.length) {
      var hashpos = location.hash.indexOf('run=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+4)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        $('#runno').val(hashstring);
        document.title = "run "+hashstring;
        autoplot=true

        var hashpos1 = location.hash.indexOf('minls=')
        var hashpos2 = location.hash.indexOf('maxls=')
        if (hashpos1!=-1 && hashpos2!=-1) { 
          minmax=true
          if (hashpos1!=-1) {
            var hashstring=location.hash.substr(hashpos1+6)
            if (hashstring.indexOf('&')!=-1)
              hashstring = hashstring.substr(0,hashstring.indexOf('&'))
            if (hashstring.length) {
              $('#minls').val(hashstring);
            }
          }
          if (hashpos2!=-1) {
            var hashstring=location.hash.substr(hashpos2+6)
            if (hashstring.indexOf('&')!=-1)
              hashstring = hashstring.substr(0,hashstring.indexOf('&'))
            if (hashstring.length) {
              $('#maxls').val(hashstring);
            }
          }
        }
      }
    }
    if (!autoplot) {
      document.title="";
      //$('#runno').val("");
      $('#minls').val("");
      $('#maxls').val("");
    }
    //if (!minmax)
      $('#fullrun').prop('checked',!minmax);
 
    //$("#loading_dialog").loading();
	    //    $('#loading_dialog').hide();
    $('#dialog').hide();
    $('#plots').hide();
    $('#runinfo').hide();
    $( "#radio2" ).buttonset();
    $('#target').submit(function(event){
            event.preventDefault();
            if ($('#runno').val()=="") {
              console.log('emptyrun!');
              location.hash='';
              $.getJSON("api/runInfo?sysName="+$('input[name=setup]:checked', '#setups').val()+"&activeRuns=true",function(adata){
	        if (adata.runNumber && !isNaN(run = parseInt(adata.runNumber))) {
                  document.title = 'run ' + adata.runNumber;
                  doPlots(adata.runNumber,$('#xaxis').val(),$('#yaxis').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	          $("#loading_dialog").loading();
                }
                else
                  document.title = 'no ongoing run!'
              });
            }
            else {
             document.title = 'run ' + $('#runno').val();
             doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	     $("#loading_dialog").loading();
            }
        });
    
    var timeout_rq;
    var run_iteration = function() {
        if (isNaN($('#runno').val()) || !$('#runno').val().length) return;
	$.getJSON("api/maxls?runNumber="+$('#runno').val(),function(data) {
          if (data.maxls!=null) {
            //console.log(JSON.stringify(data));
            $('#maxls').val(data.maxls);
            $('#minls').val(1);
          }
        });
    }
    $('#runno').bind("input",
      function(event){
        //console.log('input!')
        clearTimeout(timeout_rq);
        timeout_rq = setTimeout(run_iteration,330);
      }
    );

    $('#minls').prop('disabled',$('#fullrun').prop('checked'));
    $('#maxls').prop('disabled',$('#fullrun').prop('checked'));
    $('#fullrun').change(function(){
      $('#minls').prop('disabled',$(this).is(':checked'));
      $('#maxls').prop('disabled',$(this).is(':checked'));
    });
    if (autoplot) {
            //console.log('autoplotting')
            run_iteration();
            doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	    $("#loading_dialog").loading();
    }
    else
      run_iteration();

}

function setlink() {
    location.hash='run='+$('#runno').val();
    if (!$('#fullrun').prop('checked')) {
      location.hash+='&minls='+$('#minls').val();
      location.hash+='&maxls='+$('#maxls').val();
    } 
}

function doPlots(run,xaxis,yaxis,minls,maxls,fullrun){
    $.ajaxSetup({
	    async: true
		});
    plots=[];
    refseries.splice(0,refseries.length); //delete content of refseries array from previous doPlots
    if (!fullrun) var lspart="&minls="+minls+"&maxls="+maxls;
    else var lspart="&minls=&maxls="; 

    $.getJSON("php/lumi.php?run="+run,function(datadb){
      $('#fill').html(datadb.fill.data);


      //console.log(JSON.stringify(datadb["plumi1"]));
      var pileupmap = {};
      var minsb=0;
      var maxsb=0;
      var filterstable = $('#stable').is(':checked');
      if (datadb["plumi1"][0].data.length) {
        var minpu = datadb["plumi1"][0].data[datadb["plumi1"][0].data.length-1][1];
        //console.log(minpu)
        for (var j=0;j<datadb["plumi1"][0].data.length;j++) {
          item = datadb["plumi1"][0].data[j];
          var stable = datadb["run"][1].data[j][1];//stable beams
          if (stable && item[1]>minpu && item[1]>1.)//min PU value shown
           pileupmap[item[0]]=item[1];
          if (stable) {
            if (minsb==0 || minsb>item[0]) minsb=item[0];
            if (maxsb==0 || maxsb<item[0]) maxsb=item[0];
          }
        }
      }
      var sbpart = "";
      if (filterstable && minsb>0) sbpart="&minsb="+minsb+"&maxsb="+maxsb;

      //filter
      if (!fullrun || minsb) {
        var dvec;var nvec;
        dvec = datadb["lumi1"][0].data;
        nvec = [];
        for (var i=0;i<dvec.length;i++) if (dvec[i][0]>=minls && dvec[i][0]<=maxls && (!filterstable || (dvec[i][0]>=minsb && dvec[i][0]<=maxsb))) nvec.push(dvec[i]);
        datadb["lumi1"][0].data=nvec;
        dvec = datadb["plumi1"][0].data;
        nvec = [];
        for (var i=0;i<dvec.length;i++) if (dvec[i][0]>=minls && dvec[i][0]<=maxls && (!filterstable || (dvec[i][0]>=minsb && dvec[i][0]<=maxsb))) nvec.push(dvec[i]);
        datadb["plumi1"][0].data=nvec;
      }
      plot('#plot1','inst lumi vs ls','line',datadb["lumi1"]);
      plot('#plot1a','pileup vs ls','line',datadb["plumi1"]);

      pippo=$.getJSON("php/applianceplots.php?run="+run+"&setup="+$('input[name=setup]:checked', '#setups').val()+lspart+sbpart,function(data){

	    if(data.runinfo.start !=null){
		$('#runinfo').show();		
		$('#run').html(data.runinfo.run);
		$('#start').html(data.runinfo.start);
		$('#end').html(data.runinfo.end+'<br>('+data.runinfo.ongoing+')');
		$('#duration').html(data.runinfo.duration);
		$('#unit').html(data.runinfo.interval);

		plot('#plot3','ramdisk','line',data["ramdisk"],'datetime','time','fraction used',undefined,undefined,0,undefined);
		plot('#plot3a','output to BU','line',data["outputbw"],'datetime','time','MB/s',undefined,undefined,0,undefined);
		plot('#plot2','aggregated rate from eol','line',data["ratebytotal"],undefined,undefined,0,undefined);
		plot('#plot10a','fu sys CPU usage/budget avg','line',data["fusyscpu2"],'datetime','time','fraction',undefined,undefined,0,undefined);
		plot('#plot10b','fu sys avg event time','line',data["fuetime"],'datetime','time','seconds',undefined,undefined,0,undefined);
		plot('#plot12','fu data input','line',data["fudatain"],'datetime','time','MB/s',undefined,undefined,0,undefined);

		//combine with PU
                //console.log(JSON.stringify(data["fuetimels"][0]))
		var datavec = []
                var origvec = data["fuetimels"][0].data

                //console.log(JSON.stringify(data["fuetimels"][0].data));
		for (var i=0;i<origvec.length;i++) {
                  var ls = origvec[i][0];
                  if (pileupmap.hasOwnProperty(ls))
                    datavec.push([pileupmap[ls],origvec[i][1]])
                    
                }
                datavec.sort(function(a, b){return a[0]>b[0]});
                data["fuetimels"][0].data = datavec;

		var datavec = []
                var origvec = data["fuetimels"][1].data
                //console.log(JSON.stringify(data["fuetimels"][0].data));
		for (var i=0;i<origvec.length;i++) {
                  var ls = origvec[i][0];
                  if (pileupmap.hasOwnProperty(ls))
                    datavec.push([pileupmap[ls],origvec[i][1]])
                    
                }
                datavec.sort(function(a, b){return a[0]>b[0]});
                data["fuetimels"][1].data = datavec;

                
                data["fuetimels2"]=[];
                for (var j=0;j<data["fuetimelsres"].length;j++) {
		  datavec = []
                  origvec = data["fuetimelsres"][j].data;
                  //console.log(JSON.stringify(data["fuetimels2"][j]));
		  for (var i=0;i<origvec.length;i++) {
                    var ls = origvec[i][0];
                    if (pileupmap.hasOwnProperty(ls))
                      datavec.push([pileupmap[ls],origvec[i][1]])
                  }
                  datavec.sort(function(a, b){return a[0]>b[0]});
                  //data["fuetimels2"][j].data = datavec;
                  data["fuetimels2"].push({'name': data["fuetimelsres"][j].name, 'data' : datavec});
                }

		plot('#plot13','fu sys avg event time vs pileup','scatter',data["fuetimels2"],'','pileup','seconds',undefined,50,0,0.5);
		plot('#plot14','fu event time (BUs)','line',data["fuetimelsbu"],'','LS','seconds',undefined,undefined,0,undefined);
		plot('#plot15','fu event time (appliance/resources)','line',data["fuetimelsres"],'','LS','seconds',undefined,undefined,0,undefined);
		plot('#plot16','fu sys CPU usage (appliance/resources)','line',data["fucpures"],'','LS','fraction',undefined,undefined,0,undefined);
		plot('#plot17','fu CPU budget (appliance/resources)','line',data["fucpures2"],'','LS','fraction',undefined,undefined,0,undefined);
                
	    }else{
		$('#run').html(data.runinfo.run);
		$('#start').html('not found / not started');
		$('#runinfo').show();		
	    }
	    $("#loading_dialog").loading("loadStop");
	    $('#plots').show();
	});
    });

}

function makeSeriesMap(series){
}

function plot(tag,title,type,data,xaxis,xtitle,ytitle,xmin,xmax,ymin,ymax) {
    xaxis = typeof xaxis !== 'undefined' ? xaxis : '';
    xtitle = typeof xtitle !== 'undefined' ? xtitle : 'LS';
    ytitle = typeof ytitle !== 'undefined' ? ytitle : 'A.U.';
    plottype = type;
    plotoptions = type == 'column' ? {
	column: {
	    pointPadding: 0,
	    borderWidth: 0,
	    groupPadding: 0,
	    shadow: false
	}
    } : 
    {
	series: {
	    events: {
		legendItemClick: function(event) {
		    event.preventDefault();
		    if (!this.visible)
			return false;
		    
		    var seriesIndex = this.index;
		    var series = this.chart.series;
		    
		    $.each(series,function(i,val)
			{
			    if (series[i].index != seriesIndex)
				{
				    series[i].visible ?
					series[i].setVisible(false,false) :
					series[i].setVisible(true,false);
				} 
			});
		    return false;
		}
	    }
	}
    };

    chartvar = {

	    chart: { 
		animation : {
		    duration : 500
		},
		type: plottype,
		zoomType: 'xy'
	    },
	    plotOptions: plotoptions,
	    xAxis: {
		type: xaxis,
		title : {text : xtitle}
	    },
	    yAxis: {
		title : {text : ytitle}
	    },
	    title: {
		text: title,
		x: -20 //center
	    },
	    subtitle: {
		text: 'Source: elasticsearch main',
		x: -20
	    },
	    legend: {
		layout: 'vertical',
		align: 'right',
		verticalAlign: 'middle',
		borderWidth: 0
	    },
	    series: data
    };
    if (xmin!==undefined) chartvar.xAxis["min"]=xmin;
    if (xmax!==undefined) chartvar.xAxis["max"]=xmax;
    if (ymin!==undefined) chartvar.yAxis["min"]=ymin;
    if (ymax!==undefined) chartvar.yAxis["max"]=ymax;

    var chart = $(tag).highcharts(chartvar);
    plots.push($(tag).highcharts());
    return chart;
}
