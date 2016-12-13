
var minidaqbu="null";

var lastruninfo = undefined;

function bootstrap() {
  console.log('bootstrap')
  $('input[name="setup"]').change(function(){
      console.log('new setup:'+$("input[name='setup']:checked",'#setups').val())
      if($("input[name='setup']:checked",'#setups').val()=="minidaq") {
        $('#mdbu').show();
      }
      else $('#mdbu').hide();
  });
  if($("input[name='setup']:checked",'#setups').val()=="minidaq") $('#mdbu').show();

  //setTimeout(upd,3000);
  upd();

}

function upd() {
 if($("input[name='setup']:checked",'#setups').val()=="minidaq")
   minidaqbu = $("#minidaqbu").val();
 else minidaqbu = "null";
 //console.log('mb' + $("#minidaqbu").val())
 $.getJSON("php/summaryres.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&bu="+minidaqbu,
           function(data) {
             //console.log(JSON.stringify(data));
             try {
             $('#idles').html(data.i);
             $('#used').html(data.u);
             $('#broken').html(data.b);
             $('#quarantined').html(data.q);
             $('#cloud').html(data.c);
             $('#ramdisk').html((parseFloat(data.rd)*100).toFixed(1)+'%');
             $('#runs').html(data.runs.join());
             //console.log(data.lastruninfo._source)
             lastruninfo = data.lastruninfo._source;
             }
             catch (err) {console.log(err)};
             setTimeout(upd,1000);
           }
 ).error(function(error) {
   //console.log(error)
   $('#idles').html("");
   $('#used').html("");
   $('#broken').html("");
   $('#quarantined').html("");
   $('#cloud').html("");
   $('#ramdisk').html("");
   $('#runs').html("");
   setTimeout(upd,1000);
  });
}

function redirlogin() {
  alert('log in first!');
  if (window.location.href.indexOf('://')!=-1) {
    window.location.href=window.location.href.substring(0,window.location.href.indexOf('/',window.location.href.indexOf('://')+3))+'/login.html'
  }
  else {
    window.location.href = window.location.href.substring(0,window.location.href.indexOf('/'))
  }
}

function runcmd(cmd) {

  console.log(cmd);

  if($("input[name='setup']:checked",'#setups').val()=="minidaq")
    minidaqbu = $("#minidaqbu");
  else minidaqbu = "null";


  $.getJSON("php/summaryres.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&bu="+minidaqbu,function(data) {

    //console.log(JSON.stringify(data));
    try {
      lastruninfo = data.lastruninfo._source;
    }
    catch (err) {console.log(err);alert(err);lastruninfo=undefined};

    var message1 = "";

    if (lastruninfo!==undefined) {
      if (lastruninfo.activeBUs>0)
        message1="Some BUs ("+lastruninfo.activeBUs+") have an open run in ramdisk. ";
    }
    if (confirm(message1 + "Are you sure that you want to run command "+cmd.toUpperCase()
              +" on system "+$('input[name=setup]:checked', '#setups').val()
              +"? Before clicking 'OK' cross check that LevelZero is NOT running.")) {

        $("#"+cmd+"btn").hide();
        $("#"+cmd+"btnrunning").show();
        $.getJSON("php_priv/runcommand.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&cmd="+cmd+"&bu="+minidaqbu,
           function(data) {
             dataj = JSON.stringify(data)
             console.log('resp: '+dataj)
             //$("#"+cmd).show();
             //$("#"+cmd+"btn").prop('disabled', false);
             $("#"+cmd+"btnrunning").hide();
             $("#"+cmd+"btn").show();
             //$("#"+cmd).attr('disabled','disabled');
             console.log(data.action)
             if (data.action==="notOK") alert("Command was not executed because LevelZero state is "+data.rcstatus + ' and DAQ state is ' + data.daqstatus);
           }
        ).error(function(error) { 
          if (error.status==403) {
            console.log(JSON.stringify(error))
            redirlogin()
          }
        });
    }
  }).error(function(error) { 
    //alert(JSON.stringify(error))
    //alert("Try reloading the page if you get this error")
    if (error.status==403) {
      console.log(JSON.stringify(error))
      redirlogin();
    }
    else {
      alert(JSON.stringify(error))
    }
  });
}
