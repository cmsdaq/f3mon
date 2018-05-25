'use strict';

var plots=[];

/*
function parseHash(key) {
	var hashpos = location.hash.indexOf(key+"=");
	if (hashpos==-1) return undefined;
	var hashstring=location.hash.substr(hashpos+key.length+1);
	if (hashstring.indexOf('&')!=-1)
		hashstring = hashstring.substr(0,hashstring.indexOf('&'))
	//if empty string is valid value, caller needs to verify undefined vs empty string
	return hashstring;
}
*/


var link_fillselect;
var fill_iteration;

var reset_state = function() {
  $('#plots').hide();
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

        var now = new Date();
        var yesterday = new Date(now.getTime()-1000*3600*24);

	var zPad = function (num) {
	  if (num>10) return ""+num; 
	  else return "0"+num;
	}
	var convDate = function(d,roundMin) {
	  return d.getFullYear()+"-"+zPad(d.getMonth()+1)+"-"+zPad(d.getDate()) 
	         + " " 
		 + zPad(d.getHours() + (d.getMinutes()>0 && roundMin==true ? 1:0))+":00:00";
		 //+ zPad(d.getHours()) + ":" + zPad(d.getMinutes() + d.getSeconds()>0 && roundMin==true ? 1:0)+":00";
	}
		 
	console.log(convDate(yesterday,true))
	console.log(convDate(now,true))
	var fnow = convDate(now,true)
	var fyesterday = convDate(yesterday,false)
        $("#datepicker1" ).datetimepicker({format:'Y-m-d H:i:s',inline:true,minDate:'2018/05/11',weeks:true,defaultDate:fyesterday});
        $("#datepicker2" ).datetimepicker({format:'Y-m-d H:i:s',inline:true,minDate:'2018/05/11',weeks:true,defaultDate:fnow});
	$("#datepicker1").val(fyesterday)
	$("#datepicker2").val(fnow)

	Highcharts.setOptions(Highcharts.theme_du);

        document.title=''

        //parse hash
/*	
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
*/
	$('#plots').hide();

        //button press
	$('#target').submit(function(event){
                //default: no fill or run specified. show last run number
		event.preventDefault();
		var from = new Date($('#datepicker1').val()).toISOString();
		var to = new Date($('#datepicker2').val()).toISOString();
		//change light-blue default value to plotted one
		$('#datepicker1').datetimepicker('setOptions',{defaultDate:$('#datepicker1').val()})
		$('#datepicker2').datetimepicker('setOptions',{defaultDate:$('#datepicker2').val()})
		console.log('from '+from)
		console.log('to '+to)
		doPlots(from,to);
		$("#loading_dialog").loading();
	});

}

//set hash
/*
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
*/

//plot runs
function doPlots(from,to)
{
	$('#start').html("");
	$('#plots').hide();
	$('#runinfo').show();
	console.log('show progress bar ... ')
	//cleanup
	for (var i=0;i<plots.length;i++) plots[i].destroy();
	plots=[];
	var cb = function() {
	  $("#loading_dialog").loading("loadStop");
	  $('#plots').show();
	}
	doLustrePlots(from,to,cb);
}

function doLustrePlots(from,to,cb) {
  var s = $('input[name=setup]:checked', '#setups').val();
  var gbw = $('#bwcheckbox').prop('checked') ? "&getbandwidth=true": "";
  $.getJSON("php/lustre-history.php?setup=cdaq"+gbw+"&from="+from+"&to="+to, function(data) {
    plot('#plotL1','lustre occupancy','line',data.occupancies,'datetime','time','Occupancy %',undefined,undefined,0,undefined);
    if (gbw!="") {
      plot('#plotLA','lustre Total bandwidth','line',data.allbw,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
      plot('#plotL2','lustre WRITE bandwidth (OSS)','line',data.bandwidth_tw,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
      plot('#plotL3','lustre READ bandwidth (OSS)','line',data.bandwidth_tr,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
      plot('#plotL4','lustre WRITE bandwidth (OSS/OST)','line',data.bandwidth_aw,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
      plot('#plotL5','lustre READ bandwidth (OSS/OST)','line',data.bandwidth_ar,'datetime','time','Bandwidth MB/s',undefined,undefined,0,undefined);
    }
    cb();
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
		/*series: {
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
		},*/
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
