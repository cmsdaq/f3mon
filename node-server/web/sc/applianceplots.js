'use strict';

var plots=[];
var year_start = 2015;

var pumax=60;

function parseHash(key) {
	var hashpos = location.hash.indexOf(key+"=");
	if (hashpos==-1) return undefined;
	var hashstring=location.hash.substr(hashpos+key.length+1);
	if (hashstring.indexOf('&')!=-1)
		hashstring = hashstring.substr(0,hashstring.indexOf('&'))
	//if empty string is valid value, caller needs to verify undefined vs empty string
	return hashstring;
}


var link_fillselect;
var fill_iteration;

function setupFillSelector() {

  //called when fill selected
  link_fillselect = function(item) {
    //console.log(item);
    $('#fillno').val(item);
    fill_iteration();
    //close?
    $( "#dialog1" ).dialog( "close" );
  }

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
		        data.fills.forEach(function (item) {
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

function setprogressbar2(val,hide,show) {
        $( "#progressbar2" ).progressbar({
	     value: val
	});
	if (hide) {
          $( "#progressbar2" ).hide();
          $('#abort_all').hide();
	}
	if (show) {
          $( "#progressbar2" ).show();
          $('#abort_all').show();
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

function bootstrap() {

	$.ajaxSetup({
                headers : {   
                  'f3mon-compression' : 'true'
                }
	});

	Highcharts.setOptions(Highcharts.theme_du);

	var year_current = parseInt(new Date().getFullYear());
	for (var i=year_current;i>=year_start;i--) {
		var o = new Option(i,i);
		//$(o).html("option text");
		$('#index').append(o);
	}
	$('#index option[value='+year_current+']').attr('selected','selected');


        setupFillSelector();

        //enable disable checkbox handling
        var refreshLumis  = function() {
	  $('#minls').prop('disabled',$('#fullrun').prop('checked'));
	  $('#maxls').prop('disabled',$('#fullrun').prop('checked'));
	}
	$('#fullrun').change(function(){ refreshLumis() });

        var disableLumis = function () {
            $('#maxls').val('');
            $('#minls').val('');
	    $('#fullrun').prop('checked',true);
	    refreshLumis();
	}

	disableLumis();

        document.title=''
	var autoplot=false

        //parse hash
	if (location.hash.length) {

		var index_val = parseHash('index');
		if (index_val) $('#index').val(index_val);

		var setup_val = parseHash('setup');
		if (setup_val) $('#'+setup_val).attr("checked", "checked");

		var fill_val = parseHash('fill')
		if (!fill_val) {
		  //if fill not provided, get run / ls parameters
		  var rn_val = parseHash('run')
		  if (rn_val) {
			$('#runno').val(rn_val);
			$('#fillno').val("");
			document.title = "run "+rn_val;
			autoplot=true

			var minls_val = parseHash('minls')
			var maxls_val = parseHash('maxls')
	                if ($('#runno').val().indexOf(',')===-1 && !isNaN(minls_val) && !isNaN(maxls_val)) {
			    //minmax=true;
	                    $('#fullrun').prop('checked',false);
			    $('#minls').val(minls_val);
			    $('#maxls').val(maxls_val);
			}
		  }
		}
		else {
		  //if fill provided, will query runs being part of this fill
	          autoplot=true;
		  $('#runno').val("");
		  $('#fillno').val(fill_val);
		}
	}

	$('#dialog').hide();
	$('#plots').hide();
	$('#runinfo').hide();
	$( "#radio2" ).buttonset();

        //button press
	$('#target').submit(function(event){
                //default: no fill or run specified. show last run number
		event.preventDefault();
		if ($('#runno').val()=="") { //TODO:fetch from fill data if fill is specified
		        //clear also fill no
		        $('#fillno').val('');//should already be empty
			console.log('find run number mode...');
			location.hash='';
			var mysetup = $('input[name=setup]:checked', '#setups').val();
			var year = $('#index').val();
			if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
			var run;
			$.getJSON("api/runInfo?sysName="+mysetup+"&activeRuns=true",function(adata){
				if (adata.runNumber && !isNaN(run = parseInt(adata.runNumber))) {
					document.title = 'run ' + adata.runNumber;
					//$('#runno').val(adata.runNumber+'');
					console.log('found run ' + adata.runNumber);
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

        //delayed callbacks
	var timeout_rq;
	var run_iteration = function(cb) {
		if (isNaN($('#runno').val()) || !$('#runno').val().length) {
                  //$('#target').enable();
                  $('#target').attr('enabled','enabled');
		  return;
		}
		var mysetup = $('input[name=setup]:checked', '#setups').val();
		var year = $('#index').val();
		if (year!=='current') {mysetup=mysetup+year;console.log('mysetup ' + mysetup);}
		else if (mysetup==="cdaq" && parseInt($('#runno').val())<=286591) mysetup="cdaq2016";//will leave this, but will not automatically work for other years
		$.getJSON("api/maxls?runNumber="+$('#runno').val()+"&setup="+mysetup,function(data) {
			if (data.maxls!=null) {
				//console.log(JSON.stringify(data));
				$('#maxls').val(data.maxls);
				$('#minls').val(1);
				refreshLumis();
			}
			else {
			  disableLumis();
			}
			if (cb!==undefined) cb();
                        $('#target').attr('enabled','enabled');
                        //$('#target').enable();
		});
	}

	fill_iteration = function(cb) {
	        var fn = $('#fillno').val()
		if (isNaN(fn) || !fn.length) {
                  $('#target').attr('enabled','enabled');
		  return;
		}
		var mysetup = $('input[name=setup]:checked', '#setups').val();
		if (mysetup.startsWith('cdaq') && (parseInt(fn)>1000)) {
		  $('#runno').val("");
		  $.getJSON("php/fillinfo.php?fill="+$('#fillno').val(),
		    function(data) {
			$('#runno').val(data.runs.join());
			if (cb!==undefined) cb();
                        $('#target').attr('enabled','enabled');
                        //$('#target').enable();
		    }
		  );
		}
	}

	//called by fill selector
	link_fillselect = function(item) {
          //console.log(item);
	  $('#fillno').val(item);
	  fill_iteration(); //TODO: bind to conditional callback
	  //close?
          $( "#dialog1" ).dialog( "close" );
	}

        //bind and call delayed callback when typing
	$('#runno').bind("input",
		function(event){
			//console.log('input!')
		        $('#fillno').val("");
			clearTimeout(timeout_rq);
	                if ($('#runno').val().indexOf(',')!==-1) $('#fullrun').prop('checked',true);
			timeout_rq = setTimeout(run_iteration,330);
                        //$('#target').disable();
                        $('#target').attr('disabled','disabled');
		}
	);

	$('#fillno').bind("input",
		function(event){
		        //clear any runs
		        //$('#runno').val("");
			//console.log('input!')
			clearTimeout(timeout_rq);
			timeout_rq = setTimeout(fill_iteration,1000); //TODO:bind to conditional callback as below
                        //$('#target').disable();
                        $('#target').attr('disabled','disabled');
		}
	);

        var callb = function() {}
	if (autoplot) {
	  console.log('autoplotting')
	  callb = function() { doPlots($('#runno').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked')); }
	}

	var callb2 = function() {
	        if ($('#runno').val().indexOf(',')!==-1) {
		  disableLumis();
	          callb();
		}
		else {
		  if (!$('#fullrun').is(':checked') && $('#minls').val() && $('#maxls').val()) {
		    refreshLumis();
		    callb();
		  }
		  else
	            run_iteration(callb);//pass callback to run after maxls is retrieved
		}
	}
	if ($('#fillno').val()) {
	    fill_iteration(callb2);//pass callback to run after run is retrieved
	}
	else 
            callb2();
	if (autoplot) $("#loading_dialog").loading();

        setprogressbar2(100,true,false);
}

//set hash
function setlink() {
	if ($('#fillno').val()) { 
	  location.hash='fill='+$('#fillno').val();
	  location.hash+='&setup=cdaq';
	  location.hash+='&index='+$('#index').val();
	}
	else if ($('#runno').val()) {
	  location.hash='run='+$('#runno').val();
	  location.hash+='&setup='+$('input[name=setup]:checked', '#setups').val();
	  if (!$('#fullrun').prop('checked') && $('#minls').val() && $('#maxls').val()) {
	    location.hash+='&minls='+$('#minls').val();
	    location.hash+='&maxls='+$('#maxls').val();
	  }
	}
	else window.location.href = window.location.href.split('#')[0]
}

var data_copy = {};
var htmlruns = [];
var htmldur=0;

var nruns_plotted2;
var nruns_tot2;

//plot runs
function doPlots(runstr,minls,maxls,fullrun)
{
	$('#start').html("");
	$('#plots').hide();
	$('#runinfo').show();
	console.log('show progress bar ... ')
	setprogressbar2(0,false,true);
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
	nruns_tot2=list_of_runs.length;
	nruns_plotted2=0;

	//if (runstr)
	//  doLustrePlots(runstr);

	if (list_of_runs.length>1)
		doPlot(list_of_runs,-1,-1,true,true,true);
	else
		doPlot(list_of_runs,minls,maxls,fullrun,false,false);
	if (runstr)
	  doLustrePlots(runstr);
}

function doPlot(runs,minls,maxls,fullrun,force_time_axis,multirun){

	if (runs.length==0 || runs.length==1 && runs[0]=='') {
		//finalize and plot 
		//finished
                setprogressbar2(100,true,false);
		return
	}
	var run = runs[0]
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
//			plot('#plotH0','inst lumi vs ls','line',datadb["lumi1"],'','LS','',undefined,undefined,0,undefined);
			//plot('#plotH1','pileup vs ls','line',datadb["plumi1"]);
//			plot('#plotH1','pileup vs ls','line',datadb["plumi1"],'','LS','',undefined,undefined,0,undefined);
			if (filterstable && minsb>0) sbpart="&minsb="+minsb+"&maxsb="+maxsb;
		}

		var my_setup = $('input[name=setup]:checked', '#setups').val();
		var year = $('#index').val();
		if (year!=='current') {my_setup=my_setup+year;console.log('mysetup ' + my_setup);}
		else if (my_setup==="cdaq" && parseInt(run)<=286591) my_setup="cdaq2016";//hack - will be replaced by year selector

		var pippo=$.getJSON("php/applianceplots.php?run="+run+"&setup="+my_setup+lspart+sbpart+multipart,function(data) {

			if(data.runinfo.start !=null){


				if (multirun) {
				        data["plumi1"]=[{name:datadb["plumi1"][0].name,data:[]}];
				        data["lumi1"]=[ {name:datadb["lumi1"][0].name,data:[]}];
					datadb.lumi1[0].data.forEach(function(item) {
						if (data.lstimes.hasOwnProperty(item[0]))
							data.lumi1[0].data.push([data.lstimes[item[0]],item[1]]);
					});
					datadb.plumi1[0].data.forEach(function(item) {
						if (data.lstimes.hasOwnProperty(item[0]))
							data.plumi1[0].data.push([data.lstimes[item[0]],item[1]])
					});
				}
				else  {
				        data["plumi1"]=datadb["plumi1"];
				        data["lumi1"]=datadb["lumi1"];
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
								data["fuetimels2"].push({'name': data["fuetimelsresls"][j].name, 'data' : datavec});
								//data["fuetimels2"].push({'name': data["fuetimelsresls"][j].name, 'data' : datavec});
						}

					var ratemap = {}
					data["purate"]=[];
					if (data.ratebytotalls)
						for (var j=0;j<data["ratebytotalls"].length;j++) {
							datavec = []
							origvec = data["ratebytotalls"][j].data;
							for (var i=0;i<origvec.length;i++) {
								var ls = origvec[i][0];
								if (pileupmap.hasOwnProperty(ls)) {
									datavec.push([pileupmap[ls],origvec[i][1]])
									ratemap[ls]=origvec[i][1];
								}
							}
							datavec.sort(function(a, b){return a[0]>b[0]});
							data["purate"].push({'name': data["ratebytotalls"][j].name, 'data' : datavec});
						}

					for (var j=0;j<data["bwcompare"].length;j++) {
					  for (var i=0;i<data.bwcompare[j].data.length;i++) {
					    if (data.bwcompare[j].data[i][1]>2) data.bwcompare[j].data[i][1]=2;
					  }
					}

					data["pucpu"]=[];
					data["pucpu100khz"]=[];
					if (data.fusyscpu2ls)
						for (var j=0;j<data["fusyscpu2ls"].length;j++) {
							datavec = []
							var datavec100khz = []
							var datavec100khzC1 = []
							var datavec100khzC2 = []
							origvec = data["fusyscpu2ls"][j].data;
							for (var i=0;i<origvec.length;i++) {
								var ls = origvec[i][0];
								if (pileupmap.hasOwnProperty(ls)) {
									datavec.push([pileupmap[ls],origvec[i][1]])
									if (j==2 && ratemap.hasOwnProperty(ls)) {
									  var ls_rate = ratemap[ls];
									  if (ls_rate>20000) {
									    var factor_100khz = 100000.0/ls_rate;
									    var new_val_constcorr1 = (origvec[i][1]-0.05)*factor_100khz + 0.05
									    var new_val_constcorr2 = (origvec[i][1]-0.1)*factor_100khz + 0.1
									    var new_val_noconstcorr = origvec[i][1]*factor_100khz;
									    //console.log('100khz pu ' + pileupmap[ls] +' '+ factor_100khz);
									    datavec100khz.push([pileupmap[ls],new_val_noconstcorr]);
									    datavec100khzC1.push([pileupmap[ls],new_val_constcorr1]);
									    datavec100khzC2.push([pileupmap[ls],new_val_constcorr2]);
									  }
									}
								}
							}
							datavec.sort(function(a, b){return a[0]>b[0]});
							data["pucpu"].push({'name': data["fusyscpu2ls"][j].name, 'data' : datavec});
							if (j==2) { //only correction with turn-on
							  data["pucpu100khz"].push({'name': data["fusyscpu2ls"][j].name, 'data' : datavec100khz});
							  data["pucpu100khz"].push({'name': data["fusyscpu2ls"][j].name+"_cc5%", 'data' : datavec100khzC1});
							  data["pucpu100khz"].push({'name': data["fusyscpu2ls"][j].name+"_cc10%", 'data' : datavec100khzC2});
							}
						}

/*control plot*/

					data["cpuctrl1"]=[];
					data["cpuctrl2"]=[];
					data["cpuctrl3"]=[];
					data["cpuctrl3int"]=[];
					data["cpuctrl4"]=[];
					if (data.fucpures) {
				            var name_map = {}

					    for (var j=0;j<data["fucpures"].length;j++) {
							//datavec = []
							//origvec = data["fucpures"][j].data;
						var origname = data["fucpures"][j].name.substring(0,data["fucpures"][j].name.indexOf(':'))
						name_map[origname]=true;
					    }
					    var varname_keys = Object.keys(name_map).sort();
					    varname_keys.forEach(function (item) {

						var idx1=-1,idx2=-1;
						for (var j=0;j<data["fucpures"].length;j++) {
							//datavec = []
							//origvec = data["fucpures"][j].data;
							var origname = data["fucpures"][j].name;
							if (origname.startsWith(item+':')) {
							  if (idx1===-1) idx1=j;
							  else idx2=j;
							}
						}
						if (idx1!==-1 && idx2!==-1) {
							data["cpuctrl1"].push({name:item,data:[]});
						        data.cpuctrl2.push({"name":data["fucpures"][idx1].name,"data":[]})
							var cvec1=data.cpuctrl2[data.cpuctrl2.length-1].data
						        data.cpuctrl2.push({"name":data["fucpures"][idx2].name,"data":[]})
							var cvec2=data.cpuctrl2[data.cpuctrl2.length-1].data;

						        data.cpuctrl3.push({"name":data["fucpures"][idx1].name,"data":[]})
							var cvec13=data.cpuctrl3[data.cpuctrl3.length-1].data;
						        data.cpuctrl3.push({"name":data["fucpures"][idx2].name,"data":[]})
							var cvec23=data.cpuctrl3[data.cpuctrl3.length-1].data

						        data.cpuctrl3int.push({"name":data["fucpures"][idx1].name,"data":[]})
							var cvec13int=data.cpuctrl3int[data.cpuctrl3int.length-1].data;
						        data.cpuctrl3int.push({"name":data["fucpures"][idx2].name,"data":[]})
							var cvec23int=data.cpuctrl3int[data.cpuctrl3int.length-1].data


						        data.cpuctrl4.push({"name":data["fucpures"][idx1].name,"data":[]})
							var cvec14=data.cpuctrl4[data.cpuctrl4.length-1].data;
						        data.cpuctrl4.push({"name":data["fucpures"][idx2].name,"data":[]})
							var cvec24=data.cpuctrl4[data.cpuctrl4.length-1].data


							var oname1=data["fucpures"][idx1].name;
							var oname2=data["fucpures"][idx2].name;

							var odata1=data["fucpures"][idx1].data;
							var odata2=data["fucpures"][idx2].data;

							var Ares = parseInt(oname1.substring(oname1.indexOf(':')+1))
							var Bres = parseInt(oname2.substring(oname2.indexOf(':')+1))

							var data_new=[]
							var data_new2=[]
							var off1=0;
							var off2=0;
							for (var j=0;j<Math.min(odata1.length,odata2.length);j++) {
								cvec1.push([odata1[j][0],-1]);
								cvec2.push([odata2[j][0],-1]);


								cvec13int.push([odata1[j][0],-1]);
								cvec23int.push([odata2[j][0],-1]);


								//cvec14.push([odata1[j][0],-1]);
								//cvec24.push([odata2[j][0],-1]);

							}
							for (var j=0;j<Math.min(odata1.length-off1,odata2.length-off2);j++) {
								var lsA=odata1[j+off1][0];
								var lsB=odata2[j+off2][0];
								var Acpu = odata1[j+off1][1];
								var Bcpu = odata2[j+off2][1];
								//console.log(Ares+' ' + Bres + ' ' + Bcpu + ' ' + Acpu);
								var res_ratio = Bres/Ares;
								var constfrac = (res_ratio*Bcpu - Acpu) / (res_ratio-1.);
								if (constfrac>0)
								if (lsA===lsB) {
									data_new.push([lsA,constfrac]);
									var acpucorr = (Acpu-constfrac)/Acpu;
									var bcpucorr = (Bcpu-constfrac)/Bcpu;

									var acpucorr3 = (Acpu-constfrac)/(1-constfrac);
									var bcpucorr3 = (Bcpu-constfrac)/(1-constfrac);

									if (acpucorr<=0.1 || bcpucorr<=0.1) acpucorr=bcpucorr=-1; //0.1 cpu%
									//fully saturated (anyway doesn't work because of difference in B/W)
									if (acpucorr>1 && acpucorr<=1+constfrac) acpucorr=1
									if (bcpucorr>1 && bcpucorr<=1+constfrac) bcpucorr=1
									//else check if invalid point (outside of working limits)
									if (acpucorr3>1 || acpucorr3<0.1 || bcpucorr3>1 || bcpucorr3<0.1) bcpucorr3=acpucorr3=-1;
									cvec1[j+off1][1]=acpucorr
									cvec2[j+off1][1]=bcpucorr

									cvec13.push([lsA,acpucorr3]);
									cvec23.push([lsA,bcpucorr3]);

									cvec13int[j+off1][1]=acpucorr3;
									cvec23int[j+off1][1]=bcpucorr3;

									cvec14.push([lsA,acpucorr3/Acpu]);
									cvec24.push([lsA,bcpucorr3/Bcpu]);

									//cvec14[j+off1][1]=acpucorr3/Acpu;
									//cvec24[j+off1][1]=bcpucorr3/Bcpu;

								}
								else {
								  console.log('mismatch ' + lsA + ' ' + lsB);
								  if (lsA>lsB) {off2+=1;j--}
								  if (lsA<lsB) {off1+=1;j--}

								}

							}
							data["cpuctrl1"][data["cpuctrl1"].length-1].data = data_new;

						}
					  });
					}
					data["cpuctrl2ls"]=[];
					data["cpuctrl3intls"]=[];

					if (data.fucpuresls) {
				            var name_map_1 = {}

					    for (var j=0;j<data["fucpuresls"].length;j++) {
							//datavec = []
							//origvec = data["fucpures"][j].data;
						var origname = data["fucpuresls"][j].name.substring(0,data["fucpuresls"][j].name.indexOf(':'))
						name_map[origname]=true;
					    }
					    var varname_keys = Object.keys(name_map).sort();
					    varname_keys.forEach(function (item) {

						var idx1=-1,idx2=-1;
						for (var j=0;j<data["fucpuresls"].length;j++) {
							//datavec = []
							//origvec = data["fucpures"][j].data;
							var origname = data["fucpuresls"][j].name;
							if (origname.startsWith(item+':')) {
							  if (idx1===-1) idx1=j;
							  else idx2=j;
							}
						}
						if (idx1!==-1 && idx2!==-1) {
						        data.cpuctrl2ls.push({"name":data["fucpuresls"][idx1].name,"data":[]})
							var cvec1=data.cpuctrl2ls[data.cpuctrl2ls.length-1].data
						        data.cpuctrl2ls.push({"name":data["fucpuresls"][idx2].name,"data":[]})
							var cvec2=data.cpuctrl2ls[data.cpuctrl2ls.length-1].data;

						        data.cpuctrl3intls.push({"name":data["fucpuresls"][idx1].name,"data":[]})
							var cvec13int=data.cpuctrl3intls[data.cpuctrl3intls.length-1].data;
						        data.cpuctrl3intls.push({"name":data["fucpuresls"][idx2].name,"data":[]})
							var cvec23int=data.cpuctrl3intls[data.cpuctrl3intls.length-1].data


							var oname1=data["fucpuresls"][idx1].name;
							var oname2=data["fucpuresls"][idx2].name;

							var odata1=data["fucpuresls"][idx1].data;
							var odata2=data["fucpuresls"][idx2].data;

							var Ares = parseInt(oname1.substring(oname1.indexOf(':')+1))
							var Bres = parseInt(oname2.substring(oname2.indexOf(':')+1))

							var off1=0;
							var off2=0;
							for (var j=0;j<Math.min(odata1.length,odata2.length);j++) {
								cvec1.push([odata1[j][0],-1]);
								cvec2.push([odata2[j][0],-1]);


								cvec13int.push([odata1[j][0],-1]);
								cvec23int.push([odata2[j][0],-1]);


							}
							for (var j=0;j<Math.min(odata1.length-off1,odata2.length-off2);j++) {
								var lsA=odata1[j+off1][0];
								var lsB=odata2[j+off2][0];
								var Acpu = odata1[j+off1][1];
								var Bcpu = odata2[j+off2][1];
								//console.log(Ares+' ' + Bres + ' ' + Bcpu + ' ' + Acpu);
								var res_ratio = Bres/Ares;
								var constfrac = (res_ratio*Bcpu - Acpu) / (res_ratio-1.);
								if (constfrac>0)
								if (lsA===lsB) {
									var acpucorr = (Acpu-constfrac)/Acpu;
									var bcpucorr = (Bcpu-constfrac)/Bcpu;

									var acpucorr3 = (Acpu-constfrac)/(1-constfrac);
									var bcpucorr3 = (Bcpu-constfrac)/(1-constfrac);

									if (acpucorr<=0.1 || bcpucorr<=0.1) acpucorr=bcpucorr=-1; //0.1 cpu%
									//fully saturated (anyway doesn't work because of difference in B/W)
									if (acpucorr>1 && acpucorr<=1+constfrac) acpucorr=1
									if (bcpucorr>1 && bcpucorr<=1+constfrac) bcpucorr=1
									//else check if invalid point (outside of working limits)
									if (acpucorr3>1 || acpucorr3<0.1 || bcpucorr3>1 || bcpucorr3<0.1) bcpucorr3=acpucorr3=-1;
									cvec1[j+off1][1]=acpucorr
									cvec2[j+off1][1]=bcpucorr

									//cvec13.push([lsA,acpucorr3]);

									cvec13int[j+off1][1]=acpucorr3;



								}

							}

						}
					  });
					}


					data["fuetimelsrescorr"]=[]
					data["fuetimelsrescorrmax"]=[]
					if (data.fuetimelsres) {
					    for (var j=0;j<data["fuetimelsres"].length;j++) {
					        var vec, vec3;
					        for (var k=0;k<data["cpuctrl2"].length;k++) {
						  if (data.cpuctrl2[k].name===data.fuetimelsres[j].name) {
						    vec=data.cpuctrl2[k].data;
						    vec3=data.cpuctrl3int[k].data;
						    break;
						  }
						}
						if (!vec) continue;
						//console.log(data["cpuctrl4"]);

						data["fuetimelsrescorr"].push({name:data.fuetimelsres[j].name,data:[]})
						data["fuetimelsrescorrmax"].push({name:data.fuetimelsres[j].name,data:[]})
						var veco = data["fuetimelsrescorr"][data["fuetimelsrescorr"].length-1].data
						var veco4 = data["fuetimelsrescorrmax"][data["fuetimelsrescorrmax"].length-1].data
						var off1=0;var off2=0;
					        for (var i=0;i<Math.min(data.fuetimelsres[j].data.length-off1,vec.length-off2);i++) {
						  var cv1 = data.fuetimelsres[j].data[i+off1];
						  var cv2 = vec[i+off2];

						  if (cv1[0]>0)
						  if (cv1[0]===cv2[0]) {
						    if (cv2[1]!==-1 && cv2[1]>0.05 && cv1[1]>0.1) {//0.1 sec , 0.05 cpu
						      //console.log('c:' + cv2 + ' ' + cv1)
						      veco.push([cv1[0],cv1[1]*cv2[1]]);
						      var cv3=vec3[i+off2];
						      if (cv3[1]>=0.1)
						        veco4.push([cv1[0],cv1[1]*cv2[1]/cv3[1]])
						    }
						  }
						  else {
						    console.log('mismatch...'+cv1[0]+' ' +cv2[0]);
						    if (cv1[0]<cv2[0]) {off1++;i--}
						    if (cv1[0]>cv2[0]) {off2++;i--}
						  }
						}
						//console.log(JSON.stringify(veco));
					    }
					}

					data["pucpurescorr"]=[]
					if (data.fuetimelsresls) {
					    for (var j=0;j<data["fuetimelsresls"].length;j++) {
					        var vec, vec3;
					        for (var k=0;k<data["cpuctrl2ls"].length;k++) {
						  if (data.cpuctrl2ls[k].name===data.fuetimelsresls[j].name) {
						    vec=data.cpuctrl2ls[k].data;
						    //vec3=data.cpuctrl3intls[k].data;
						    break;
						  }
						}
						if (!vec) continue;
						//console.log(data["cpuctrl4"]);

						data["pucpurescorr"].push({name:data.fuetimelsresls[j].name,data:[]})
						var veco5 = data["pucpurescorr"][data["pucpurescorr"].length-1].data
						var off1=0;var off2=0;
					        for (var i=0;i<Math.min(data.fuetimelsresls[j].data.length-off1,vec.length-off2);i++) {
						  var cv1 = data.fuetimelsresls[j].data[i+off1];
						  var cv2 = vec[i+off2];

						  if (cv1[0]>0)
						  if (cv1[0]===cv2[0]) {
						    if (cv2[1]!==-1 && cv2[1]>0.05 && cv1[1]>0.1) {//0.1 sec , 0.05 cpu
						      //console.log('c:' + cv2 + ' ' + cv1)
						      //var cv3=vec3[i+off2];
						      if (pileupmap.hasOwnProperty(cv1[0]))
						        //if (cv3[1]>=0.1)
						          veco5.push([pileupmap[cv1[0]],cv1[1]*cv2[1]])
						    }
						  }
						}
						veco5.sort(function(a, b){return a[0]>b[0]});
					    }
					}
				}

				var merge_whitelist = ["fusyscpu2","fudatain","fuetime","ramdisk","outputbw","fuetimelsres","fucpures","fucpures2","ratebytotal","lumi1","plumi1","fuetimels2","bwcompare","pucpu","purate","pucpu100khz","cpuctrl1","fuetimelsrescorr","fuetimelsrescorrmax","cpuctrl3","cpuctrl4","pucpurescorr","erate","erater"]

				merge_whitelist.forEach(function(hitem) {
					//console.log(Object.keys(data[hitem]))
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

								if (hitem=="fuetimels2" || hitem=="pucpurescorr") reverse = !reverse; //pu is dropping

								if (reverse) data_copy[hitem][item]['data'] = data[hitem][item]['data'].concat(data_copy[hitem][item]['data']);
								else data_copy[hitem][item]['data'] = data_copy[hitem][item]['data'].concat(data[hitem][item]['data']);
							}

						});

					}
					//sort by category name
					//data_copy[hitem]=data_copy[hitem].sort(function(a,b) {return a.name>b.name});
				});

				if (htmlruns.length==0) $('#start').html(data.runinfo.start);
				htmlruns.push(data.runinfo.run)
				htmldur+=parseInt(data.runinfo.duration)

			        nruns_plotted2++;
				if (nruns_tot2) setprogressbar2(100*(nruns_plotted2/nruns_tot2),false,false);

				if (runs.length) {
					doPlot(runs,-1,-1,true,true,true);
					return;
				}
	                        //$('#plots').show();


				$('#runinfo').show();
				$('#run').html(htmlruns.join());
				$('#start').html(data.runinfo.start);
				$('#end').html(data.runinfo.end);
				$('#duration').html(htmldur);
				//$('#unit').html(data.runinfo.interval);


//				plot('#plot10b','fu sys avg event time','line',data_copy["fuetime"],'datetime','time','seconds',undefined,undefined,0,undefined);

//				plot('#plot15','fu event time (appliance/resources)','line',data_copy["fuetimelsres"],multirun ? 'datetime':'',multirun?'time':'LS','seconds',undefined,undefined,0,undefined);

//				if (multirun) {
//					plot('#plotH0','inst lumi vs ls','line',data_copy["lumi1"],'datetime','time','',undefined,undefined,0,undefined);
//					plot('#plotH1','pileup vs ls','line',data_copy["plumi1"],'datetime','time','',undefined,undefined,0,undefined);
//				}
//
				plot('#plotH0','inst lumi vs ls','line',data_copy["lumi1"],multirun?'datetime':'',multirun?'time':'LS','Luminosity / 1e30 cm-2s-1',undefined,undefined,0,undefined);
				plot('#plotH1','pileup vs ls','line',data_copy["plumi1"],multirun?'datetime':'',multirun?'time':'LS','interactions / bx',undefined,undefined,0,undefined);
				plot('#plotH2','aggregated rate from eol','line',data_copy["ratebytotal"],multirun?'datetime':'',multirun?'time':'LS','events/s',undefined,undefined,0,undefined);

				plot('#plotA0','fu sys CPU usage/budget avg','line',data_copy["fusyscpu2"],'datetime','time','fraction',undefined,undefined,0,1,0.1);
				plot('#plotA1','fu sys CPU usage (appliance/resources)','line',data_copy["fucpures"],multirun ? 'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				plot('#plotA2','fu CPU budget (appliance/resources)','line',data_copy["fucpures2"],multirun?'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);

				plot('#plotB0','fu sys avg event time','line',data_copy["fuetime"],'datetime','time','seconds',undefined,undefined,0,undefined);
				plot('#plotB1','fu event time (appliance/resources)','line',data_copy["fuetimelsres"],multirun ? 'datetime':'',multirun?'time':'LS','seconds',undefined,undefined,0,undefined);
				plot('#plotB2','fu sys avg event time vs pileup','scatter',data_copy["fuetimels2"],'','pileup','seconds',undefined,pumax,0,0.75);


				plot('#plot10','ramdisk','line',data_copy["ramdisk"],'datetime','time','fraction used',undefined,undefined,0,undefined);
				plot('#plot11','fu data input','line',data_copy["fudatain"],'datetime','time','MB/s',undefined,undefined,0,undefined);
				plot('#plot12','output to BU','line',data_copy["outputbw"],'datetime','time','MB/s',undefined,undefined,0,undefined);


				plot('#plot20','fu sys CPU usage vs pileup'     ,'scatter',data_copy["pucpu"],     '','pileup','CPU fraction',undefined,pumax,0,1,0.1);
				plot('#plot21','L1 rate vs pileup'     ,'scatter',data_copy["purate"],     '','pileup','Hz',undefined,pumax,0,undefined,10000);
				plot('#plot22','fu sys CPU usage vs PU (scaled to 100kHz L1)'     ,'scatter',data_copy["pucpu100khz"],     '','pileup','CPU fraction',undefined,pumax,0,1.5,0.1);
				if ($('#testplots').is(':checked')) {

				  plot('#plot30','const fraction CPU when HT is off','line',data_copy["cpuctrl1"],multirun ? 'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				  plot('#plot31','corrected event time [x(1-const)] (when HT off)','line',data_copy["fuetimelsrescorr"],multirun ? 'datetime':'',multirun?'time':'LS','s',undefined,undefined,0,undefined);
				  plot('#plot32','BW compare (control plot)','scatter',data_copy["bwcompare"],multirun?'datetime':'',multirun?'time':'LS','a.u.',undefined,undefined,0,2);

				  plot('#plot40','CPU usage % without const contrib. (when HT off)','line',data_copy["cpuctrl3"],multirun ? 'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				  plot('#plot41','useful/ all CPU usage (when HT off)','line',data_copy["cpuctrl4"],multirun ? 'datetime':'',multirun?'time':'LS','fraction',undefined,undefined,0,undefined);
				  plot('#plot43','fu sys avg event time vs pileup (corrected [x(1-const)] when HT off)','scatter',data_copy["pucpurescorr"],'','pileup','seconds',undefined,/*pumax*/200,0,0.5);
				  ////plot('#plot43','corrected event time [x(1-const)] (when HT off) vs PU','scatter',data_copy["pucpurescorr"],'','pileup','pileup',undefined,pumax,0,undefined,10000);
				}
				plot('#plotR1','FU input event rate total','line',data_copy["erate"],'datetime','time','seconds',undefined,undefined,0,undefined);
				//plot('#plotR2','FU data/rate ratio','line',data_copy["erater"],'datetime','time','seconds',undefined,undefined,0,undefined);
				//plot('#plot42','max CPU time','line',data_copy["fuetimelsrescorrmax"],multirun ? 'datetime':'',multirun?'time':'LS','s',undefined,undefined,0,undefined);

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
			setTimeout(function () {setprogressbar2(100,true,false)},100);
		});
	});

}
function doLustrePlots(runstring,setup) {
  var s = $('input[name=setup]:checked', '#setups').val();
  //$.getJSON("php/lustre-history2.php?runs="+runstring+"&setup="+s, function(data) {
  //$.getJSON("php/lustre-history2nb.php?runs="+runstring+"&setup="+s, function(data) {
  //$.getJSON("php/lustre-history3.php?runs="+runstring+"&setup="+s, function(data) {
  $.getJSON("php/lustre-history.php?runs="+runstring+"&setup="+s, function(data) {
    plot('#plotL1','lustre occupancy','line',data.occupancies,'datetime','time','Occupancy %',undefined,undefined,0,undefined);
    //plot('#plotL2','lustre bandwidth','line',data.bandwidth,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
  });
}

function plot(tag,title,type,data,xaxis,xtitle,ytitle,xmin,xmax,ymin,ymax,ytickinterval) {
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
		},
		scatter: {marker:{radius:1.}}
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
	if (ytickinterval!==undefined) chartvar.yAxis["tickInterval"]=ytickinterval;
	if (xmin!==undefined) chartvar.xAxis["min"]=xmin;
	if (xmax!==undefined) chartvar.xAxis["max"]=xmax;
	if (ymin!==undefined) chartvar.yAxis["min"]=ymin;
	if (ymax!==undefined) chartvar.yAxis["max"]=ymax;

	var chart = $(tag).highcharts(chartvar);
	plots.push($(tag).highcharts());
	return chart;
}
