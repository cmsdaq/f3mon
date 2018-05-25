

function run_data_format(){
    $.ajaxSetup({
	    async: false
		});
    var delay = 0;//$('#spinner').spinner('value')
    $.get("php/brun.php?setup="+$('input[name=setup]:checked', '#setups').val(),function(data){
	    var run=0;
	    if(!isNaN(parseInt(data.number)) && (data.ended==null || data.ended=="")){
		run=parseInt(data.number);
	    }
	    var content="";
	    var ls = 0;
	    var ls_ = 0;
            var lsDelay = 0;
	    var streama = "";
	    var streamaSize = "";
	    var streame = "";
	    var streameSize = "";
	    var streamp = "";
	    var streampSize = "";

	    var addLustre = function() {
		    //$.getJSON("api/lustreInfo",function(lustre) {
		    $.getJSON("php/lustre.php",function(lustre) {
			    if (lustre.hasOwnProperty("ERROR") && lustre.ERROR!="") {
				    content+="<td style='background-color:red'>ERROR:"+lustre.ERROR+"</td></tr>";
			    }
			    else {
				    //var lperc = Math.round(lustre.occupancy*100);
				    var lperc = lustre.occupancy_perc;
				    //if (lustre.occupancy<=0.45)
				    if (lustre.occupancy_perc<=45)
					    content+="<td>"+lperc+"%</td></tr>";
				    //else if (lustre.occupancy<=0.6)
				    else if (lustre.occupancy_perc<=60)
					    content+="<td style='background-color:yellow'>"+lperc+"%</td></tr>";
				    else 
					    content+="<td style='background-color:red'>"+lperc+"%</td></tr>";
			    }
		    });

	    }


	    //console.log(run);
	    if(run!=0){
		$.get("php/lastls.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&run="+run,function(data1){ls=data1-delay;});
		$.get("php/sstreamrate_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream="+$('input[name=stream]:checked', '#streams').val()+"&run="+run+"&ls="+ls,function(data3){
                        ///dvals = data3.split(",")
			if(!isNaN(parseInt(data.number)))
			    streama=(data3.val/1.).toFixed(2);
			else
			    streama=data3.val;
                        ls_=data3.key;
		    }
		    );
                lsDelay = ls-ls_;
                ls = ls_;
		$.get("php/sstreamsize_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream="+$('input[name=stream]:checked', '#streams').val()+"&run="+run+"&ls="+ls,function(data3){

			if(!isNaN(parseFloat(data.number)))
			    streamaSize=(data3/1.).toFixed(2);
			else
			    streamaSize=data3;
		    }
		    );
//get also express rate and size
		$.get("php/sstreamrate_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream=Express"+"&run="+run+"&ls="+ls,function(data3){
                        ///dvals = data3.split(",")
			if(!isNaN(parseInt(data.number)))
			    streame=(data3.val/1.).toFixed(2);
			else
			    streame=data3.val;
                        ls_=data3.key;
		    }
		    );
                lsDelay = ls-ls_;
                ls = ls_;
		$.get("php/sstreamsize_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream=Express"+"&run="+run+"&ls="+ls,function(data3){

			if(!isNaN(parseFloat(data.number)))
			    streameSize=(data3/1.).toFixed(2);
			else
			    streameSize=data3;
		    }
		    );

		$.get("php/sstreamrate_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream=Parking*"+"&run="+run+"&ls="+ls,function(data3){
                        ///dvals = data3.split(",")
			if(!isNaN(parseInt(data.number)))
			    streamp=(data3.val/1.).toFixed(2);
			else
			    streamp=data3.val;
                        ls_=data3.key;
		    }
		    );
 
		$.get("php/sstreamsize_delayed.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&stream=Parking*"+"&run="+run+"&ls="+ls,function(data3){

			if(!isNaN(parseFloat(data.number)))
			    streampSize=(data3/1.).toFixed(2);
			else
			    streampSize=data3;
		    }
		    );

                //console.log($('input[name=stream]:checked', '#streams').val());
                if ($('input[name=stream]:checked', '#streams').val()=='*') streama=-1.;
		//console.log("rate_overlay.php?ls="+ls+"&run="+run);
		content="<tr id=\"datarow\"><td>"+run+"</td>";

                var lsDelaySnip = "<td>"+lsDelay+"</td>";
                if (lsDelay>3)
                  lsDelaySnip = "<td style='background-color:yellow'>"+lsDelay+"</td>";
                if (lsDelay>6)
                  lsDelaySnip = "<td style='background-color:red'>"+lsDelay+"</td>";
                  
		if(ls>0){
		    $.getJSON("php/rate_overlay.php?ls="+ls+"&run="+run,function(data2)
			      {
				  //console.log(data2);
				  if(data2.hits.total>0){
				      content+="<td>"+ls+"</td>"+lsDelaySnip+"<td style=;display:none;'>"+(data2.hits.total/23.4).toFixed(2)+" Hz </td><td>"+(data2.aggregations.eventcount.value/23.4).toFixed(2)+" Hz</td>";
				      //content+="<td>"+ls+"</td>"+lsDelaySnip+"<td>"+(data2.aggregations.bybu.buckets[0].lss.buckets[0].doc_count/23.4).toFixed(2)+
					  //"</td><td>"+(data2.aggregations.bybu.buckets[0].lss.buckets[0].eventcount.value/23.4).toFixed(2)+"</td>";
				      if(streama>3000.){
					  content += "<td style='background-color:red'>"+streama+" Hz</td>";
                                      }
				      else if(streama>1000.){
					  content += "<td style='background-color:yellow'>"+streama+" Hz</td>";
				      }
				      else if (streama<0.) {
                                          content += "<td> - </td>";
                                      }
				      else{
					  content += "<td>"+streama+" Hz</td>";
				      }

				  }
				  else{
                                      if (streama<0)
				          content+="<td>"+ls+"</td>"+lsDelaySnip+"<td style=;display:none;'>NO DATA</td><td>NO DATA</td><td> - </td>";
                                      else
				          content+="<td>"+ls+"</td>"+lsDelaySnip+"<td style=;display:none;'>NO DATA</td><td>NO DATA</td><td>"+streama+"</td>";

				  }
                                  //content+="<td>"+Math.round(streamaSize/(1024*1024.))+"</td></tr>"
                                  var streamaMB = streamaSize/(1024*1024.);
                                  var streameMB = streameSize/(1024*1024.);
                                  var streampMB = streampSize/(1024*1024.);
                                  if (streamaMB>5000)
                                    content+="<td style='background-color:red'>"+streamaMB.toFixed(1)+" MB/s</td></tr>"
                                  else if (streamaMB>5000)
                                    content+="<td style='background-color:yellow'>"+streamaMB.toFixed(1)+" MB/s</td></tr>"
                                  else
                                    content+="<td>"+streamaMB.toFixed(1)+" MB/s</td>"
				  if (streame=="") streame="0";
				  content += "<td>"+streame+" Hz</td>";
                                  content+="<td>"+streameMB.toFixed(1)+" MB/s</td>";//</tr>"
				  if (streamp=="") streamp="0";
				  content += "<td>"+streamp+" Hz</td>";
                                  content+="<td>"+streampMB.toFixed(1)+" MB/s</td>";//</tr>"
				  addLustre();

			      }
			      );
		}
		else{
		    content+="<td>NO LS YET</td>";
		    content+="<td/><td/><td/><td /><td/><td/><td/></td><td/>";
		    addLustre();
		}
	    }
	    else{
		content="<tr><td>NO RUN</td>"//</tr>";
		content+="<td/><td/><td/><td/><td/><td/><td/><td/><td/>";
		addLustre();
	    }
	    $('#rates').html(content);
	});

    setTimeout(run_data_format,5000);
}

function bootstrap_all(){
    window.resizeTo(980,350);
    //    window.focus();
    $('#setups').buttonset();
    $('#targetstream').html($('input[name=stream]:checked', '#streams').val());
    $('#targetstream2').html($('input[name=stream]:checked', '#streams').val());
    $('#streams').buttonset().click(function(event)
				    {
					$('#targetstream').html($('input[name=stream]:checked', '#streams').val());
					$('#targetstream2').html($('input[name=stream]:checked', '#streams').val());
					$('#datarow').html("querying...");
				    });;
//    $('#setups').click(function(){run_data_format();});
/*    $('#spinner').spinner({
		min: 0,
		max: 10,
		down: "ui-icon-triangle-1-s", 
		up: "ui-icon-triangle-1-n"
	});
    $('#spinner').spinner('value',2);*/
    run_data_format();

    
}
  
