var refseries=[];
var plots=[];


function bootstrap(){
    Highcharts.setOptions(Highcharts.theme_du);
    //$("#loading_dialog").loading();
	    //    $('#loading_dialog').hide();
    $('#dialog').hide();
    $('#plots').hide();
    $('#runinfo').hide();
    $( "#radio2" ).buttonset();
    $('#target').submit(function(event){
            event.preventDefault();
            doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val(), $('#minls').val(),$('#maxls').val(),$('#fullrun').is(':checked'));
	    $("#loading_dialog").loading();
        });
    $('#maxls').val("");
    $('#minls').val("");
    $('#fullrun').prop('checked',true);
    //    
    
    var timeout_rq;
    var run_iteration = function() {
        if (isNaN($('#runno').val()) || !$('#runno').val().length) return;
        var mysetup = $('input[name=setup]:checked', '#setups').val();
        if (mysetup==="cdaq" && parseInt($('#runno').val())<=286591) mysetup="cdaq2016";//hack - will be replaced by year selector
	$.getJSON("api/maxls?runNumber="+$('#runno').val()+'&setup='+mysetup,function(data) {
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

}

function toggleBu(racks){
    console.log("toggleBu called");
    console.log(racks);
    $.each(plots,function(i,plot){
     	    $.each(plot.series, function(j,series){
     		    rack = series.name.split('-')[1];
     		    bu = series.name.split('-')[2];
     		    if(rack!==undefined && bu !==undefined){
     			console.log(rack+"-"+bu+" state ="+racks[rack].bus[bu]);
     			if(racks[rack]!==undefined){
    			    if(racks[rack].bus[bu]){
    				series.setVisible(true,false);
    			    }
    			    else if(racks[rack].bus[bu]!==undefined){
    				series.setVisible(false,false);
    			    }
    			}
     		    }
     		});
     	});
}

function toggleRack(racks){
    $.each(plots,function(i,plot){
	    $.each(plot.series, function(j,series){
		    if(series.name.split('-')[1]!==undefined){
			if(racks[series.name.split('-')[1]].state){
			    series.setVisible(true,false);
			}
			else if(racks[series.name.split('-')[1]].state!==undefined){
			    series.setVisible(false,false);
			}
		    }
		});
	});
}

function doPlots(run,xaxis,yaxis,minls,maxls,fullrun){
    $.ajaxSetup({
	    async: true
		});
    plots=[];
    refseries.splice(0,refseries.length); //delete content of refseries array from previous doPlots
    if (!fullrun) var lspart="&minls="+minls+"&maxls="+maxls;
    else var lspart="&minls=&maxls="; 

    var my_setup = $('input[name=setup]:checked', '#setups').val();
    if (my_setup==="cdaq" && parseInt(run)<=286591) my_setup="cdaq2016";//hack - will be replaced by year selector

    pippo=$.getJSON("php/appliance_analysis.php?run="+run+"&setup="+my_setup+lspart,function(data){

	    if(data.runinfo.start !=null){
		$('#runinfo').show();		
		$('#run').html(data.runinfo.run);
		$('#start').html(data.runinfo.start);
		$('#end').html(data.runinfo.end+'<br>('+data.runinfo.ongoing+')');
		$('#duration').html(data.runinfo.duration);
		$('#unit').html(data.runinfo.interval);

		racks = {};
		$('#bus').html('');
		for(i in data["ratebybu"]){
		    rack = (data["ratebybu"][i].name).split('-');
		    if(!racks.hasOwnProperty(rack[1])){
			racks[rack[1]]={};
			racks[rack[1]].state=true;
			racks[rack[1]].bus={};
		    }
		    racks[rack[1]].bus[rack[2]]=true;
		}
		$('#bus').append('<tr>');
		for(i in racks){
		    $('#bus').append('<th colspan=2>'+i+'</th>');
		}
		$('#bus').append('</tr><tr>');		    
		for(i in racks){
		    $('#bus').append('<td id="'+i+'">'+(racks[i].state?"On ":"Off")+'</td>');
		    $('#'+i).click(function(event){
			    for(j in racks[event.target.id].bus){
				racks[event.target.id].bus[j]=!racks[event.target.id].bus[j];
				$('#'+event.target.id+'-'+j).css('background-color',(racks[event.target.id].bus[j]?'green':'red'));
			    }
			    racks[event.target.id].state = !racks[event.target.id].state;
			    $(this).html(racks[event.target.id].state?"On ":"Off");
			    toggleRack(racks);
			});
		    //		    $('#bus').append('<td id="bu'+i+'">');
		    for(j in racks[i].bus){
		    	$('#bus').append('<div id="'+i+'-'+j+'" style="color:white;background-color:'+(racks[i].bus[j]?'green':'red')+';">'+j+'</div>');
			$('#'+i+'-'+j).click(function(event){
				rack=event.target.id.split('-')[0];
				bu=event.target.id.split('-')[1];
				console.log(rack+" "+bu);
				racks[rack].bus[bu]=!racks[rack].bus[bu];
				$('#'+event.target.id).css('background-color',(racks[rack].bus[bu]?'green':'red'));
				toggleBu(racks);
			    });

		    }
		    $('#bus').append('</td>');
		    
		}

		$('#bus').append('</tr>');


		//plot('#plot1','ls duration from index','line',data["series1"],'','LS','time in seconds');
		//plot('#plot2','rate from index','line',data["series2"],'','LS','rate (1/s)');
		//plot('#plot2B','bandwidth from index','line',data["series3"],'','LS','rate (B/s)');
		plot('#plot3','ramdisk','line',data["ramdisk"],'datetime','time','fraction used');
		plot('#plot3a','output to BU','line',data["outputbw"],'datetime','time','MB/s');
		plot('#plot4','rate from eol','line',data["ratebybu"]);
		plot('#plot4B','bandwidh from eol','line',data["bwbybu"]);
		plot('#plot5','aggregated rate from eol','line',data["ratebytotal"]);
		//plot('#plot7','starttimes','line',data["begins"],'datetime','time','ls');
		//plot('#plot8','endtimes','line',data["ends"],'datetime','time','ls');
		//plot('#plot9','ratebyfile','line',data["series3"],'datetime','time','rate');
		plot('#plot10','fu sys cpu usage frac','line',data["fusyscpu"],'datetime','time','fraction');
		plot('#plot10a','fu sys cpu usage frac avg','line',data["fusyscpu2"],'datetime','time','fraction');
		plot('#plot10b','fu sys avg event time','line',data["fuetime"],'datetime','time','seconds');
		plot('#plot11','fu sys cpu freq','line',data["fusysfreq"],'datetime','time','fraction');
		plot('#plot12','fu data input','line',data["fudatain"],'datetime','time','MB/s');
		plot('#plot13','lumisection output data B/W','line',data["lumibw"],'datetime','time','MB/s');
		//	    plot('#plot6','agg rate from eol','line',data["ratebytotal"]);
		if(refseries.length==0){
		    for(var i in data.ratebybu){
			refseries.push(data.ratebybu[i].name);
		    }
		}
		if(data["series1"].length!=refseries.length){
		    console.log(data["series1"].length+' vs.'+refseries.length)
		}
	    }else{
		$('#run').html(data.runinfo.run);
		$('#start').html('not found / not started');
		$('#runinfo').show();		
	    }
	    $("#loading_dialog").loading("loadStop");
	    $('#plots').show();
	});
    $.getJSON("php/lumi.php?run="+run,function(data){
	    $('#fill').html(data.fill.data);
	    plot('#plot6','inst lumi vs ls','line',data["lumi"]);
	    
	});

}

function makeSeriesMap(series){
}

function plot(tag,title,type,data,xaxis,xtitle,ytitle) {
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
    var chart = $(tag).highcharts({
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
	});
    plots.push($(tag).highcharts());
    return chart;
}
