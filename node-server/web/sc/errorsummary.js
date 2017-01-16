var refseries=[];
var plots=[];
var autoplot = false;

var runlsinfo = {};


function bootstrap(){
  $("#leg").hide();
  $("#title").hide();
  $.getJSON("php/errorsummary.php",function(data) {
    $("#leg").show();
    $("#title").show();
    $('#runlabel').html("run")
    var cellids = [];


    squidCount=0;
    Object.keys(data.runerrorsfrontier).forEach(function(squidrun) {
      squidCount+=data.runerrorsfrontier[squidrun];
    });


    //inverse sort
    var codesort = function(a,b) {
      if (parseInt(a)<0 && parseInt(b)<0) return parseInt(b)-parseInt(a);
      return parseInt(a)-parseInt(b);
    }

    //console.log(JSON.stringify(data.summary));
    Object.keys(data.summary).sort(codesort).forEach(function(key){
      if (data.summary.hasOwnProperty(key))
        console.log(key + ' ' + data.summary[key])
       if (!isNaN(key) && (parseInt(key)<0))
         $('#tblhdr').append('<th>signal '+(-parseInt(key))+'</th>');
       else
         $('#tblhdr').append('<th>code '+key+'</th>');
       cellids.push(key);
    });
    if  (squidCount>0)
      $('#tblhdr').append('<th>frontier code 66</th>');

    var ordinal=0;

    //inverse sort
    var runsort = function(a,b) {
      return parseInt(b)-parseInt(a);
    }

    squidCount=0;
    Object.keys(data.runerrorsfrontier).forEach(function(squidrun) {
      squidCount+=data.runerrorsfrontier[squidrun];
    });

    Object.keys(data.runs).sort(runsort).forEach(function(runkey) {

      if (ordinal%2==0)
        var newrow = '<tr style="background-color:gainsboro"><td>'+runkey+"</td>";
      else
        var newrow = '<tr ><td>'+runkey+"</td>";
      ordinal++;


      cellids.forEach(function(key) {
        if ((data.runs[runkey]).hasOwnProperty(key)) {
            if (key=="66" && data.runerrorsfrontier.hasOwnProperty(runkey)) {
              var newval = data.runs[runkey][key]-data.runerrorsfrontier[runkey];
              if (newval<=0) {newval="";data.runerrorsfrontier[runkey]=data.runs[runkey][key];}
              data.runs[runkey][key]=newval;
            }
            newrow+='<td>'+data.runs[runkey][key]+'</td>'
          }
        else
          newrow+='<td/>';
      });
      if (squidCount) {
        newrow+="<td>";
        if (data.runerrorsfrontier.hasOwnProperty(runkey)) newrow+=data.runerrorsfrontier[runkey];
        newrow+="</td>";
      };
      newrow+="</tr>";
      $('#runinfo2').append(newrow);

    });

    if (ordinal%2==0)
      var newrow = '<tr style="background-color:gainsboro"><td>Summary</td>';
    else
      var newrow = "<tr><td>Summary</td>";
    cellids.forEach(function(key) {
      if ((data.summary).hasOwnProperty(key)) {
        if (key=="66") {
          data.summary[key]=data.summary[key]-squidCount;
          if (data.summary[key]<=0) {squidCount=data.summary[key]; data.summary[key]="";}
        }
        newrow+='<td>'+data.summary[key]+'</td>'
      }
      else
        newrow+='<td/>';
    });
    if (squidCount>0) newrow+='<td>'+squidCount+'</td>'
    newrow+="</tr>";
    $('#runinfo2').append(newrow);
  });
}


