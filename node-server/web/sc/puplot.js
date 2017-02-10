'use strict';

var refseries=[];
var plots=[];

var runlsinfo = {};

var year_start = 2016;

function parseHash(key) {
	var hashpos = location.hash.indexOf(key+"=");
	if (hashpos==-1) return undefined;
	var hashstring=location.hash.substr(hashpos+key.length+1);
	if (hashstring.indexOf('&')!=-1)
		hashstring = hashstring.substr(0,hashstring.indexOf('&'))
	//if empty string is valid value, caller needs to verify undefined vs empty string
	return hashstring;
}

function bootstrap(){

	$.ajaxSetup({
                headers : {   
                  'f3mon-compression' : 'true'
                }
	});

	var autoplot=false;
	var templsmap = {}

	var year_current = parseInt(new Date().getFullYear());
	for (var i=year_current;i>=year_start;i--) {
		var o = new Option(i,i);
		//$(o).html("option text");
		$('#index').append(o);
	}

	if (location.hash.length) {

		//parse plotting theme
		var themes = {};
		$("input[name='hctheme']").each(function() {
			themes[$(this).val()]=true;
		});
		//console.log(themes)
		var theme_val = parseHash('theme')
		if (theme_val && themes.hasOwnProperty(theme_val)) $('#'+theme_val).attr('checked',true);

		//parse run and ls list
		var run_val = parseHash('run')
		if (run_val) {
			//multirun mode
			var rnsarr = [];
			var rns = run_val.split(',');
			rns.forEach(function(rn){
				if (rn.indexOf(':')!=-1) {
					var rntokens = rn.split(':')
					rnsarr.push(rntokens[0]);
					templsmap[rntokens[0]]=[true,
					                        rntokens[1]=="true"?true:false,
					                        rntokens[2]=="true"?true:false,
								parseInt(rntokens[3]),
								parseInt(rntokens[4])
							       ];
					// console.log('rntokens:'+rntokens[0] + JSON.stringify(templsmap[rntokens[0]]))
				}
				else rnsarr.push(rn);
			});
			$('#runno').val(rnsarr.join(','));
			document.title = "run "+run_val;
			autoplot=true

			var index_val = parseHash('index');
			if (index_val) $('#index').val(index_val);

		}
	}
	if (!autoplot) {
		document.title="";
		//$('#runno').val("");
	}

	$('#dialog').hide();
	$('#plots').hide();
	$('#runinfo').hide();
	$( "#radio2" ).buttonset();
	$('#target').submit(function(event){
		event.preventDefault();
		$("#loading_dialog").loading();
		doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val());
	});

	var makeTable = function(newcache) {
		runlsinfo = newcache;
		//inject parsed info
		Object.keys(runlsinfo).forEach(function(item) {
			if (templsmap.hasOwnProperty(item))
				runlsinfo[item]=templsmap[item];
		});
		templsmap = {};
		$("#runinfo2 > tbody").html("");
		$('#runinfo2 > tbody:last-child').append('<tr><th>Runs</th><th>LS from</th><th>LS to</th><th>full range</th><th>include</th>');
		Object.keys(runlsinfo).sort().forEach(function(item) {
			var obj = runlsinfo[item];
			if (obj[0]) {
				var in1 ='<input size="4" class="pure-form" id="minls'+item+'" action="" value="'+obj[3]+'" change="toggleMinLS(this)"/>';
				var in2 ='<input size="4" class="pure-form" id="maxls'+item+'" action="" value="'+obj[4]+'" change="toggleMaxLS(this)"/>';
				var in3 ='<input type="checkbox" id="fullr'+item+'" name="alternative" checked="'+obj[2]+'" onchange="toggleFull(this)"/>';
				var in4 ='<input type="checkbox" id="include'+item+'" name="alternative" checked="'+obj[1]+'" onchange="toggleInclude(this)"/>';
				$('#runinfo2 > tbody:last-child').append('<tr><td>'+item+'</td><td>'+in1+'</td><td>'+in2+'</td> <td>'+in3+'</td> <td>'+in4+'</td> </tr><tr>');
				$("#minls"+item).bind("input",function(event){toggleMinLS(this)});
				$("#maxls"+item).bind("input",function(event){toggleMaxLS(this)});
				$("#fullr"+item).prop('checked',obj[2]);
				$("#include"+item).prop('checked',obj[1]);
			}
		});

		if (autoplot) {
			//console.log('autoplotting')
			autoplot=false;
			$("#loading_dialog").loading();
			doPlots($('#runno').val());
		}
	}

	var timeout_rq;
	var runs_iteration = function() {
		var newcache = {}
		var nruns = 0;
		var runslist = $('#runno').val().split(',');
		var checkruns=[];
		runslist.forEach(function(item) {
			var runslist2 = item.split(' ');
			runslist2.forEach(function(item) {
				if (!item.length || isNaN(item)) return;
				nruns++;
				var rn = parseInt(item);
				if (runlsinfo.hasOwnProperty(rn)) {
					var cached = runlsinfo[rn];
					newcache[rn] = cached;
				}
				else {
					checkruns.push(rn)
				}
			});
		});
		//if (Object.keys(newcache).length == nruns) makeTable(newcache);
		var checkRun = function(runs) {
			var rn = runs[0];
			runs = runs.splice(1);
			var setup_string = "cdaq";

			var year = $('#index').val();
			if (year!=='current') {setup_string=setup_string+year;console.log('mysetup ' + mysetup);}
                        else if (rn<=286591) setup_string="cdaq2016";

			$.getJSON("api/maxls?runNumber="+rn+"&setup="+setup_string,function(data) {
				if (data.maxls!=null)
					newcache[rn] = [true,true,true,1,data.maxls];
				else
					newcache[rn] = [false,false,false,1,data.maxls];
				if (!runs.length) {
					makeTable(newcache);
				}
				else checkRun(runs);
			});
		}
		if (checkruns.length) checkRun(checkruns);
	else 
		makeTable(newcache);
	}
	$('#runno').bind("input",
		function(event){
			clearTimeout(timeout_rq);
			timeout_rq = setTimeout(runs_iteration,330);
		}
	);
	runs_iteration();
	$("#runinfo2").hide();
}

function setlink() {
	//console.log($('#runno').val())
	if (!Object.keys(runlsinfo).length) {location.hash="";return;}
	var hstrvec = []
	Object.keys(runlsinfo).forEach(function(item) {
		var entry = runlsinfo[item];
		if (entry[0]) {
			if (entry[1] && entry[2]) hstrvec.push(item);
			else hstrvec.push([item,entry[1],entry[2],entry[3],entry[4]].join(':'));
		}
	});
	location.hash='run='+hstrvec.join(',');
	if ($('#blue').is(':checked'))
	        location.hash+="&theme=blue"
	else if ($('#black').is(':checked'))
	        location.hash+="&theme=black"
	if ($('#white').is(':checked'))
	        location.hash+="&theme=white"

	location.hash+='&index='+$('#index').val();

}

function setThemeHash(theme) {
        var loc = location.hash.indexOf("theme=");
	if (loc==-1) {
	  if (location.hash.indexOf('run=')!=-1) location.hash+="&";
	  location.hash+="theme="+theme
	}
	else
	  location.hash = location.hash.substring(0,loc)+"theme="+theme 
}

function toggleMinLS(obj) {
	runlsinfo[obj.id.substring(5)][3]=parseInt(obj.value);
}

function toggleMaxLS(obj) {
	runlsinfo[obj.id.substring(5)][4]=parseInt(obj.value);
}

function toggleFull(obj) {
	runlsinfo[obj.id.substring(5)][2]=!runlsinfo[obj.id.substring(5)][2]
}

function toggleInclude(obj) {
	runlsinfo[obj.id.substring(7)][1]=!runlsinfo[obj.id.substring(7)][1]
}

var data_copy = {}
var data_copy2 = {}
var method1 = true;
var manyruns;
var minpu1;
var runlist_copy;
var hadsomething=false;
var pumask=[];

function doPlots(runs){
	//console.log('H-:'+location.hash);
	//(re)apply highcharts theme
	if ($('#blue').is(':checked'))
		Highcharts.setOptions(Highcharts.theme_db);
	else if ($('#black').is(':checked'))
		Highcharts.setOptions(Highcharts.theme_du);
	else
		Highcharts.setOptions(undefined);

	pumask=[];
	var pumaskstr=$('#maskpu').val();
	pumaskstr.split(',').forEach(function(item) {
	        if (!item) return;
		var tks = item.split('-');
		//console.log(item + ' : '+ tks.length)
		if (!tks.length) return;
		else if (tks.length!=2) {
			if (tks.length==1) {
				var pval1=parseFloat(tks[0])//-0.00001;
				var pval2=parseFloat(tks[0])+0.01;
				if (isNaN(pval1) || isNaN(pval2)) console.log('could not parse' + tks)
					else pumask.push([pval1,pval2]);
			} else
				console.log('could not parse '+ item)
		}
		else {
			var pval1=parseFloat(tks[0])//-0.00001;
			var pval2=parseFloat(tks[1])//+0.00001;
			if (isNaN(pval1) || isNaN(pval2)) console.log('could not parse' + tks)
				else pumask.push([pval1,pval2]);
		}
	});
	console.log('pumask ' + JSON.stringify(pumask));

	//if (location.hash.length)  setlink();//override last haslink run
	plots=[];
	method1 = !$('#alternative').is(':checked');
	data_copy = {};
	data_copy2 = {};
	refseries.splice(0,refseries.length); //delete content of refseries array from previous doPlots
	manyruns = $('#runno').val().split(',').length>1;
	minpu1=-1;
	runlist_copy = JSON.parse(JSON.stringify(runlsinfo)); 
	//console.log('X:'+JSON.stringify(runlsinfo))
	var runlist_keys = Object.keys(runlist_copy).sort();
	//doPlot($('#runno').val().split(','))
	if (runlist_keys.length>0)
		doPlot(runlist_keys)
	else {
		$("#loading_dialog").loading("loadStop");
	}
}


function createPlots() {

	var maxpu_plot = 60;
	var maxpu_2 = 50;
	var maxpu_3 = 60;
	var minpu_2 = 20;
	if ($("#pPb").is(':checked')) {
		console.log('pb PU limits')
		maxpu_plot=0.5
		maxpu_2=0.4
		maxpu_3=0.5
		minpu_2=0.01
	}
	var maxpu =  $('#maxpu').val();
	var maxpu_glob = maxpu;
	if (!$("#pPb").is(':checked')) {
		if (isNaN(parseInt(maxpu))) {if ($("#fitputime").is(':checked')) maxpu=maxpu_3; else maxpu=maxpu_2;} else maxpu=parseInt(maxpu);
		if (parseInt(maxpu)<minpu_2) maxpu=minpu_2; else maxpu=parseInt(maxpu);
		if (!isNaN(parseInt(maxpu))) maxpu_plot=parseInt(maxpu);
	}
	else {
		if (isNaN(parseFloat(maxpu))) {if ($("#fitputime").is(':checked')) maxpu=maxpu_3; else maxpu=maxpu_2;} else maxpu=parseFloat(maxpu);
		if (parseFloat(maxpu)<minpu_2) maxpu=minpu_2; else maxpu=parseFloat(maxpu);
		if (!isNaN(parseFloat(maxpu))) maxpu_plot=parseFloat(maxpu);
	}

	console.log(JSON.stringify(data_copy.fuetimels))
	if ($("#fitputime").is(':checked')) {
		//data_copy["fuetimels"][0].showInLegend=false;
		data_copy["fuetimels"][0].regression=true;
		data_copy["fuetimels"][0].regressionSettings = {
			type: 'polynomial',
			color: 'rgba(223, 83, 83, .9)',
			useAllSeries:true,
			extrapolate:30,
			step:1,
			xmax:maxpu_plot
		}
		if (method1) {
			data_copy["fuesizels"][0].regression=true;
			data_copy["fuesizels"][0].regressionSettings = {
				type: 'polynomial',
				color: 'rgba(223, 83, 83, .9)',
				useAllSeries:true,
				extrapolate:30,
				step:1,
				xmax:maxpu_plot,
				order:1
			}}
	}
	//var maxpu =  $('#maxpu').val();
	//maxpu_glob = maxpu;
	//if (isNaN(parseInt(maxpu))) {if ($("#fitputime").is(':checked')) maxpu=60; else maxpu=50;} else maxpu=parseInt(maxpu);
	//if (parseInt(maxpu)<20) maxpu=20; else maxpu=parseInt(maxpu);
	plot('#plot13','fu sys avg event time vs pileup','scatter',data_copy["fuetimels"],'','Pileup','seconds',undefined,maxpu,0,(!$("#pPb").is(':checked')) ? 0.5:0.8);
	if (method1)
		plot('#plot15','avg event size vs pileup','scatter',data_copy["fuesizels"],'','Pileup','size',undefined,maxpu,undefined,2000000);
	//console.log(minpu1)
	if (method1) {
		if (minpu1==-1)
			plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',undefined,maxpu,0,undefined);
		else
			plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',minpu1,maxpu,0,undefined);
	}

	if (method1 && !manyruns)
		plot('#plot14','fu sys avg event time vs pileup','scatter',data_copy2["fuetimels2"],'','Pileup','seconds',undefined,maxpu,0,(!$("#pPb").is(':checked')) ? 0.5:0.8);
	//plot('#plot14','fu sys avg event time vs pileup','scatter',data["fuetimels2"],'','Pileup','seconds',undefined,50,0,0.5);
	$("#loading_dialog").loading("loadStop");
	$('#plots').show();

}


function doPlot(runlist) {
	var run = runlist[0];
	console.log(run)
	runlist = runlist.splice(1);
	var runinfo = runlist_copy[run]; 
	if (!runinfo || !runinfo[0] || !runinfo[1]) {
		if (runlist.length) {
			doPlot(runlist);
		}
		else if (hadsomething){
			createPlots();
		}
		return;
	}
	var lspart="";
	if (!runinfo[2]) {
		lspart = "&minls="+runinfo[3]+"&maxls="+runinfo[4];
	}
	$.getJSON("php/lumi.php?run="+run,function(datadb){

		var min_puval = 1.;
		if ($("#pPb").is(':checked')) min_puval=0.01;

		$('#fill').html(datadb.fill.data);
		plot('#plot1a','pileup vs ls','scatter',datadb["plumi1"]);//?
		//console.log(JSON.stringify(datadb["plumi1"]));
		var pileupmap = {};
		if (datadb["plumi1"][0].data.length) {
			var minpu = datadb["plumi1"][0].data[datadb["plumi1"][0].data.length-1][1];

			for (var j=0;j<datadb["plumi1"][0].data.length;j++) {
					var item = datadb["plumi1"][0].data[j];
					var stable = datadb["run"][1].data[j];//stable beams
					if (stable && item[1]>minpu && item[1]>min_puval)//min PU value shown
					{
						var ismasked=false;
						pumask.forEach(function(maskitm){if (item[1]>=maskitm[0] && item[1]<maskitm[1]) ismasked=true;});
						if (!ismasked)
							pileupmap[item[0]]=item[1];
					}
			}
		}

		if (method1)
			var phpstr = "php/puplot.php?run=";
		else
			var phpstr = "php/puplotalt.php?run=";

		var setup_string = "cdaq";
		if (run<=286591) setup_string="cdaq2016";//hack - will be replaced by year selector
		var setuppart = "&setup="+setup_string;

		$.getJSON(phpstr+run+lspart+setuppart,function(data){
			//console.log('data.runinfo.start'+data.runinfo.start)
			if(data.runinfo.start !=null){
				hadsomething=true;
				$('#runinfo').show();
				var datavec = []
				var origvec = data["fuetimels"][0].data
				for (var i=0;i<origvec.length;i++) {
					var ls = origvec[i][0];
					if (pileupmap.hasOwnProperty(ls))
						datavec.push([pileupmap[ls],origvec[i][1]])
					if (minpu1==-1 || minpu1>pileupmap[ls]) minpu1 = pileupmap[ls];
				}

				datavec.sort(function(a, b){return a[0]>b[0]});
				data["fuetimels"][0].data = datavec;
				data["fuetimels"][0]["name"]=run
				if (!data_copy.hasOwnProperty("fuetimels"))
					data_copy["fuetimels"]=[data["fuetimels"][0]]
				else
					data_copy["fuetimels"].push(data["fuetimels"][0])

				//plot15
				if (method1) {
					datavec = []
					origvec = data["fuesizels"][0].data
					for (var i=0;i<origvec.length;i++) {
						var ls = origvec[i][0];
						if (pileupmap.hasOwnProperty(ls))
							datavec.push([pileupmap[ls],origvec[i][1]])
					}
					datavec.sort(function(a, b){return a[0]>b[0]});
					data["fuesizels"][0].data = datavec;
					data["fuesizels"][0]["name"]=run
					if (!data_copy.hasOwnProperty("fuesizels"))
						data_copy["fuesizels"]=[data["fuesizels"][0]]
					else
						data_copy["fuesizels"].push(data["fuesizels"][0])

					//plot14
					if (!manyruns)
						for (var j=0;j<data["fuetimels2"].length;j++) {
							datavec = []
							origvec = data["fuetimels2"][j].data;
							for (var i=0;i<origvec.length;i++) {
								var ls = origvec[i][0];
								if (pileupmap.hasOwnProperty(ls))
									datavec.push([pileupmap[ls],origvec[i][1]])
							}
							datavec.sort(function(a, b){return a[0]>b[0]});
							data["fuetimels2"][j].data = datavec;
							//data["fuetimels"][j]["name"]=run
							if (j==0) {
								if (!data_copy2.hasOwnProperty("fuetimels2"))
									data_copy2["fuetimels2"]=[data["fuetimels2"][0]]
								else
									data_copy2["fuetimels2"].push(data["fuetimels2"][0])
							}
							else data_copy2["fuetimels2"].push(data["fuetimels2"][j]);
						}

						//plot16
						if (method1) {
							datavec = []
							origvec = data["eolsrate"][0].data
							for (var i=0;i<origvec.length;i++) {
								var ls = origvec[i][0];
								if (pileupmap.hasOwnProperty(ls))
									datavec.push([pileupmap[ls],origvec[i][1]])
							}

							datavec.sort(function(a, b){return a[0]>b[0]});
							data["eolsrate"][0].data = datavec;
							if (!data_copy.hasOwnProperty("eolsrate"))
								data_copy["eolsrate"]=[data["eolsrate"][0]]
							else
								data_copy["eolsrate"].push(data["eolsrate"][0])
						}
				}

			}
			if (!runlist.length) {
				createPlots();
			}
			else doPlot(runlist);
		});
	});
}

function plot(tag,title,type,data,xaxis,xtitle,ytitle,xmin,xmax,ymin,ymax) {
	xaxis = typeof xaxis !== 'undefined' ? xaxis : '';
	xtitle = typeof xtitle !== 'undefined' ? xtitle : 'LS';
	ytitle = typeof ytitle !== 'undefined' ? ytitle : 'A.U.';
	var tick = !$("#pPb").is(':checked') ?  2 : 0.02;
	var plottype = type;
	var plotoptions = type == 'scatter' ? {
		column: {
			pointPadding: 0,
			borderWidth: 0,
			groupPadding: 0,
			shadow: false
		},
		scatter: {marker:{radius:1.5}}
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
			zoomType: 'xy',
			width:538
		},
		plotOptions: plotoptions,
		xAxis: {
			type: xaxis,
			tickInterval: tick,
			title : {text : xtitle}
		},
		yAxis: {
			title : {text : ytitle},
			//tickInterval: undefined
			tickPixelInterval:24
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
	//if (ytitle==='seconds') chartvar.yAxis.tickInterval=0.05;
	if (xmin!==undefined) chartvar.xAxis["min"]=xmin;
	if (xmax!==undefined) chartvar.xAxis["max"]=xmax;
	if (ymin!==undefined) chartvar.yAxis["min"]=ymin;
	if (ymax!==undefined) chartvar.yAxis["max"]=ymax;

	var chart = $(tag).highcharts(chartvar);
	plots.push($(tag).highcharts());
	return chart;
}

function plotToCsv(filenamesuffix,data) {

	var filename = $('#runno').val()+'-'+filenamesuffix+'-'+new Date()+'.csv'
	var outvec = []
	var outstr = "";
	var arr = data_copy[data];
	//console.log(JSON.stringify(data_copy[data]));
	for (var i=0;i<arr.length;i++) {
		var arr2 = arr[i].data
		for (var j=0;j<arr2.length;j++) {
			var item = arr2[j];
			outvec.push(item);
			//outstr += item[0]+','+item[1]+"\n";
			//else  outstr += item[0]+','+item[1];
		}
	}
	outvec.sort(function(a, b){return a[0]>b[0]});
	for (var i=0;i<outvec.length;i++) {
		var item=outvec[i];
		if (i+1<outvec.length) outstr += item[0]+','+item[1]+"\n";
		else  outstr += item[0]+','+item[1];
	}

	//console.log(outstr)
	var csvblob = new Blob([outstr], { type: 'text/csv;charset=utf-8;' });

	// http://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
	if (navigator.msSaveBlob) { // IE 10+
		navigator.msSaveBlob(blob, filename);
	} else {
		var link = document.createElement("a");
		if (link.download !== undefined) { // feature detection
			// Browsers that support HTML5 download attribute
			var url = URL.createObjectURL(csvblob);
			link.setAttribute("href", url);
			link.setAttribute("download", filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}
}


