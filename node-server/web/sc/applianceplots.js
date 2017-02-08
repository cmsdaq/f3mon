'use strict';

var plots=[];
var year_start = 2015;

function parseHash(key) {
	var hashpos = location.hash.indexOf(key+"=");
	if (hashpos==-1) return undefined;
	var hashstring=location.hash.substr(hashpos+key.length+1);
	if (hashstring.indexOf('&')!=-1)
		hashstring = hashstring.substr(0,hashstring.indexOf('&'))
	//if empty string is valid value, caller needs to verify undefined vs empty string
	return hashstring;
}

function bootstrap() {

	$.ajaxSetup({
		async: true
	});

	Highcharts.setOptions(Highcharts.theme_du);

	var year_current = parseInt(new Date().getFullYear());
	for (var i=year_current;i>=year_start;i--) {
		var o = new Option(i,i);
		//$(o).html("option text");
		$('#index').append(o);
	}

	var autoplot=false
	var minmax=false
	//console.log(location.hash.length)

	if (location.hash.length) {

		var rn_val = parseHash('run')
		if (rn_val) {
			$('#runno').val(rn_val);
			document.title = "run "+rn_val;
			autoplot=true

			var minls_val = parseHash('minls')
			var maxls_val = parseHash('maxls')
			if (!isNaN(minls_val) && !isNaN(maxls_val)) {
				minmax=true;
				$('#minls').val(minls_val);
				$('#maxls').val(maxls_val);
			}

			var index_val = parseHash('index');
			if (index_val) $('#index').val(index_val);

			var setup_val = parseHash('setup');
			//if (setup_val) $('#setup').val(setup_val);
			if (setup_val) $('#'+setup_val).attr("checked", "checked");

		}
	}
	if (!autoplot) {
		document.title="";
		//$('#runno').val("");
		$('#minls').val("");
		$('#maxls').val("");
	}
	$('#fullrun').prop('checked',!minmax);

	$('#dialog').hide();
	$('#plots').hide();
	$('#runinfo').hide();
	$( "#radio2" ).buttonset();

	$('#target').submit(function(event){

		event.preventDefault();
		if ($('#runno').val()=="") {
			console.log('emptyrun!');
			location.hash='';
			var mysetup = $('input[name=setup]:checked', '#setups').val();
			var year = $('#index').val();
			if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
			$.getJSON("api/runInfo?sysName="+mysetup+"&activeRuns=true",function(adata){
				if (adata.runNumber && !isNaN(run = parseInt(adata.runNumber))) {
					document.title = 'run ' + adata.runNumber;
					$.getJSON("api/maxls?runNumber="+adata.runNumber+"&setup="+mysetup,function(bdata) {
						doPlots(adata.runNumber,1,bdata.maxls,$('#fullrun').is(':checked'));
					});
					$("#loading_dialog").loading();
				}
				else
					document.title = 'no ongoing run!'
			});
		}
		else {
			document.title = 'run ' + $('#runno').val();
			//can be multiple runs
			console.log('plotting')
			doPlots($('#runno').val(),$('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
			$("#loading_dialog").loading();
		}
	});

	var timeout_rq;
	var run_iteration = function(cb) {
		if (isNaN($('#runno').val()) || !$('#runno').val().length) return;
		var mysetup = $('input[name=setup]:checked', '#setups').val();
		var year = $('#index').val();
		if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
		else if (mysetup==="cdaq" && parseInt($('#runno').val())<=286591) mysetup="cdaq2016";//will leave this, but will not automatically work for other years
		$.getJSON("api/maxls?runNumber="+$('#runno').val()+"&setup="+mysetup,function(data) {
			if (data.maxls!=null) {
				//console.log(JSON.stringify(data));
				$('#maxls').val(data.maxls);
				$('#minls').val(1);
			}
			if (cb!==undefined) cb();
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
		console.log('autoplotting')
		var callb = function() {
			doPlots($('#runno').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
		}
		if ($('#runno').val().indexOf(',')!==-1) callb();
	else
		run_iteration(callb);//pass callback to run after maxls is retrieved
	$("#loading_dialog").loading();
	}
	else
		run_iteration();

}

function setlink() {
	location.hash='run='+$('#runno').val();
	location.hash+='&index='+$('#index').val();
	location.hash+='&setup='+$('input[name=setup]:checked', '#setups').val();
	if (!$('#fullrun').prop('checked') && $('#minls').val() && $('#maxls').val()) {
		location.hash+='&minls='+$('#minls').val();
		location.hash+='&maxls='+$('#maxls').val();
	} 
}

var data_copy = {};
var htmlruns = [];
var htmldur=0;

function doPlots(runstr,minls,maxls,fullrun)
{
	$('#start').html("");
	//cleanup
	for (var i=0;i<plots.length;i++) plots[i].destroy();
	plots=[];
	data_copy = {}
	htmlruns = [];
	htmldur=0;
	var htmlticks=0;
	if (runstr)
		var list_of_runs = runstr.split(',');
	else var list_of_runs = []
	if (list_of_runs.length>1)
		doPlot(list_of_runs,-1,-1,true,true,true);
	else
		doPlot(list_of_runs,minls,maxls,fullrun,false,false);
}

function doPlot(runs,minls,maxls,fullrun,force_time_axis,multirun){
	if (runs.length==0 || runs.length==1 && runs[0]=='') {
		//finalize and plot 
		//finished
		return
	}
	run = runs[0]
	runs = runs.splice(1)

	if (!fullrun) var lspart="&minls="+minls+"&maxls="+maxls;
	else var lspart="&minls=&maxls="; 

	$.getJSON("php/lumi.php?run="+run,function(datadb){
		//console.log('0 '+JSON.stringify(datadb.plumi1[0]));
		$('#fill').html(datadb.fill.data);
		var pileupmap = {};
		var minsb=0;
		var maxsb=0;
		var filterstable = $('#stable').is(':checked');
		var sbpart = "";

		if (datadb["plumi1"][0].data.length) {
			var minpu = datadb["plumi1"][0].data[datadb["plumi1"][0].data.length-1][1];
			//console.log(minpu)
			for (var j=0;j<datadb["plumi1"][0].data.length;j++) {
				var item = datadb["plumi1"][0].data[j];
				var stable = datadb["run"][1].data[j][1];//stable beams
				if (stable && item[1]>minpu && item[1]>1.)//min PU value shown
					pileupmap[item[0]]=item[1];
				if (stable) {
					if (minsb==0 || minsb>item[0]) minsb=item[0];
					if (maxsb==0 || maxsb<item[0]) maxsb=item[0];
				}
			}
		}

		//maxls and minls query doesn't work currently with multirun
		if (multirun) minsb=0;
		if ($('#timeaxis').is(':checked')) multirun=true;

		if (multirun)
			var multipart = "&multirun=1";
		else
			var multipart = "&multirun=0";

		//filter
		if (!fullrun || minsb) {
			var dvec;var nvec;
			dvec = datadb["lumi1"][0].data;
			nvec = [];
			for (var i=0;i<dvec.length;i++) if ((maxls=="" || (dvec[i][0]>=minls && dvec[i][0]<=maxls)) && (!filterstable || (dvec[i][0]>=minsb && dvec[i][0]<=maxsb))) nvec.push(dvec[i]);
			datadb["lumi1"][0].data=nvec;
			dvec = datadb["plumi1"][0].data;
			nvec = [];
			for (var i=0;i<dvec.length;i++) if ((maxls=="" || (dvec[i][0]>=minls && dvec[i][0]<=maxls)) && (!filterstable || (dvec[i][0]>=minsb && dvec[i][0]<=maxsb))) nvec.push(dvec[i]);
			datadb["plumi1"][0].data=nvec;
		}

		if (!multirun) {
			plot('#plot1','inst lumi vs ls','line',datadb["lumi1"],'','LS','',undefined,undefined,undefined,undefined);
			plot('#plot1a','pileup vs ls','line',datadb["plumi1"]);
			if (filterstable && minsb>0) sbpart="&minsb="+minsb+"&maxsb="+maxsb;
		}

		var my_setup = $('input[name=setup]:checked', '#setups').val();
		var year = $('#index').val();
		if (year!=='current') {my_setup=my_setup+year;console.log('mysetup ' + mysetup);}
		else if (my_setup==="cdaq" && parseInt(run)<=286591) my_setup="cdaq2016";//hack - will be replaced by year selector

		var pippo=$.getJSON("php/applianceplots.php?run="+run+"&setup="+my_setup+lspart+sbpart+multipart,function(data) {

			if(data.runinfo.start !=null){

				data["lumi1"]=[ {name:datadb["lumi1"][0].name,data:[]}];
				data["plumi1"]=[{name:datadb["plumi1"][0].name,data:[]}];

				if (multirun) {
					datadb.lumi1[0].data.forEach(function(item) {
						if (data.lstimes.hasOwnProperty(item[0]))
							data.lumi1[0].data.push([data.lstimes[item[0]],item[1]]);
					});
					datadb.plumi1[0].data.forEach(function(item) {
						if (data.lstimes.hasOwnProperty(item[0]))
							data.plumi1[0].data.push([data.lstimes[item[0]],item[1]])
					});
				}
				//console.log('2 '+JSON.stringify(data.lumi1[0]));
				{
					//combine with PU
					var datavec = []
					var origvec = data["fuetimels"][0].data
					for (var i=0;i<origvec.length;i++) {
						var ls = origvec[i][0];
						if (pileupmap.hasOwnProperty(ls))
							datavec.push([pileupmap[ls],origvec[i][1]])
					}
					datavec.sort(function(a, b){return a[0]>b[0]});
					data["fuetimels"][0].data = datavec;
					var datavec = []
					var origvec = data["fuetimels"][1].data
					for (var i=0;i<origvec.length;i++) {
						var ls = origvec[i][0];
						if (pileupmap.hasOwnProperty(ls))
							datavec.push([pileupmap[ls],origvec[i][1]])
					}
					datavec.sort(function(a, b){return a[0]>b[0]});
					data["fuetimels"][1].data = datavec;
					data["fuetimels2"]=[];
					//for (var j=0;j<data["fuetimelsres"].length;j++) {
						if (data.fuetimelsresls)
							for (var j=0;j<data["fuetimelsresls"].length;j++) {
								//console.log('x'  + data["fuetimelsresls"][j].name)
								datavec = []
								//origvec = data["fuetimelsres"][j].data;
								origvec = data["fuetimelsresls"][j].data;
								for (var i=0;i<origvec.length;i++) {
									var ls = origvec[i][0];
									if (pileupmap.hasOwnProperty(ls))
										datavec.push([pileupmap[ls],origvec[i][1]])
								}
								datavec.sort(function(a, b){return a[0]>b[0]});
								//use name from non-LS array
								data["fuetimels2"].push({'name': data["fuetimelsres"][j].name, 'data' : datavec});
								//data["fuetimels2"].push({'name': data["fuetimelsresls"][j].name, 'data' : datavec});
							}
				}

				var merge_whitelist = ["fusyscpu2","fudatain","fuetime","ramdisk","outputbw","fuetimelsres","fucpures","fucpures2","ratebytotal","lumi1","plumi1","fuetimels2"]

				merge_whitelist.forEach(function(hitem) {
					console.log(Object.keys(data[hitem]))
					if (!data_copy.hasOwnProperty(hitem)) {
						data_copy[hitem]=data[hitem];
					}
					else {
						Object.keys(data[hitem]).forEach(function(item) {
							if (!data_copy[hitem].hasOwnProperty(item))
								data_copy[hitem][item] = data[hitem][item]
							else {
								var reverse = false;
								if (data_copy[hitem][item]['data'].length && data[hitem][item]['data'].length)
									if (data_copy[hitem][item]['data'][0][0] > data[hitem][item]['data'][0][0]) reverse=true;

								if (hitem=="fuetimels2") reverse = !reverse; //pu is dropping

								if (reverse) data_copy[hitem][item]['data'] = data[hitem][item]['data'].concat(data_copy[hitem][item]['data']);
								else data_copy[hitem][item]['data'] = data_copy[hitem][item]['data'].concat(data[hitem][item]['data']);
							}

						});

					}
				});

				if (htmlruns.length==0) $('#start').html(data.runinfo.start);
				htmlruns.push(data.runinfo.run)
				htmldur+=parseInt(data.runinfo.duration)

				if (runs.length) {
					doPlot(runs,-1,-1,true,true,true);
					return;
				}


				$('#runinfo').show();
				$('#run').html(htmlruns.join());
				$('#start').html(data.runinfo.start);
				$('#end').html(data.runinfo.end);
				$('#duration').html(htmldur);
				//$('#unit').html(data.runinfo.interval);


				plot('#plot10a','fu sys CPU usage/budget avg','line',data_copy["fusyscpu2"],'datetime','time','fraction',undefined,undefined,0,undefined);
				plot('#plot12','fu data input','line',data_copy["fudatain"],'datetime','time','MB/s',undefined,undefined,0,undefined);
				plot('#plot10b','fu sys avg event time','line',data_copy["fuetime"],'datetime','time','seconds',undefined,undefined,0,undefined);
				plot('#plot3','ramdisk','line',data_copy["ramdisk"],'datetime','time','fraction used',undefined,undefined,0,undefined);
				plot('#plot3a','output to BU','line',data_copy["outputbw"],'datetime','time','MB/s',undefined,undefined,0,undefined);

				plot('#plot15','fu event time (appliance/resources)','line',data_copy["fuetimelsres"],multirun ? 'datetime':'',multirun?'time':'LS','seconds',undefined,undefined,0,undefined);
				plot('#plot16','fu sys CPU usage (appliance/resources)','line',data_copy["fucpures"],multirun ? 'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				plot('#plot17','fu CPU budget (appliance/resources)','line',data_copy["fucpures2"],multirun?'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				plot('#plot2','aggregated rate from eol','line',data_copy["ratebytotal"],multirun?'datetime':'',multirun?'time':'LS','events/s',undefined,undefined,0,undefined);

				if (multirun) {
					plot('#plot1','inst lumi vs ls','line',data_copy["lumi1"],'datetime','time','',undefined,undefined,undefined,undefined);
					plot('#plot1a','pileup vs ls','line',data_copy["plumi1"],'datetime','time','',undefined,undefined,undefined,undefined);
				}

				plot('#plot13','fu sys avg event time vs pileup','scatter',data_copy["fuetimels2"],'','pileup','seconds',undefined,50,0,0.5);

			}else{
				console.log('run not found?')
				//for (var i=0;i<plots.length;i++) plots[i].destroy();
				//plots=[];
				$('#run').html(data.runinfo.run);
				$('#start').html('not found / not started');
				$('#runinfo').show();		
			}
			$("#loading_dialog").loading("loadStop");
			$('#plots').show();
		});
	});

}

function plot(tag,title,type,data,xaxis,xtitle,ytitle,xmin,xmax,ymin,ymax) {
	xaxis = typeof xaxis !== 'undefined' ? xaxis : '';
	xtitle = typeof xtitle !== 'undefined' ? xtitle : 'LS';
	ytitle = typeof ytitle !== 'undefined' ? ytitle : 'A.U.';
	var plottype = type;
	var plotoptions = type == 'column' ? {
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

	var chartvar = {

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
