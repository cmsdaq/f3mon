function bootstrap(){

    //enable compression (custom header)
    $.ajaxSetup({
      headers : {   
          'f3mon-compression' : 'true'
      }
    });

    Highcharts.setOptions(Highcharts.theme_du);

    var autoplot=false;
    if (location.hash.length) {
      var hashrunpos = location.hash.indexOf('run=')
      if (hashrunpos!=-1) {
        var hashrunstring=location.hash.substr(hashrunpos+4)
        if (hashrunstring.indexOf('&')!=-1)
          hashrunstring = hashrunstring.substr(0,hashrunstring.indexOf('&'))
        $('#runno').val(hashrunstring);
        document.title = "mergerplots run "+hashrunstring;
        autoplot=true
      }
      else document.title="mergerplots";
      var hashstreampos = location.hash.indexOf('stream=')
      if (hashstreampos!=-1) {
        var hashstreamstring=location.hash.substr(hashstreampos+7)
        if (hashstreamstring.indexOf('&')!=-1)
          hashstreamstring = hashstreamstring.substr(0,hashstreamstring.indexOf('&'))
        if (hashstreamstring.length) {
          $('#stream').val(hashstreamstring);
          autoplot=true;
        }
      }
      var hashpos = location.hash.indexOf('minls=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+6)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        if (hashstring.length)
          $('#minls').val(hashstring);
      }
      else $('#minls').val()

      var hashpos = location.hash.indexOf('maxls=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+6)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        if (hashstring.length)
          $('#maxls').val(hashstring);
      }
      else $('#maxls').val()

      var hashpos = location.hash.indexOf('int=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+4)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        if (hashstring.length)
          $('#interval').val(hashstring);
      }
      else $('#interval').val(1)

      var hashpos = location.hash.indexOf('yaxis=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+6)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        if (hashstring.length)
          $('#yaxis').val(hashstring);
      }
      else $('#yaxis').val("diff")


      var hashpos = location.hash.indexOf('fullrun')
      if (hashpos!=-1) $('#fullrun').prop('checked',true)
      else $('#fullrun').prop('checked',false)

    }
    else {
      $('#runno').val()
      $('#stream').val()
      $('#minls').val()
      $('#maxls').val()
      $('#interval').val(1)
      $('#yaxis').val("diff")
      $('#fullrun').prop('checked', true);
      document.title="mergerplots";
    }

    //$('#runno').bind("propertychange change click keyup input paste", function(event){console.log('input!')});
    //$('#runno').bind("propertychange change input", function(event){console.log('input!')});
    //$('#fullrun_checked').val("checked");
    //$('#fullrun').prop('checked', true);
    //if (!$('#minls').val().length || isNaN($('#minls').val())) $('#minls').val(1);
    var timeout_rq;
    var run_iteration = function() {
        if (isNaN($('#runno').val()) || !$('#runno').val().length) return;
        //var mysetup = $('input[name=setup]:checked', '#setup').val();
        var mysetup = $('#setup option:selected').text();
        if (mysetup==="cdaq" && parseInt($('#runno').val())<=286591) mysetup="cdaq2016";//hack - will be replaced by year selector
        if (mysetup==="minidaq" && parseInt($('#runno').val())<=286591) mysetup="minidaq2016";//hack - will be replaced by year selector
	$.getJSON("api/maxls?runNumber="+$('#runno').val()+"&setup="+mysetup,function(data) {
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

    run_iteration();

    $('#plots').hide();
    $('#disable1').hide();
    $('#target').submit(function(event){
	    event.preventDefault();
	    $('#plots').hide();
	    $('#disable1').hide();
	    doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(),$('#stream').val(),$('#setup option:selected').text(),$('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	    $("#loading_dialog").loading();
	});
    if (autoplot) {
	    doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(),$('#stream').val(),$('#setup option:selected').text(),$('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	    $("#loading_dialog").loading();
    }
}
function doPlots(run,xaxis,yaxis,stream,setup,minls,maxls,fullrun){
    //console.log(minls+' '+maxls+' '+fullrun);
    location.hash='run='+run
    if (stream.length) location.hash+='&stream='+stream
    if (minls.length) location.hash+='&minls='+minls
    if (maxls.length) location.hash+='&maxls='+maxls
    var interval = parseInt($('#interval').val());
    if (interval>1) location.hash+="&int="+interval
    location.hash+="&yaxis="+$('#yaxis').val();
    if (fullrun) location.hash+='&fullrun'
    //console.log($('#process').val());
    var interval = $('#interval').val();
    var intervalStr = "";
    if (interval>1) intervalStr="&interval="+interval;

    var my_setup = setup;
    if (my_setup==="cdaq" && parseInt(run)<=286591) my_setup="cdaq2016";//hack - will be replaced by year selector

    if($('#process').val()=="merger"){
	//console.log("doing merger query");
        var mergerlsparams="&minls=&maxls=";
        if (!fullrun) mergerlsparams = '&minls='+minls+'&maxls='+maxls;
	$.getJSON("php/mergerplots.php?setup="+my_setup+"&run="+run+"&xaxis="+xaxis+"&yaxis="+yaxis+"&stream="+stream+mergerlsparams+intervalStr,function(data){
		plot(data["serie0"],'#plot0','micromerger time delay',xaxis,yaxis);
		plot(data["serie1"],'#plot1','minimerger time delay',xaxis,yaxis);
		plot(data["serie2"],'#plot2','macromerger time delay',xaxis,yaxis);
		plot(data["allsizes"],'#plot3','HLT output bw',xaxis,"MB/s");
                document.title = "mergerplots run "+data["run"];
		$("#loading_dialog").loading("loadStop");
		$('#plots').show();
		$('#disable1').show();
	    });
    }
    else if($('#process').val()=="BW"){
	console.log("doing transfer b/w");
	$.getJSON("php/transfer-test.php?setup="+my_setup+"&run="+run+"&xaxis="+xaxis+"&yaxis="+yaxis+"&stream="+stream,function(data){
		var points=[];
		for(var stream in data){
		    var entries = [];
		    for(var time in data[stream]){
			entries.push([time*1000,data[stream][time]]);
		    }
		    points.push({name:stream,data:entries});
		}
		console.log(points);
		plot(points,'#plot0','transfer b/w','time',yaxis);
		$("#loading_dialog").loading("loadStop");
		$('#plots').show();
		$('#disable1').show();
	    });
    }else{
	console.log("doing transfer query");
	query = "php/transfer-test.php?setup="+my_setup+"&run="+run+"&stream="+stream+"&xaxis="+xaxis+"&chart=yes";
	console.log(query);
	$.getJSON(query,function(data){
		console.log(data);
		plot(data["serie1"],'#plot1','copy time delay',xaxis,'seconds');
		plot(data["serie2"],'#plot2','copy bw',xaxis,'MB/s');
		plot(data["0"]["copytime"],'#plot3','transfer time','seconds','files');
		plot(data["1"]["bw"],'#plot4','bandwidth freq','MB','files');

		$("#loading_dialog").loading("loadStop");
		$('#plots').show();
		$('#disable1').show();
	    });
    }

}
function plot(plotData,tag,title,xaxis,yaxis) {
    xAxisType="";
    switch(xaxis){
    case "size":
	plottype='scatter';
	break;
    case "ls":
	plottype='line';
	break;
    case "time":
	plottype='line';
	xAxisType='datetime';
	break;
    case "seconds":
	plottype='bar';
	break;
    case "MB":
	plottype='bar';
	break;
    default:
    }
    ytitle = yaxis=='lap' ? 't_i(ls)-t_i(ls-1)' : 't_i+1(ls)-t_i(ls)';

    if(yaxis!='lap' && yaxis!='diff'){
	ytitle=yaxis;
    }
    $(tag).highcharts({
	    chart: { 
		type: plottype,
		    zoomType : 'xy'
		    },    
	    title: {
		text: title,
		    x: -20 //center
		    },
		subtitle: {
		text: 'Source: elasticsearch main',
		    x: -20
		    },
		yAxis: {
		title: {
		    text: ytitle
			},
		    plotLines: [{
			value: 0,
			    width: 1,
			    color: '#808080'
			    }]
		    },
		xAxis: {
		type: xAxisType,
		title: {
		    text: xaxis
			}
		    },
		tooltip: {
		valueSuffix: ' '+ytitle
		    },
		legend: {
		layout: 'vertical',
		    align: 'right',
		    verticalAlign: 'middle',
		    borderWidth: 0
		    },
		series: plotData
		});
    var chart = $(tag).highcharts();
    var button = $('#disable1');
    button.click(function () {

	    for(var series in chart.series ){
		console.log(series);
		if (chart.series[series].visible) {
		    chart.series[series].setVisible(false,false);
		    button.html('Show series');
		} else {
		    chart.series[series].setVisible(true,false);
		    button.html('Hide series');
		}
	    }
	});

}
