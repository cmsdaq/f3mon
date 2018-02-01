'use strict';

var refseries=[];
var plots=[];

var runlsinfo = {};

var year_start = 2016;
var year_current

function parseHash(key) {
	var hashpos = location.hash.indexOf(key+"=");
	if (hashpos==-1) return undefined;
	var hashstring=location.hash.substr(hashpos+key.length+1);
	if (hashstring.indexOf('&')!=-1)
		hashstring = hashstring.substr(0,hashstring.indexOf('&'))
	//if empty string is valid value, caller needs to verify undefined vs empty string
	return hashstring;
}

//TODO:run filter can remove runs from "runno"

var link_fillselect;
var fill_iteration;
var cleanTable;
var checkTable;

function setupDialogs() {

  //called when fill selected
  link_fillselect = function(item) {
    //console.log(item);
    resetlink();
    $('#fillno').val(item);
    //$("#loading_dialog").loading();
    setprogressbar(false,0,false,true);
    fill_iteration();
    //close?
    $( "#dialog1" ).dialog( "close" );
    $( "#dialog2" ).dialog( "close" );
  }

  //runs selector dialog
  $( "#dialog2" ).dialog({ autoOpen: false,width:600,position:{ my: "top", at: "top+150", of: window } });
  $( "#opener2" ).click(function() {
    if ($( "#dialog2" ).dialog( "isOpen" )) {
      $( "#dialog2" ).dialog( "close" );
      return;
    }
    $( "#dialog2" ).dialog( "open" );
    cleanTable();

  });

  //fill selection dialog box
  $( "#dialog1" ).dialog({ autoOpen: false,position:{ my: "top", at: "top+150", of: window } });
  $( "#opener" ).click(function() {
  //event.preventDefault();
    if ($( "#dialog1" ).dialog( "isOpen" )) {
      $( "#dialog1" ).dialog( "close" );
      return;
    }
    $( "#dialog1" ).dialog( "open" );
    $("#fillselector").hide()
    $("#fillselector2").hide()
    $("#fillselector3").hide()
    $("#fillselector  > tbody").html("");
    $("#fillselector2 > tbody").html("");
    $("#fillselector3 > tbody").html("");

    $.getJSON("php/fillinfo.php?getfills",
		    function(data) {
		        var cnt=0;
			//console.log(data)
		        data.fills.forEach(function (item) {
			//console.log(item)
		        if (cnt<10) {
  			  $("#fillselector").show()
			  $('#fillselector > tbody:last-child').append('<tr><td onclick="link_fillselect(\''+item+'\')">'+item+'</td></tr>')
			}
		        else if (cnt<20) {
  			  $("#fillselector2").show()
			  $('#fillselector2 > tbody:last-child').append('<tr><td onclick="link_fillselect(\''+item+'\')">'+item+'</td></tr>')
			}
			else {
  			  $("#fillselector3").show()
			  $('#fillselector3 > tbody:last-child').append('<tr><td onclick="link_fillselect(\''+item+'\')">'+item+'</td></tr>')
			}
			cnt+=1
				

			});
		    }
    );

  });

}

function setprogressbar(reset,val,hide,show) {
        $( "#progressbar" ).progressbar({
	     value: val
	});
	if (reset)
          $( "#progressbar" ).width(300);
	if (hide)
          $( "#progressbar" ).hide();
	if (show)
          $( "#progressbar" ).show();
}

function setprogressbar2(val,hide,show) {
        $( "#progressbar2" ).progressbar({
	     value: val
	});
	if (hide)
          $( "#progressbar2" ).hide();
	if (show)
          $( "#progressbar2" ).show();
}

function parseYear(timestamp) {
  var fill_year='20'+timestamp.split(' ')[0].split('-')[2];
  if (isNaN(fill_year)) {
    console.log('could not determine fill year from run information. timestamp:' + timestamp)
    return;
  }
  console.log('fill year: '+fill_year)
  var selected_year=$('#index').val();
  if (selected_year!=='current' && parseInt(fill_year)>=year_start) {
	//$('#index option[value='+fill_year+']').attr('selected','selected');
	$('#index').val(fill_year);
	//console.log($('#index').val())
  }
  else if (selected_year=='current' && fill_year!=year_current) {
        //also change if current is set but fill is from previous year
	$('#index').val(fill_year);
  }
}


function bootstrap(){

	$.ajaxSetup({
                headers : {   
                  'f3mon-compression' : 'true'
                }
	});

	var autoplot=false;
	var templsmap = {}

	year_current = parseInt(new Date().getFullYear());
	for (var i=year_current;i>=year_start;i--) {
		var o = new Option(i,i);
		//$(o).html("option text");
		$('#index').append(o);
	}
//	$('#index option[value='+year_current+']').attr('selected','selected');
	$('#index').val(year_current);//attr('selected','selected');
        setupDialogs();
	setprogressbar(true,0,true,false);
        $('#abort_all').hide();
	//$('#maxtime').val(0.5);

	if (location.hash.length) {

		//parse plotting theme
		var themes = {};
		$("input[name='hctheme']").each(function() {
			themes[$(this).val()]=true;
		});
		//console.log(themes)
		var theme_val = parseHash('theme')
		if (theme_val && themes.hasOwnProperty(theme_val)) $('#'+theme_val).attr('checked',true);

		//parse fill val
		var fill_val = parseHash('fill')
		if (fill_val) {
                  $('#fillno').val(fill_val);
		  autoplot=true;
		}
		//parse run and ls list
		var run_val = parseHash('run')
		if (run_val &&!fill_val) {
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
                }
		var index_val = parseHash('index');
		if (index_val) $('#index').val(index_val);

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
		$('#runinfo2 > tbody:last-child').append('<tr><th>Runs</th><th>LS from</th><th>LS to</th><th>full range</th><th>include</th><th/>');
		Object.keys(runlsinfo).sort().forEach(function(item) {
			var obj = runlsinfo[item];
			if (obj[0]) {
				var in1 ='<input size="4" class="pure-form" id="minls'+item+'" action="" value="'+obj[3]+'" change="toggleMinLS(this)"/>';
				var in2 ='<input size="4" class="pure-form" id="maxls'+item+'" action="" value="'+obj[4]+'" change="toggleMaxLS(this)"/>';
				var in3 ='<input type="checkbox" id="fullr'+item+'" name="alternative" checked="'+obj[2]+'" onchange="toggleFull(this)"/>';
				var in4 ='<input type="checkbox" id="include'+item+'" name="alternativeinc" checked="'+obj[1]+'" onchange="toggleInclude(this)"/>';
				var in5 ='<button type="button" id="delrun'+item+'" name="alternativeb" onclick="deleteRun(this)">delete</button>';
				$('#runinfo2 > tbody:last-child').append('<tr id="rownr'+item+'"><td>'+item+'</td><td>'+in1+'</td><td>'+in2+'</td> <td>'+in3+'</td> <td>'+in4+'</td><td>'+in5+'</td> </tr><tr>');
				$("#minls"+item).bind("input",function(event){toggleMinLS(this)});
				$("#maxls"+item).bind("input",function(event){toggleMaxLS(this)});
				$("#fullr"+item).prop('checked',obj[2]);
				$("#include"+item).prop('checked',obj[1]);
			}
		});
                $('#target').attr('enabled','enabled');
        	$("#loading_dialog").loading();
        	$("#loading_dialog").loading('loadStop');
		if (autoplot) {
		  setTimeout(function() {
	              setprogressbar(false,100,true,false);
		      doPlots($('#runno').val());
		    },100);
		}
		else setTimeout(function () {setprogressbar(false,100,true,false)},100);
		autoplot=false;
	}

	checkTable=function() {
	  var keys = Object.keys(runlsinfo);
	  var del_keys=[]
	  keys.forEach(function (item) {
	    if (runlsinfo[item][4]===null) {
	      del_keys.push(item)
	    }
	  });
	  if (keys.length>0 && del_keys.length===keys.length) return false;
	  else return true;

	}

	cleanTable=function() {
	  var keys = Object.keys(runlsinfo);
	  keys.forEach(function (item) {
	    if (runlsinfo[item][4]===null) {
	      console.log('run ' + item + ' has no lumisections. Deleting from the run list')
	      delete runlsinfo[item];
	    }
	  });
	  var  new_run_list = Object.keys(runlsinfo).sort();
	  $('#runno').val(new_run_list.join(','))

	}

	var timeout_rq;
	var runs_iteration = function(do_filter) {
		$("#runinfo2 > tbody").html("");
		var newcache = {}
		var nruns = 0;
		var runslist = $('#runno').val().split(',');
		var checkruns=[];
		var nruns_tot = runslist.length;
		var nruns_checked = 0;
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
		        if (nruns_tot>0) setprogressbar(false,100*(nruns_checked/nruns_tot),false,false);
			var rn = runs[0];
			runs = runs.splice(1);
			var setup_string = "cdaq";

			var year = $('#index').val();
			if (year!=='current') {setup_string=setup_string+year;}
                        else if (rn<=286591) setup_string="cdaq2016";
		        var setuppart = "&setup="+setup_string;

			$.getJSON("api/maxls?runNumber="+rn+setuppart,function(data) {
			        nruns_checked++;
				if (data.maxls!=null)
					newcache[rn] = [true,true,true,1,data.maxls];
				else //if (do_filter!==true)
					newcache[rn] = [false,false,false,1,data.maxls];
				if (!runs.length) {
		                        setprogressbar(false,100,false,false);
					makeTable(newcache);
		                        if (do_filter) cleanTable();
				}
				else checkRun(runs);
			});
		}
		if (checkruns.length) checkRun(checkruns);
	else { 
	        setprogressbar(false,100,false,false);
		makeTable(newcache);
		if (do_filter) cleanTable();
	  }
	}

	fill_iteration = function() {
	        var fn = $('#fillno').val()
		if (isNaN(fn) || !fn.length) {
                  //$('#target').attr('enabled','enabled');
		  return;
		}
		if (parseInt(fn)>1000) {
	          //$("#loading_dialog").loading();
	          setprogressbar(false,0,false,true);
		  $('#runno').val("");
		  $.getJSON("php/fillinfo.php?fill="+$('#fillno').val(),
		    function(data) {
			$('#runno').val(data.runs.join());
			parseYear(data.lasttime);
			runs_iteration(true);
                        //$('#target').attr('enabled','enabled');
                        //$('#target').enable();
		    }
		  );
		}
	}

	$('#runno').bind("input",
		function(event){
                        $('#target').attr('disabled','disabled');
			resetlink();
			$('#fillno').val('');
			clearTimeout(timeout_rq);
			timeout_rq = setTimeout(runs_iteration,330);
		}
	);

	$('#fillno').bind("input",
		function(event){
			resetlink();
			clearTimeout(timeout_rq);
	                var fn = $('#fillno').val()
		        if (isNaN(fn) || !fn.length) return
		        if (parseInt(fn)>1000) {
		          $('#runno').val("");
                          $('#target').attr('disabled','disabled');
			  timeout_rq = setTimeout(fill_iteration,330);
			}
		}
	);

	$('#index').bind("input",
		function(event){
		        $('#runno').val('');
		        $('#fillno').val('');
		}
	);

        $('#target').attr('disabled','disabled');
	//$("#runinfo2").hide();

	if ($('#fillno').val())
	    fill_iteration();
	else 
            runs_iteration(true);

}

function resetlink() {
        if (!location.hash || location.hash==='') return;
	else {

	  var index_val = parseHash('index');
	  if (index_val) location.hash="index="+index_val;
	  else location.hash=''
	}
}

function setlink() {
	//console.log($('#runno').val())
	if ($('#fillno').val()) {
	  location.hash='fill='+$('#fillno').val();
	}
	else {
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
	}
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
	$('#fillno').val('');
}

function toggleMaxLS(obj) {
	runlsinfo[obj.id.substring(5)][4]=parseInt(obj.value);
	$('#fillno').val('');
}

function toggleFull(obj) {
	runlsinfo[obj.id.substring(5)][2]=!runlsinfo[obj.id.substring(5)][2]
	$('#fillno').val('');
}

function toggleInclude(obj) {
	runlsinfo[obj.id.substring(7)][1]=!runlsinfo[obj.id.substring(7)][1]
	$('#fillno').val('');
}


function deleteRun(obj) {
        console.log(obj)
	delete runlsinfo[obj.id.substring(6)];
	var  new_run_list = Object.keys(runlsinfo).sort();
	console.log(obj.id.substring(7)+ ' ' +new_run_list)
	$('#runno').val(new_run_list.join(','))
	$('#fillno').val('');
	$('#rownr'+obj.id.substring(6)).remove();
}


var data_copy = {}
var minpu1;
var runlist_copy;
var hadsomething=false;
var pumask=[];

var nruns_tot2=1;
var nruns_plotted2=0;

function doPlots(runs){
        if (!checkTable()) {
	  console.log('Attempting to plot with no valid run in this index. Stopping...');
	  $("#loading_dialog").loading();
	  $("#loading_dialog").loading("loadStop");
          setprogressbar2(100,true,false);
          $('#abort_all').hide();
	  return;

	}
        cleanTable();
	$("#loading_dialog").loading();
	setprogressbar2(0,false,true);
        $('#abort_all').show();
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
	//console.log('pumask ' + JSON.stringify(pumask));

	//if (location.hash.length)  setlink();//override last haslink run
	plots=[];
	data_copy = {};
	refseries.splice(0,refseries.length); //delete content of refseries array from previous doPlots

	minpu1=-1;
	runlist_copy = JSON.parse(JSON.stringify(runlsinfo)); 
	var runlist_keys = Object.keys(runlist_copy).sort();
	nruns_tot2=runlist_keys.length;
	nruns_plotted2=0;
	//doPlot($('#runno').val().split(','))
	//console.log('rlk:'+runlist_keys.join(','));
	$('#pruns').html(runlist_keys.join(','));
	if (runlist_keys.length>0)
		doPlot(runlist_keys)
	else {
	        //should only be reached if no runs...
	        console.log('no valid runs to plot')
		$("#loading_dialog").loading();
		$("#loading_dialog").loading("loadStop");
	        setprogressbar2(100,true,false);
                $('#abort_all').hide();
	}
}


function createPlots() {
 
        console.log('create plots ... ');
	var maxpu_plot = 60;
	var maxpu_2 = 60;
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

	//console.log(JSON.stringify(data_copy.fuetimels))
	
	if ($("#fitputime").is(':checked')) {
		//data_copy["fuetimels"][0].showInLegend=false;
		data_copy["fuetimelsalt"][0].regression=true;
		data_copy["fuetimelsalt"][0].regressionSettings = {
			type: 'polynomial',
			color: 'rgba(223, 83, 83, .9)',
			useAllSeries:true,
			extrapolate:30,
			step:1,
			xmax:maxpu_plot
		}
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

		data_copy["fuesizels"][0].regression=true;
		data_copy["fuesizels"][0].regressionSettings = {
				type: 'polynomial',
				color: 'rgba(223, 83, 83, .9)',
				useAllSeries:true,
				extrapolate:30,
				step:1,
				xmax:maxpu_plot,
				order:1
		}
	}


	//var maxpu =  $('#maxpu').val();
	//maxpu_glob = maxpu;
	//if (isNaN(parseInt(maxpu))) {if ($("#fitputime").is(':checked')) maxpu=60; else maxpu=50;} else maxpu=parseInt(maxpu);
	//if (parseInt(maxpu)<20) maxpu=20; else maxpu=parseInt(maxpu);
	//console.log(JSON.stringify(data_copy["fuetimels"]));

	//make plots to consistently show same run list even if no data
	var dc_keys=Object.keys(data_copy);
	var run_keys_int={}
	var whitelist_dc_keys={"fuetimelsalt":true,"fuesizels":true,"fu3d":true,"eolsrate":true,"pucpu":true,"fuetimels":true};
	dc_keys.forEach(function(item) {
	  if (whitelist_dc_keys.hasOwnProperty(item)) {
	    data_copy[item].forEach(function(runitem) {
	      var rn = parseInt(runitem.name);
	      run_keys_int[rn]=true;
	    });
	  }
	});
        run_keys_int=Object.keys(run_keys_int).sort();
	dc_keys.forEach(function(item) {
	  if (whitelist_dc_keys.hasOwnProperty(item)) {
	    //if len mismatch, some runs are missing
	    if (data_copy[item].length!=run_keys_int.length) {
	      var dci_copy=[];
	      run_keys_int.forEach(function(rki) {
	        var found=false;
	        for (var i=0;i<data_copy[item].length;i++) {
		  if ( data_copy[item][i].name===''+rki ) {
		    dci_copy.push(data_copy[item][i]);
		    found=true;
		    break;
		  }
		}
		if (!found) {
		  dci_copy.push({"name":''+rki,"data":[]})
		}

	      });
	      data_copy[item]=dci_copy
	    }
	  }
	});

        var max_time_1 = $('#maxtime').val();
	if (!isNaN(max_time_1))
	  max_time_1 = parseFloat(max_time_1);
	else max_time_1 = 0.;
	var max_time = max_time_1 > 0. ? max_time_1: ( !$("#pPb").is(':checked') ? 0.5 :0.8 ) ;
	console.log('mtime '  + max_time);
	plot('#plot13','fu sys avg event time vs pileup','scatter',data_copy["fuetimels"],'','Pileup','seconds',undefined,maxpu,0,max_time);
	plot('#plot15','avg event size vs pileup','scatter',data_copy["fuesizels"],'','Pileup','size',undefined,maxpu,undefined,2000000);
        plot3D('#plot17','size and time vs pileup',data_copy["fu3d"],'PU','event time','event size',0,undefined,undefined,undefined,undefined,undefined);
	//console.log(minpu1)
//	if (minpu1==-1)
//		plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',undefined,maxpu,0,undefined);
//	else
		plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',minpu1==-1?undefined:minpu1,maxpu,0,undefined);

	plot('#plot14','fu (sys) avg event time vs pileup: categories','scatter',data_copy["fuetimels2"],'','Pileup','seconds',undefined,maxpu,0,max_time);
	plot('#plot14a','CPU vs pileup (HT-correction)','scatter',data_copy["pucpu"],'','Pileup','% CPU',undefined,maxpu,0,1);
	plot('#plot18','fu sys avg event time vs pileup (alt:cross-check)','scatter',data_copy["fuetimelsalt"],'','Pileup','seconds',undefined,maxpu,0,max_time);
	$("#loading_dialog").loading();
	$("#loading_dialog").loading("loadStop");
	setTimeout(function () {setprogressbar2(100,true,false)},100);
        $('#abort_all').hide();
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

		var phpstr = "php/puplot.php?run=";

		var setup_string = "cdaq";
		var year = $('#index').val();
		if (year!=='current') setup_string+=year;
                else if (run<=286591) setup_string="cdaq2016";
		var setuppart = "&setup="+setup_string;
		if (!data_copy.hasOwnProperty("fuetimelsalt")) data_copy["fuetimelsalt"]=[];
		if (!data_copy.hasOwnProperty("fuetimels")) data_copy["fuetimels"]=[];
		if (!data_copy.hasOwnProperty("fuesizels")) data_copy["fuesizels"]=[];
		if (!data_copy.hasOwnProperty("eolsrate")) data_copy["eolsrate"]=[];
		if (!data_copy.hasOwnProperty("fu3d")) data_copy["fu3d"]=[];
		if (!data_copy.hasOwnProperty("fuetimels2")) data_copy["fuetimels2"]=[];//data copy 2?

		$.getJSON(phpstr+run+lspart+setuppart,function(data){
			//console.log('data.runinfo.start'+data.runinfo.start)
			if(data.runinfo.start !=null){
			        //add data histo object
				data["fu3d"]=[{"name":"","data":[]}];
				hadsomething=true;
				$('#runinfo').show();
				var ls2map = {}
				//plot 13
				var datavec = []
				var origvec = data["fuetimelsalt"][0].data
				for (var i=0;i<origvec.length;i++) {
					var ls = origvec[i][0];
					if (pileupmap.hasOwnProperty(ls)) {
						datavec.push([pileupmap[ls],origvec[i][1]])
						ls2map[ls]=origvec[i][1];
					}
					if (minpu1==-1 || minpu1>pileupmap[ls]) minpu1 = pileupmap[ls];
				}
				datavec.sort(function(a, b){return a[0]>b[0]});
				data["fuetimelsalt"][0].data = datavec;
				data["fuetimelsalt"][0]["name"]=run
				//console.log(datavec.length + ' name '  + run )
				if (datavec.length)
				if (!data_copy.hasOwnProperty("fuetimelsalt"))
					data_copy["fuetimelsalt"]=[data["fuetimelsalt"][0]]
				else
					data_copy["fuetimelsalt"].push(data["fuetimelsalt"][0])

                                //plot18
				//var ls2mapalt = {}
				var datavec = []
				var origvec = data["fuetimels"][0].data
				for (var i=0;i<origvec.length;i++) {
					var ls = origvec[i][0];
					if (pileupmap.hasOwnProperty(ls)) {
						datavec.push([pileupmap[ls],origvec[i][1]])
						//ls2map[ls]=origvec[i][1];
					}
					//if (minpu1==-1 || minpu1>pileupmap[ls]) minpu1 = pileupmap[ls];
				}
				datavec.sort(function(a, b){return a[0]>b[0]});
				data["fuetimels"][0].data = datavec;
				data["fuetimels"][0]["name"]=run
				if (datavec.length)
				if (!data_copy.hasOwnProperty("fuetimels"))
					data_copy["fuetimels"]=[data["fuetimels"][0]]
				else
					data_copy["fuetimels"].push(data["fuetimels"][0])

                                //plot14a (CPU)
				//var ls2mapalt = {}
				var datavec = []
				var origvec = data["pucpu"][0].data
				for (var i=0;i<origvec.length;i++) {
					var ls = origvec[i][0];
					if (pileupmap.hasOwnProperty(ls)) {
						datavec.push([pileupmap[ls],origvec[i][1]])
					}
				}
				datavec.sort(function(a, b){return a[0]>b[0]});
				data["pucpu"][0].data = datavec;
				data["pucpu"][0]["name"]=run
				if (datavec.length)
				if (!data_copy.hasOwnProperty("pucpu"))
					data_copy["pucpu"]=[data["pucpu"][0]]
				else
					data_copy["pucpu"].push(data["pucpu"][0])

				//plot15
					datavec = []
					var datavec3d = []
					origvec = data["fuesizels"][0].data
					for (var i=0;i<origvec.length;i++) {
						var ls = origvec[i][0];
						if (pileupmap.hasOwnProperty(ls)) {
							datavec.push([pileupmap[ls],origvec[i][1]])
							//3D histogram map
							if (ls2map.hasOwnProperty(ls))
							  //datavec3d.push([origvec[i][1],pileupmap[ls],ls2map[ls]]);
							  datavec3d.push([pileupmap[ls],ls2map[ls],origvec[i][1]]);
						}

					}
					datavec.sort(function(a, b){return a[0]>b[0]});
					data["fuesizels"][0].data = datavec;
					data["fuesizels"][0]["name"]=run
				        if (datavec.length)
					if (!data_copy.hasOwnProperty("fuesizels"))
						data_copy["fuesizels"]=[data["fuesizels"][0]]
					else
						data_copy["fuesizels"].push(data["fuesizels"][0])

					//plot 17
					datavec3d.sort(function(a, b){return a[0]>b[0]});
					data["fu3d"][0].data = datavec3d;
					data["fu3d"][0]["name"]=run
				        if (datavec3d.length)
					  if (!data_copy.hasOwnProperty("fu3d"))
						data_copy["fu3d"]=[data["fu3d"][0]]
					  else
						data_copy["fu3d"].push(data["fu3d"][0])

					//plot14
					//console.log(JSON.stringify(data["fuetimels2"]));
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
				                        if (datavec.length) {
							  var found=false;
							  for (var k=0;k<data_copy["fuetimels2"].length;k++) {
							      if (data_copy["fuetimels2"][k].name==data["fuetimels2"][j].name) {
							        found=true;
						                 data_copy["fuetimels2"][k]['data'] = data["fuetimels2"][j]['data'].concat(data_copy["fuetimels2"][k]['data']);
							      }
							  }
							  if (!found)
							    data_copy["fuetimels2"].push(data["fuetimels2"][j]);
							}

					}
					//sort categories
					data_copy["fuetimels2"]=data_copy["fuetimels2"].sort(function(a,b) {return a.name>b.name});


					datavec = []
					origvec = data["eolsrate"][0].data
					for (var i=0;i<origvec.length;i++) {
								var ls = origvec[i][0];
								if (pileupmap.hasOwnProperty(ls))
									datavec.push([pileupmap[ls],origvec[i][1]])
					}

					datavec.sort(function(a, b){return a[0]>b[0]});
					data["eolsrate"][0].data = datavec;
				        if (datavec.length)
						if (!data_copy.hasOwnProperty("eolsrate"))
							data_copy["eolsrate"]=[data["eolsrate"][0]]
						else
							data_copy["eolsrate"].push(data["eolsrate"][0])

			}
			nruns_plotted2++;
			if (!runlist.length) {
	                        setprogressbar2(100,false,false);
				createPlots();
			}
			else {
	                  if (nruns_tot2) setprogressbar2(100*(nruns_plotted2/nruns_tot2),false,false);
			  doPlot(runlist);
			}
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

function plot3D(tag,title,data,xtitle,ytitle,ztitle,xmin,xmax,ymin,ymax,zmin,zmax) {
        //console.log('3d ' + JSON.stringify(data))

	var colors2 = Highcharts.getOptions().colors;

	Highcharts.getOptions().colors = $.map(Highcharts.getOptions().colors, function (color) {
		return {
			radialGradient: {
				cx: 0.4,
				cy: 0.3,
				r: 0.5
			},
			stops: [
				[0, color],
				[1, Highcharts.Color(color).brighten(-0.2).get('rgb')]
			]
		};
	});


	var chartvar3d = {
		chart: { 
		  //renderTo: 'container',
		  margin:100,
		  type: 'scatter',
		  options3d: {
		    enabled:true,
                    drag:{enabled:true},
		    alpha:10,
		    beta:30,
		    depth:250,
		    viewDistance:5,
		    fitToPlot:false,
		    frame:{
		               bottom: { size: 1, color: 'rgba(0,0,0,0.02)' },
			       back: { size: 1, color: 'rgba(0,0,0,0.04)' },
			       side: { size: 1, color: 'rgba(0,0,0,0.06)' }
		    }
		  },
		  width:538,
		  plotOptions: {
		    scatter: {
		      width:10,
		      height:10,
		      depth:10
		    }
		  }
		},
		xAxis: {
			//tickInterval: tick,
			title : {text : xtitle}
		},
		yAxis: {
			title : {text : ytitle}
			//tickInterval: undefined
			//tickPixelInterval:24
		},
		zAxis: {
			title : {text : ztitle}
			//tickInterval: undefined
			//tickPixelInterval:24
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
		enabled:false
		/*	layout: 'vertical',
			align: 'right',
			verticalAlign: 'middle',
			borderWidth: 0*/
		},
/*        series: [{
                name: 'test',
	        colorByPoint: true,
       data: [
        [1, 6, 5], [8, 7, 9]
	//,[50,40,1]//,[1008063.9873539,43.945484161377,0.32206664483083]
       ]}]
*/		series: data
	};
	//if (ytitle==='seconds') chartvar.yAxis.tickInterval=0.05;
	//if (xmin!==undefined) chartvar.xAxis["min"]=xmin;
	//if (xmax!==undefined) chartvar.xAxis["max"]=xmax;
	//if (ymin!==undefined) chartvar.yAxis["min"]=ymin;
	//if (ymax!==undefined) chartvar.yAxis["max"]=ymax;

	var chart = $(tag).highcharts(chartvar3d);
	plots.push($(tag).highcharts());
	//restore...
	Highcharts.getOptions().colors = colors2;
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

var reset_state = function() {
  $('#plots').hide();
  $('#abort_all').hide();
}

$.ajaxQ = (function(){
  var id = 0, Q = {};

  $(document).ajaxSend(function(e, jqx){
	  jqx._id = ++id;
	  Q[jqx._id] = jqx;
  });
  $(document).ajaxComplete(function(e, jqx){
	  delete Q[jqx._id];
  });

  return {
	  abortAll: function(){
	          console.log('kill all existing queries...')
		  var r = [];
		  $.each(Q, function(i, jqx){
			  r.push(jqx._id);
			  jqx.abort();
		  });
		  reset_state();
		  return r;
	  }
  };

})();

