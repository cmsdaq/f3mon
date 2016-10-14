var refseries=[];
var plots=[];
var autoplot = false;

var runlsinfo = {};

function bootstrap(){

    //console.log('Hash1:'+location.hash);
    autoplot=false
    minmax=false
    var templsmap = {}
    //console.log(location.hash.length)
    if (location.hash.length) {
      var hashpos = location.hash.indexOf('&theme=blue')
      if (hashpos!=-1) {
        $('#blue').attr('checked',true);
        location.hash=location.hash.substr(0,hashpos) //strip temp hash
      }
      var hashpos = location.hash.indexOf('&theme=black')
      if (hashpos!=-1) { 
        $('#black').attr('checked',true);
        location.hash=location.hash.substr(0,hashpos)
      }
      var hashpos = location.hash.indexOf('&theme=white')
      if (hashpos!=-1) {
        $('#white').attr('checked',true);
        location.hash=location.hash.substr(0,hashpos)
      }
      var hashpos = location.hash.indexOf('run=')
      if (hashpos!=-1) {
        var hashstring=location.hash.substr(hashpos+4)
        if (hashstring.indexOf('&')!=-1)
          hashstring = hashstring.substr(0,hashstring.indexOf('&'))
        if (hashstring.indexOf(':')!=-1) {
         //parse hash string
         var rnsarr = []
         var rns = hashstring.split(',');
         rns.forEach(function(rn){
         if (rn.indexOf(':')!=-1) {
           var rntokens = rn.split(':')
           rnsarr.push(rntokens[0]);
	   templsmap[rntokens[0]]=[true,rntokens[1]=="true"?true:false,rntokens[2]=="true"?true:false,parseInt(rntokens[3]),parseInt(rntokens[4])];
	   //templsmap[rntokens[0]]=[true,rntokens[1],rntokens[2],parseInt(rntokens[3]),parseInt(rntokens[4])];

           //console.log('rntokens:'+rntokens[0] + JSON.stringify(templsmap[rntokens[0]]))
         }
         else rnsarr.push(rn);
         });
         //console.log(rnsarr.join(','));
         $('#runno').val(rnsarr.join(','));
        }
        else $('#runno').val(hashstring);
        document.title = "run "+hashstring;
        autoplot=true
      }
    }
    if (!autoplot) {
      document.title="";
      //$('#runno').val("");
    }
    //if (!minmax)
 
    //$("#loading_dialog").loading();
	    //    $('#loading_dialog').hide();
    $('#dialog').hide();
    $('#plots').hide();
    $('#runinfo').hide();
    $( "#radio2" ).buttonset();
    $('#target').submit(function(event){
            event.preventDefault();
            doPlots($('#runno').val(),$('#xaxis').val(),$('#yaxis').val());
	    $("#loading_dialog").loading();
        });

    /*
    var timeout_rq;
    var fill_iteration = function() {
        if (isNaN($('#fillno').val()) || !$('#fillno').val().length) return;
	$.getJSON("php/fill.php?fill="+$('#fillno').val(),function(data) {
          console.log(Object.keys(data))
          //if (data.length!=null) {
            //console.log(JSON.stringify(data));
            //$('#maxls').val(data.maxls);
            //$('#minls').val(1);
          //}
        });
    }
    $('#fillno').bind("input",
      function(event){
        clearTimeout(timeout_rq);
        timeout_rq = setTimeout(fill_iteration,330);
      }
    );*/

    var makeTable = function(newcache) {
      //console.log('maketable'+JSON.stringify(newcache))
      runlsinfo = newcache;
      //inject parsed info
      Object.keys(runlsinfo).forEach(function(item) {
        if (templsmap.hasOwnProperty(item))
          runlsinfo[item]=templsmap[item];
      });
      //console.log(JSON.stringify(runlsinfo))
      templsmap = {};
      $("#runinfo2 > tbody").html("");
      $('#runinfo2 > tbody:last-child').append('<tr><th>Runs</th><th>LS from</th><th>LS to</th><th>full range</th><th>include</th>');
      Object.keys(runlsinfo).sort().forEach(function(item) {
        var obj = runlsinfo[item];
        //console.log(item+' '+JSON.stringify(obj[2]))
        if (obj[0]) {
          var in1 ='<input size="4" class="pure-form" id="minls'+item+'" action="" value="'+obj[3]+'" change="toggleMinLS(this)"/>';
          var in2 ='<input size="4" class="pure-form" id="maxls'+item+'" action="" value="'+obj[4]+'" change="toggleMaxLS(this)"/>';

          var in3 ='<input type="checkbox" id="fullr'+item+'" name="alternative" checked="'+obj[2]+'" onchange="toggleFull(this)"/>';
          var in4 ='<input type="checkbox" id="include'+item+'" name="alternative" checked="'+obj[1]+'" onchange="toggleInclude(this)"/>';
          //var in1 ='<input class="pure-form" id="minls"'+item+' action="">'+obj[2]+'</input>;
          //var in1 ='<input class="pure-form" id="minls"'+item+' action="">'+obj[2]+'</input>;
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
          $.getJSON("api/maxls?runNumber="+rn,function(data) {
            if (data.maxls!=null)
              newcache[rn] = [true,true,true,1,data.maxls];
            else
              newcache[rn] = [false,false,false,1,data.maxls];
            if (!runs.length) {
                /*if (Object.keys(newcache).length == nruns)*/ makeTable(newcache);
            }
            else checkRun(runs);
          });
        }
        if (checkruns.length) checkRun(checkruns);
        else 
        /*if (Object.keys(newcache).length == nruns)*/ makeTable(newcache);
    }
    $('#runno').bind("input",
      function(event){
        clearTimeout(timeout_rq);
        timeout_rq = setTimeout(runs_iteration,330);
      }
    );
    runs_iteration();
    $("#runinfo2").hide();
/*
    if (autoplot) {
            //console.log('autoplotting')
	    $("#loading_dialog").loading();
            doPlots($('#runno').val());
    }
*/

}

function setlink() {
    //console.log($('#runno').val())
    hstrvec = []
    Object.keys(runlsinfo).forEach(function(item) {
      var entry = runlsinfo[item];
      if (entry[0]) {
        if (entry[1] && entry[2]) hstrvec.push(item);
        else hstrvec.push([item,entry[1],entry[2],entry[3],entry[4]].join(':'));
      }
    });
    //location.hash='run='+$('#runno').val();
    location.hash='run='+hstrvec.join(',');
}

function setThemeHash(theme) {
location.hash+="&theme="+theme
}

function toggleMinLS(obj) {
  //console.log('toggle maxls '+obj.id.substring(5)+' ' +obj.value)
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
  runlsinfo[obj.id.substring(5)][3]=parseInt(obj.value);
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
}


function toggleMaxLS(obj) {
  //console.log('toggle minls '+obj.id.substring(5)+' '+obj.value)
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
  runlsinfo[obj.id.substring(5)][4]=parseInt(obj.value);
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
}


function toggleFull(obj) {
  //console.log('toggle full '+obj.id.substring(5))
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
  runlsinfo[obj.id.substring(5)][2]=!runlsinfo[obj.id.substring(5)][2]
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(5)]))
}


function toggleInclude(obj) {
  //console.log('toggle include '+obj.id.substring(7))
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(7)]))
  runlsinfo[obj.id.substring(7)][1]=!runlsinfo[obj.id.substring(7)][1]
  //console.log(JSON.stringify(runlsinfo[obj.id.substring(7)]))
}


function modifyEntry() {
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
    console.log('H-:'+location.hash);

    //(re)set highcharts theme
    //console.log('blue ' +$('#blue').is(':checked'));
    //console.log('black '+$('#black').is(':checked'));
    if ($('#blue').is(':checked'))
      Highcharts.setOptions(Highcharts.theme_db);
    else if ($('#black').is(':checked'))
      Highcharts.setOptions(Highcharts.theme_du);
    else
      Highcharts.setOptions(undefined);

    pumask=[];
    var pumaskstr=$('#maskpu').val();
    pumaskstr.split(',').forEach(function(item) {
      var tks = item.split('-');
      console.log(item + ' : '+ tks.length)
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
    $.ajaxSetup({
	    async: true
		});
    plots=[];
    method1 = !$('#alternative').is(':checked');
    data_copy = {};
    data_copy2 = {};
    refseries.splice(0,refseries.length); //delete content of refseries array from previous doPlots
    manyruns = $('#runno').val().split(',').length>1;
    minpu1=-1;
    runlist_copy = JSON.parse(JSON.stringify(runlsinfo)); 
    //console.log('X:'+JSON.stringify(runlsinfo))
    runlist_keys = Object.keys(runlist_copy).sort();
    //doPlot($('#runno').val().split(','))
    if (runlist_keys.length>0)
      doPlot(runlist_keys)
    else
      $("#loading_dialog").loading("loadStop");
}


function createPlots() {

              var maxpu_plot = 60;
              var maxpu =  $('#maxpu').val();
              maxpu_glob = maxpu;
              if (isNaN(parseInt(maxpu))) {if ($("#fitputime").is(':checked')) maxpu=60; else maxpu=50;} else maxpu=parseInt(maxpu);
              if (parseInt(maxpu)<20) maxpu=20; else maxpu=parseInt(maxpu);
              if (!isNaN(parseInt(maxpu))) maxpu_plot=parseInt(maxpu);

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
              plot('#plot13','fu sys avg event time vs pileup','scatter',data_copy["fuetimels"],'','Pileup','seconds',undefined,maxpu,0,0.5);
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
              plot('#plot14','fu sys avg event time vs pileup','scatter',data_copy2["fuetimels2"],'','Pileup','seconds',undefined,maxpu,0,0.5);
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
    //if (!runinfo[0] || !runinfo[1]) {doPlot(runlist);return;} //invalid or excluded run
    var lspart=""
    if (!runinfo[2]) {
      lspart = "&minls="+runinfo[3]+"&maxls="+runinfo[4];
    }
    $.getJSON("php/lumi.php?run="+run,function(datadb){
      $('#fill').html(datadb.fill.data);
      plot('#plot1a','pileup vs ls','scatter',datadb["plumi1"]);//? needs to be plotted??
      //console.log(JSON.stringify(datadb["plumi1"]));
      var pileupmap = {};
      if (datadb["plumi1"][0].data.length) {
        var minpu = datadb["plumi1"][0].data[datadb["plumi1"][0].data.length-1][1];

        for (var j=0;j<datadb["plumi1"][0].data.length;j++) {
        //datadb["plumi1"][0].data.forEach(function(item) {
          item = datadb["plumi1"][0].data[j];
          var stable = datadb["run"][1].data[j];//stable beams
          if (stable && item[1]>minpu && item[1]>1.)//min PU value shown
            {
             var ismasked=false;
             pumask.forEach(function(maskitm){if (item[1]>=maskitm[0] && item[1]<maskitm[1]) ismasked=true;});
             if (!ismasked)
               pileupmap[item[0]]=item[1];
            }
        }//);
      }

      if (method1)
        var phpstr = "php/puplot.php?run=";
      else
        var phpstr = "php/puplotalt.php?run=";
      $.getJSON(phpstr+run+lspart,function(data){

            


            //console.log('data.runinfo.start'+data.runinfo.start)
	    if(data.runinfo.start !=null){
                hadsomething=true;
		$('#runinfo').show();		
                //console.log(JSON.stringify(data["fuetimels"][0]))
		var datavec = []
                var origvec = data["fuetimels"][0].data
                //console.log(JSON.stringify(data["fuetimels"][0].data));
		for (var i=0;i<origvec.length;i++) {
                  var ls = origvec[i][0];
                  if (pileupmap.hasOwnProperty(ls))
                    datavec.push([pileupmap[ls],origvec[i][1]])
                    if (minpu1==-1 || minpu1>pileupmap[ls]) minpu1 = pileupmap[ls];
                }
                datavec.sort(function(a, b){return a[0]>b[0]});
                data["fuetimels"][0].data = datavec;
                //console.log(JSON.stringify(data["fuetimels"][0].data));
		//plot('#plot13','fu sys avg event time vs pileup','scatter',data["fuetimels"],'datetime','LS','seconds');
                data["fuetimels"][0]["name"]=run
                if (!data_copy.hasOwnProperty("fuetimels"))
                  data_copy["fuetimels"]=[data["fuetimels"][0]]
                else
                  data_copy["fuetimels"].push(data["fuetimels"][0])

                //plot15
                if (method1) {
		datavec = []
                origvec = data["fuesizels"][0].data
                //console.log(JSON.stringify(data["fuetimels"][0].data));
		for (var i=0;i<origvec.length;i++) {
                  var ls = origvec[i][0];
                  if (pileupmap.hasOwnProperty(ls))
                    datavec.push([pileupmap[ls],origvec[i][1]])
                }
                datavec.sort(function(a, b){return a[0]>b[0]});
                data["fuesizels"][0].data = datavec;
                //console.log(JSON.stringify(data["fuetimels"][0].data));
		//plot('#plot13','fu sys avg event time vs pileup','scatter',data["fuetimels"],'datetime','LS','seconds');
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
                  //console.log(JSON.stringify(data["fuetimels2"][j]));
		  for (var i=0;i<origvec.length;i++) {
                    var ls = origvec[i][0];
                    if (pileupmap.hasOwnProperty(ls))
                      datavec.push([pileupmap[ls],origvec[i][1]])
                  }
                  datavec.sort(function(a, b){return a[0]>b[0]});
                  data["fuetimels2"][j].data = datavec;
                  //console.log(JSON.stringify(data["fuetimels"][0].data));
                  //data["fuetimels"][j]["name"]=run
                  if (j==0) {
                    if (!data_copy2.hasOwnProperty("fuetimels2"))
                      data_copy2["fuetimels2"]=[data["fuetimels2"][0]]
                    else
                      data_copy2["fuetimels2"].push(data["fuetimels2"][0])
                  }
                  else data_copy2["fuetimels2"].push(data["fuetimels2"][j]);
                }
                }

                //plot16
                if (method1) {
 		datavec = []
                origvec = data["eolsrate"][0].data
                 //console.log(JSON.stringify(data["fuetimels"][0].data));
 		for (var i=0;i<origvec.length;i++) {
                   var ls = origvec[i][0];
                   if (pileupmap.hasOwnProperty(ls))
                     datavec.push([pileupmap[ls],origvec[i][1]])
                }
                datavec.sort(function(a, b){return a[0]>b[0]});
                data["eolsrate"][0].data = datavec;
                //console.log(JSON.stringify(data["fuetimels"][0].data));
 		//plot('#plot13','fu sys avg event time vs pileup','scatter',data["fuetimels"],'datetime','LS','seconds');
                //data["fuetimels"][0]["name"]=run
                if (!data_copy.hasOwnProperty("eolsrate"))
                  data_copy["eolsrate"]=[data["eolsrate"][0]]
                else
                  data_copy["eolsrate"].push(data["eolsrate"][0])
                }

	    }
            if (!runlist.length) {
              createPlots();
              //TODO make closure
              //console.log(JSON.stringify(data_copy))
              /*
              plot('#plot13','fu sys avg event time vs pileup','scatter',data_copy["fuetimels"],'','Pileup','seconds',undefined,50,0,0.5);
              if (method1)
              plot('#plot15','avg event size vs pileup','scatter',data_copy["fuesizels"],'','Pileup','size',undefined,50,undefined,2000000);

              //console.log(minpu1)
              if (minpu1==-1)
                plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',undefined,50,0,undefined);
              else
                plot('#plot16','L1 (HLT input) rate vs pileup','scatter',data_copy["eolsrate"],'','Pileup','Hz',minpu1,50,0,undefined);

              if (method1 && !manyruns)
              plot('#plot14','fu sys avg event time vs pileup','scatter',data_copy2["fuetimels2"],'','Pileup','seconds',undefined,50,0,0.5);
              //plot('#plot14','fu sys avg event time vs pileup','scatter',data["fuetimels2"],'','Pileup','seconds',undefined,50,0,0.5);
	      $("#loading_dialog").loading("loadStop");
	      $('#plots').show();
              */
            }
            else doPlot(runlist);
	});
    });
}

function plot(tag,title,type,data,xaxis,xtitle,ytitle,xmin,xmax,ymin,ymax) {
    xaxis = typeof xaxis !== 'undefined' ? xaxis : '';
    xtitle = typeof xtitle !== 'undefined' ? xtitle : 'LS';
    ytitle = typeof ytitle !== 'undefined' ? ytitle : 'A.U.';
    plottype = type;
    plotoptions = type == 'scatter' ? {
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

    //console.log(JSON.stringify(data))

    chartvar = {

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
	        tickInterval: 2,
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


