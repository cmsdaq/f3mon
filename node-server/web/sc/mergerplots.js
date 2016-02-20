function bootstrap(){

    $('#plots').hide();
    $('#disable1').hide();
    $('#target').submit(function(event){
	    event.preventDefault();
	    $('#plots').hide();
	    $('#disable1').hide();
	    doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(),$('#stream').val());
	    $("#loading_dialog").loading();
	});
}
function doPlots(run,xaxis,yaxis,stream){

    console.log($('#process').val());
    if($('#process').val()=="merger"){
	console.log("doing merger query");
	$.getJSON("php/mergerplots.php?setup=cdaq&run="+run+"&xaxis="+xaxis+"&yaxis="+yaxis+"&stream="+stream,function(data){
		plot(data["serie0"],'#plot0','micromerger time delay',xaxis,yaxis);
		plot(data["serie1"],'#plot1','minimerger time delay',xaxis,yaxis);
		plot(data["serie2"],'#plot2','macromerger time delay',xaxis,yaxis);
		$("#loading_dialog").loading("loadStop");
		$('#plots').show();
		$('#disable1').show();
	    });
    }
    else if($('#process').val()=="BW"){
	console.log("doing transfer b/w");
	$.getJSON("php/transfer-test2.php?setup=cdaq&run="+run+"&xaxis="+xaxis+"&yaxis="+yaxis+"&stream="+stream,function(data){
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
	query = "php/transfer-test.php?run="+run+"&stream="+stream+"&xaxis="+xaxis+"&chart=yes";
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
