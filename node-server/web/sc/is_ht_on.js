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
                headers : {   
                  'f3mon-compression' : 'true'
                }
	});

	var year_current = parseInt(new Date().getFullYear());
	for (var i=year_current;i>=year_start;i--) {
		var o = new Option(i,i);
		//$(o).html("option text");
		$('#index').append(o);
	}
	$('#index option[value='+year_current+']').attr('selected','selected');

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

			var setup_val = "cdaq";

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
	$('#runinfo').hide();
	$("#runinfo > tbody").html("");
        $('#runinfo > tbody:last-child').append('<tr><th>Run Number</th><th>Fill</th><th> Hyperthreading</th><th>Start Time</th><th>End Time</th></tr>')
	$('#target').submit(function(event){

		event.preventDefault();
		if ($('#runno').val()=="") {
			console.log('emptyrun!');
			location.hash='';
			var mysetup = "cdaq";
			var year = $('#index').val();
			if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
			var run;
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
			doCalc($('#runno').val(),$('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
			$('#runinfo').hide();
	                $("#runinfo > tbody").html("");
                        $('#runinfo > tbody:last-child').append('<tr><th>Run Number</th><th>Fill</th><th> Hyperthreading</th><th>Start Time</th><th>End Time</th></tr>')
			$("#loading_dialog").loading();
		}
	});

	var timeout_rq;
	var run_iteration = function(cb) {
		if (isNaN($('#runno').val()) || !$('#runno').val().length) return;
		var mysetup = "cdaq";
		var year = $('#index').val();
		if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
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
		var callb = function() {
		    doCalc($('#runno').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
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
	if (!$('#fullrun').prop('checked') && $('#minls').val() && $('#maxls').val()) {
		location.hash+='&minls='+$('#minls').val();
		location.hash+='&maxls='+$('#maxls').val();
	} 
}

var data_copy = {};
var htmlruns = [];

function doCalc(runstr,minls,maxls,fullrun)
{
	$('#start').html("");
	//cleanup
	for (var i=0;i<plots.length;i++) plots[i].destroy();
	plots=[];
	data_copy = {}
	htmlruns = [];
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
	if (runs.length==0 || (runs.length==1 && runs[0]=='')) {
		//finalize and plot 
		//finished
		return
	}
	var run = runs[0]
	runs = runs.splice(1)

	var lspart="&minls="+minls+"&maxls="+maxls;

	$.getJSON("php/lumi2.php?run="+run+"&basic=true",function(datadb){
		//console.log('0 '+JSON.stringify(datadb.plumi1[0]));
		//$('#fill').html(datadb.fill.data);
		var pileupmap = {};
		var minsb=0;
		var maxsb=0;


		//maxls and minls query doesn't work currently with multirun
		if (multirun) minsb=0;
		if ($('#timeaxis').is(':checked')) multirun=true;

		if (multirun)
			var multipart = "&multirun=1";
	        else multipart="";

		var my_setup = "cdaq";
		var year = $('#index').val();
		if (year!=='current') {my_setup=my_setup+year;console.log('**mysetup ' + my_setup);}
		//else if (my_setup==="cdaq" && parseInt(run)<=286591) my_setup="cdaq2016";//hack - will be replaced by year selector

		var pippo=$.getJSON("php/is_ht_on.php?run="+run+"&setup="+my_setup+lspart+multipart,function(data) {

                        var htstatus,htstyle;
			if(data.start !=null){
				console.log(data.answer.value)
				htstatus = "N/A";
				htstyle="background-color:silver";
				if (data.answer.value==1) {
				  htstatus="OFF";
				  htstyle="background-color:orange";
				}
				if (data.answer.value==3) {
				  htstatus="ON";
				  htstyle="background-color:lawngreen";
				}
				if (data.answer.value==2) {
				  htstatus="MIX";
				  htstyle="background-color:pink";
				}
				if (data.answer.value==4) {
				  htstatus="ERROR"
				  htstyle="background-color:red";
				}
				$('#runinfo > tbody:last-child').append('<tr><td>'+run+'</td>'+
				                                        '<td>'+datadb.fill.data+'</td>'+
									'<td style="'+htstyle+'">'+htstatus+'</td>'+
									'<td>'+new Date(data.start)+'</td>'+
									'<td>'+new Date(data.end)+'</td></tr>');
			}else{
				console.log('run not found?')
				var htstyle="background-color:silver";
				var htstatus='N/A';

				$('#runinfo > tbody:last-child').append('<tr><td>'+run+'</td>'+
				                                        '<td></td>'+
									'<td style="'+htstyle+'">'+htstatus+'</td>'+
									'<td> not found / too short </td>'+
									'<td></td></tr>');
			}
			console.log('!')
			console.log(runs.length)
                        if (runs.length) 
                          doPlot(runs,minls,maxls,fullrun,force_time_axis,multirun);
			else {
		          $('#runinfo').show();		
			  $("#loading_dialog").loading("loadStop");
			}
		});
	});

}

