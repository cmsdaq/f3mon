'use strict';
var node_tree;
var update_funct=true;

var old_setup;
var errcount=0;

function get_node_tree(callback,callback2) {

	var setup = $('input[name=setup]:checked', '#setups').val();
        console.log('setup='+setup);
	$.getJSON("api/pp?setup="+setup,function(data){
                $('#errmsg').html('');
                errcount=0;
		node_tree = data;
                if (callback!==null) callback(callback2)
		else
		  callback();
		old_setup=setup;
	    }).fail(function(error) {
              var refreshint = parseInt($('input[name=refreshint]:checked').val());
              //var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
              //refreshint*=(1+Math.sqrt(errcount/4)/4);
              refreshint*=(1+errcount*errcount*errcount/64);
              if (refreshint>30000) refreshint=30000;
              $('#errmsg').html(error.statusText+' in get_node_tree, retrying in '+Math.round(refreshint/1000.)+'s...')
              setTimeout(get_node_tree,refreshint,callback,callback2);
              errcount++;
            });
}

function run_data_format(){

    //$.getJSON("/f3mon/api/runList?sysName="+$('input[name=setup]:checked', '#setups').val()+"&size=1",function(adata){
    $.getJSON("api/runInfo?sysName="+$('input[name=setup]:checked', '#setups').val()+"&activeRuns=true",function(adata){
            $('#errmsg').html('');
            errcount=0;
            var run;
	    var ls = 0;
	    if (adata.runNumber && !isNaN(run = parseInt(adata.runNumber)) &&  $("#autoupdate").is(":checked")) {
		$('#currentRun').html(run);
                if (adata.lastLs!==0)
		  $('#currentLs').html(ls = adata.lastLs[0]);
                else $('#currentLs').html(0);
		//		console.log("current run is "+run);
		//$.get("/sc/php/lastls.php?setup="+$('input[name=setup]:checked', '#setups').val()+"&run="+run,function(data2){
		//	ls=data2;
		//	$('#currentLs').html(ls);
			//console.log("got after lastls");
			/*
			$.getJSON("/sc/php/streamsinrun.php?run="+run+'&setup='+$('input[name=setup]:checked', '#setups').val(),function(data3){ */
				//console.log(data3);
				var streams=adata.streams;//.split(" ");

				var content = ["<tr><td>micro<br>complete/incomplete</td>"];
				var heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.splice(0,10).join("</th><th valign=\"top\">")  +"</th>";
				$('#streams1').html(heading);
				if (streams.length) {
				  heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.splice(0,10).join("</th><th valign=\"top\">")  +"</th>";
				  $('#streams2').html(heading);
				  content.push(content[0]);
				}
				if (streams.length) {
				  heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.join("</th><th valign=\"top\">")  +"</th>";
				  $('#streams3').html(heading);
				  content.push(content[0]);
				}

				$.getJSON("api/teols?runNumber="+run+"&to="+ls+"&setup="+$('input[name=setup]:checked', '#setups').val(),function(data){

                                      var streams = Object.keys(data).sort();

/*				      //fill table
				      var content = ["<tr><td>micro<br>complete/incomplete</td>"];
				      var heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.splice(0,10).join("</th><th valign=\"top\">")  +"</th>";
                                      //if (heading.endsWith("<th valign=\"top\"></th>")) heading = heading.substr(0,heading.length-22);
				      $('#streams1').html(heading);
				      if (streams.length) {
				        heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.splice(0,10).join("</th><th valign=\"top\">")  +"</th>";
				        $('#streams2').html(heading);
				        content.push(content[0]);
				      }
				      if (streams.length) {
				        heading = "<th>Streams>>>><br>Completeness@@@@</th><th valign=\"top\">"+  streams.join("</th><th valign=\"top\">")  +"</th>";
				        $('#streams3').html(heading);
				        content.push(content[0]);
				      }
*/
				      //console.log("keys:"+keys)
				      $.each(data,function(j,val){
                                                var keyidx=streams.indexOf(j);
						var contidx = 0;
						if (keyidx>=10)  contidx++;
						if (keyidx>=20)  contidx++;
						var complete = val[0];
						var incomplete = val[1];
						//var complete=0;
						//var incomplete=0;
						//$.each(val,function(k,frac){
						//	if(frac==100)complete=complete+1;
						//	else incomplete=incomplete+1
						//		 });
						if(incomplete < 3){
						    content[contidx]+="<td>"+complete+"/"+incomplete+"</td>";
						}
						else if(incomplete < 3){
						    content[contidx]+="<td style='background-color:yellow'>"+complete+"/"+incomplete+"</td>";
						}
						else{
						    content[contidx]+="<td style='background-color:red'>"+complete+"/"+incomplete+"</td>";
						}
					    });
				      content[0]+="</tr>";
				      $('#streamvalues1').html(content[0]);
				      if (content[1] && content[1].length) {
				        content[1]+="</tr>";
				        $('#streamvalues2').html(content[1]);
				      }
				      if (content[2] && content[2].length) {
				        content[2]+="</tr>";
				        $('#streamvalues3').html(content[2]);
				      }

                                      var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
                                      setTimeout(run_data_format,refreshint);
				    });
			    //});
		    //});
	    }
	    else{
                var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
                setTimeout(run_data_format,refreshint);
		$('#currentRun').html("NO RUN ONGOING");
	    }

	}).fail(function(error) {
              var refreshint = parseInt($('input[name=refreshint]:checked').val());
              //var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
              //refreshint*=(1+Math.sqrt(errcount/4)/4);
              refreshint*=(1+errcount*errcount*errcount/64);
              if (refreshint>30000) refreshint=30000;
              $('#errmsg').html(error.statusText+' in call run_data_format, retrying in '+Math.round(refreshint/1000.)+'s...')
              setTimeout(run_data_format,refreshint);
              errcount++;
        });
}

function secondsToTime(s)
{
    secs=s%60;
    mins=((s-secs)/60)%60;
    hrs=((s-mins*60-secs)/3600)%24;
    days=((s-mins*60-secs)/3600-hrs)/24;
    
    return days+'d '+("00" + hrs).slice(-2)+":"+("00" + mins).slice(-2)+":"+("00" + secs).slice(-2);
}

function cluster_data_format(callback){
        //console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
    //    console.log($('input[name=setup]:checked', '#setups').val());
    var statusvar = 0.;

    var fumap = {"boxes":0,"boxes_bl":0,"boxes_db":0,"totalCores":0,"totalCloud":0,"totalQuarantinedCores":0,"totalHealthyBoxesHLT":0,"totalHealthyBoxesCloud":0};
    var fumap_tmpl = {"boxes":0,"boxes_bl":0,"boxes_db":0,"totalCores":0,"totalCloud":0,"totalQuarantinedCores":0,"totalHealthyBoxesHLT":0,"totalHealthyBoxesCloud":0};
    var fumap_cpu = {};

    if(update_funct){
    $.getJSON("api/bigPic?setup="+$('input[name=setup]:checked', '#setups').val(),function(data){
            $('#errmsg').html('');
            errcount=0;
	    var content="";
            if (data.setup!==$('input[name=setup]:checked', '#setups').val()) return;
	    if (data.hasOwnProperty("appliance_clusters")) {
                        var i = "appliance_clusters";
                        var val = data["appliance_clusters"];
			content+="<tr class='forhiding'><td style='font-size:16pt;'>"+i+"</td></tr>";
			//console.log("val.length ="+Object.keys(val).length);
			var total_bu_factor=40./Object.keys(val).length;
			var bus_with_zero_fus=0;
			var placeholder_ordinal=0;
                        //loop over bu keys/elements
                        var nameArray = [];
	                jQuery.each(val, function(i,vval2){nameArray.push(i)});
                        nameArray.sort();
                        //console.log(nameArray);
                        for (var jc=0;jc<nameArray.length;jc++) {
                          
                                    //console.log(window.node_tree.list_of_bus)
                                    //console.log(jc);
                                    var j = nameArray[jc];
                                    if (!window.node_tree.list_of_bus.hasOwnProperty(j)) continue;
                                    var vval = val[j];
				    var diff = {};
                                    //query in pp.php only returns BUs with FUs 
                                    var zero_fus = !window.node_tree.hasOwnProperty(j);
                                    var pp_node_length = 0;
                                    var pp_fu_nodes = [];

				    if(vval.fus!==undefined){
                                      var fu_keys = Object.keys(vval.fus);
                                      fu_keys.sort();
                                    }

                                    if (!zero_fus) {
                                      pp_node_length=window.node_tree[j].length;
                                      pp_fu_nodes=window.node_tree[j];
                                    }
                                    var fu_racks={};
                                    for (var ppidx=0;ppidx<pp_fu_nodes.length;ppidx++)
				      fu_racks[pp_fu_nodes[ppidx].split("-")[1].substring(2,5).toUpperCase()]=null;
				    fu_racks = Object.keys(fu_racks);//convert to array

				    if(zero_fus){
					content+='<tr class="forhiding unused-bu ordinal'+placeholder_ordinal+'" style="display:none">';
					bus_with_zero_fus+=1;
                                        //continue?
				    }
				    else{
                                        //found fus (last 20s window of fu-box-status)
					if(fu_keys!==undefined){
					    //diff = $(pp_fu_nodes).not(Object.keys(vval.fus)).get();
					    diff = $(pp_fu_nodes).not(fu_keys).get();
					    diff.sort();
					}
					if(bus_with_zero_fus!=0){ //end zero-fu collapse
					    content+='<tr class="forhiding unused-placeholder ordinal'+placeholder_ordinal+'"><td style="font-weight:bold;border-color:magenta">'+bus_with_zero_fus+' BUs with no connected FUs</td>';
					    content+='<td colspan=14 style="background-color:grey;"></td></tr>';
					    bus_with_zero_fus=0;
					    placeholder_ordinal+=1;
					}
					content+='<tr class="forhiding" style="display:table-row">'; //new bu row
				    }
				      content+="<td>"+j+" ("+vval.active_runs+")<br>"; //name column with active runs
                                    if (vval.age<60)
				      content+="<div style='font-size:9pt;'>[age="+vval.age+" s ; fuCPU="+vval.cpu_name+"]</div>";//and doc age
                                    else
				      content+="<div style='font-size:9pt;'>[<span style='color:red;font-weight: bold'>OFFLINE</span> ; fuCPU="+vval.cpu_name+"]</div>";//and doc age
			            content+="</td>";

				    if(true || vval.connected=="connected"){ //now always true
					statusvar += total_bu_factor; //?

                                        var nall = vval.fu_count_all;
                                        var nnobl = vval.fu_count_nbl;

                                        //sum up alive boxes
                                        fumap.boxes+=nnobl;
                                        fumap.boxes_bl+=(nall-nnobl);
                                        fumap.boxes_db+=pp_node_length;

					//if(Object.keys(vval.fus).length==0){ //column with number of fus seen(fu-box-status) / number of fus in DB)

					//column with number of fus seen(fu-box-status) / number of fus in DB)
					var inverted="darkgrey";
					if(nnobl==0){
					    content+="<td style='background-color:red;'>";
					}
					else if(nall > pp_node_length){
					    content+="<td style='background-color:orange;'>";
					}
					else if(nall < pp_node_length) {
                                            if ((pp_node_length-vval.blacklisted_nodes.length)>nnobl){
					      content+="<td style='background-color:yellow;'>";
					      //inverted="dimgrey";
					      inverted="grey";
                                            }
                                            else {
					      content+="<td style='background-color:yellowgreen;'>";
					      inverted="dimgrey";
                                            }
					}
					else{
					    content+="<td style='background-color:green;'>";
					}

					if(!zero_fus){
					    if (nnobl===0)
					      content+=nall+"/"+ pp_node_length+"</td>";
					    else if (nall>nnobl)
					      //content+=nnobl+"(<span style='background-color:grey;color:white'>+"+(nall-nnobl)+"</span>)/"+ pp_node_length+"</td>";
					      //if (isyellow)
					        content+=nnobl+"(<span style='color:"+inverted+"'>+"+(nall-nnobl)+"</span>)/"+ pp_node_length+"</td>";
                                              //else
					      //  content+=nnobl+"(<span style='color:"+inverted+"'>+"+(nall-nnobl)+"</span>)/"+ pp_node_length+"</td>";
                                            else
					      content+=nnobl+"/"+ pp_node_length+"</td>";
					    statusvar += total_bu_factor*nall/pp_node_length;
                                        }
                                        else {
                                            content+=nnobl+"/0 </td>";
                                        }
                                          
				    }
				    else {
				      content+="<td></td>";//not used
				    }
				    content+="<td title="+vval.idle_count+">"+vval.idle+"</td>"; //idle column
				    content+="<td title="+vval.online_count+">"+vval.online+"</td>"; //online column

				    fumap.totalCores+=vval.idle+vval.online;//quarantined?
				    fumap.totalQuarantinedCores+=vval.quarantined;//quarantined?
				    fumap.totalHealthyBoxesHLT+=vval.idle_count+vval.online_count;

                                    //add per cpu-type core statistics
                                    var map_cpuname = vval.cpu_name;
                                    if (map_cpuname==='') map_cpuname='UNKNOWN'
                                    if (!fumap_cpu.hasOwnProperty(map_cpuname)) {
                                      
                                      fumap_cpu[map_cpuname]=Object.create(fumap_tmpl);
                                    }
                                    var fucpu = fumap_cpu[map_cpuname];
                                    fucpu.boxes+=nnobl;
                                    fucpu.boxes_bl+=(nall-nnobl);
                                    fucpu.boxes_db+=pp_node_length;
                                    fucpu.totalCores+=vval.idle+vval.online;
                                    fucpu.totalQuarantinedCores+=vval.quarantined;//quarantined?
                                    fucpu.totalHealthyBoxesHLT+=vval.idle_count+vval.online_count;
				    fucpu.totalCloud+=vval.cloud;
				    fucpu.totalHealthyBoxesCloud+=vval.cloud_nodes.length;

                                    var totalReportedCores = vval.idle+vval.online+vval.quarantined+vval.cloud;
                                    var totalReportedMachines = vval.cloud_nodes.length+vval.idle_count+vval.online_count+vval.quarantined_nodes.length;

				    var running_color=""
                                    if (vval.idle_count===0 && vval.online_count>0) {}//running_color="style='background-color:aquamarine'";
                                    else if (vval.idle_count>0 && vval.online_count===0 && !vval.active_runs==="") running_color="style='background-color:gold'";
                                    else if (vval.idle_count>0 && vval.online_count>0) running_color="style='background-color:khaki'"; //can be transitional
                                    else if (vval.idle_count===0 && vval.online_count===0) running_color="style='background-color:red'";
				    content+="<td "+running_color+" >"+vval.idle_count+"|"+vval.online_count+"</td>"; //idle/active FUs column

				    fumap.totalCloud+=vval.cloud;
				    fumap.totalHealthyBoxesCloud+=vval.cloud_nodes.length;

				    if(vval.cloud != 0 || vval.cloud_nodes.length){ //cloud column
					content+="<td style='background-color:blue;color:white;font-weight:bold;' "
                                        if (vval.cloud_nodes.length)
                                          content+="title="+vval.cloud_nodes.toString()+" ondblclick='doubleClick(event)'"
                                        content+=">"+vval.cloud+"/"+vval.cloud_nodes.length+"</td>";
				    }
				    else
                                        {
					    content+="<td>"+vval.cloud+"/"+vval.cloud_nodes.length+"</td>";
				        }
				    if(vval.quarantined_nodes.length!=0){ //quarantined column
					content+="<td style='background-color:orange;' title="+vval.quarantined_nodes.toString()+" ondblclick='doubleClick(event)'>"
                                                 +vval.quarantined+"/"+vval.quarantined_nodes.length+"</td>";
				    }
				    else
					{
					    content+="<td>0/"+vval.quarantined_nodes.length+"</td>";
					}
 
				    //blacklisted column
				    if(vval.blacklisted_nodes.length!=0){ //quarantined column
					content+="<td style='background-color:black;color:white;font-weight:bold;' title="
                                                 +vval.blacklisted_nodes.join()+" ondblclick='doubleClick(event)'>"+vval.blacklisted_nodes.length+"</td>";
                                    }
                                    else {
			              content+="<td>"+vval.blacklisted_nodes.length+"</td>";
				    }

				    if(vval.stale.length!=0){ //stale column
					content+="<td style='background-color:yellow;' title="+vval.stale.toString()+" ondblclick='doubleClick(event)'>"+vval.stale.length+"</td>";
				    }
				    else
					{
					    content+="<td>"+vval.stale.length+"</td>";
					}
				    if(vval.dead.length!=0){//dead column
					content+="<td style='background-color:red;' title="+vval.dead.toString()+" ondblclick='doubleClick(event)'>"+vval.dead.length+"</td>";
				    }
				    else
					{
					    content+="<td>"+vval.dead.length+"</td>";
					}
				    if(vval.disc.length!=0){//missing but in DB (todo:using "id" of fu-box-status)
					content+="<td style='background-color:orange;' title="+vval.disc.toString()+" ondblclick='doubleClick(event)'>"+vval.disc.length+"</td>";
				    }
				    else
					{
					    content+="<td>"+vval.disc.length+"</td>";
					}

				    var fulist;
				    if (pp_fu_nodes.length) 
				      fulist="<td style='font-size:9pt;' id="+j+" title="+pp_fu_nodes.join()+" ondblclick='doubleClickPP(event)'>";//fu detail column (optional)
				    else
				      fulist="<td style='font-size:9pt;' id="+j+">";//fu detail column (optional)
				    //for(var index in vval.fus){
				    for(var index=0;index<fu_keys.length;index++){
					//(if(vval.fus[index].stale_status==1){
					//    fulist += '<em style="color:yellow; background-color:black;font-weight:bolder">'+index+"</em><br>";
					//}
					//if(vval.fus[index].stale_status==2){
					//    fulist += '<em style="color:red; background-color:black;font-weight:bolder">'+index+"</em><br>";
					//}
					//if(vval.fus[index].stale_status==3){
					//    fulist += '<em style="color:orange; background-color:black;font-weight:bolder">'+index+"</em><br>";
					//}
					//else
					{
					    //fulist += index+"<br>";
                                            var detail_fu_name = fu_keys[index];
					    var in_bl=false;
                                            for (var blidx = 0;blidx<vval.blacklisted_nodes.length;blidx++) {
                                              if (vval.blacklisted_nodes[blidx]===detail_fu_name) {in_bl=true;break}
                                            }
					    if (in_bl) {
					      fulist += '<span style="color:white; background-color:black;font-weight:bolder">'+ detail_fu_name+"</span><br>";
					    }
					    else {
					      var in_cl=false;
                                              for (var clidx = 0;clidx<vval.cloud_nodes.length;clidx++) {
                                                if (vval.cloud_nodes[clidx]===detail_fu_name) {in_cl=true;break}
					      }
					      var fu_detail = vval.fus[detail_fu_name];
					      if (fu_detail.cpuPerc>50)
                                                var detail_append = ':CPU=<span style="color:white;font-weight:bold;background-color:black;">'+fu_detail.cpuPerc+'%</span>:';//+
  //                                                                  fu_detail.effGHz+'/'+fu_detail.nomGHz+'GHz:';
					      else if (fu_detail.cpuPerc>10)
                                                var detail_append = ':CPU=<span style="font-weight:bold">'+fu_detail.cpuPerc+'%</span>:';//+
//                                                                    fu_detail.effGHz+'/'+fu_detail.nomGHz+'GHz:';
					      else
                                                var detail_append = ':CPU='+fu_detail.cpuPerc+'%:';//+fu_detail.effGHz+'/'+fu_detail.nomGHz+'GHz:';
					      if (fu_detail.effGHz>=fu_detail.nomGHz)
                                                                    detail_append+="<span style='font-weight:bold'>"+fu_detail.effGHz+'</span>/'+fu_detail.nomGHz+'GHz:';
					      else
                                                                    detail_append+=fu_detail.effGHz+'/'+fu_detail.nomGHz+'GHz:';
					      if (fu_detail.memPerc>90)
                                                detail_append+='RAM=<span style="color:red;background-color:black">'+fu_detail.memPerc+'%</span>';
					      else if (fu_detail.memPerc>75)
                                                detail_append+='RAM=<span style="color:yellow;background-color:grey">'+fu_detail.memPerc+'%</span>';
					      else
                                                detail_append+="RAM="+fu_detail.memPerc+'%';
					      if (in_cl)
					        fulist += '<span style="color:white; background-color:blue;font-weight:bolder">'+ detail_fu_name+"</span>"+detail_append+"<br>";
					      else
					        //fulist += '<em style="font-weight:bolder">'+ detail_fu_name+"</em><br>";
					        fulist += '<span style="font-weight:bolder">'+ detail_fu_name+"</span>"+detail_append+"<br>";
					        //fulist += detail_fu_name+"<br>";
					    }
					}
				    }
				    //if(diff.length>0) fulist+='<FONT COLOR="FF0000">';
				    //todo:sort
				    for(var index in diff){
                                        var missing_fu = diff[index];
                                        var in_bl=false;
                                        for (var blidx = 0;blidx<vval.blacklisted_nodes.length;blidx++) {
                                          if (vval.blacklisted_nodes[blidx]===missing_fu) {in_bl=true;break}
                                        }
                                        if (!in_bl)
				          fulist += '<span style="color:red; background-color:black;font-weight:bolder">'+ missing_fu+" : Unknown</span><br>";
                                        else
				          fulist += '<span style="color:white; background-color:black;font-weight:bolder">'+ missing_fu+" : Unknown (BL)</span><br>";
				    }
				    //if(diff.length>0) fulist+='</FONT>';
				    fulist+="</td>";
				    //				    $(fulist).click(function(){console.log("clicked");});
				    content+=fulist;

                                    //ramdisk %
				    content+="<td>"+(vval.rdiskused/vval.rdisktotal*100).toFixed(2)+"</td>";
                                    //ramdisk used
				    content+="<td>"+vval.rdiskused+"/"+vval.rdisktotal+"</td>";
                                    //FU quota % and used
				    if(vval.uldisk==0 && vval.tldisk==0){
					content+="<td>N/A</td>";
					content+="<td>N/A</td>";
				    }
				    else{
					content+="<td>"+(vval.uldisk/vval.tldisk*100).toFixed(2)+"</td>";
					content+="<td>"+vval.uldisk+"/"+vval.tldisk+"</td>";
				    }

                                    //output % and used
				    content+="<td>"+(vval.odiskused/vval.odisktotal*100).toFixed(2)+"</td>";
				    content+="<td>"+vval.odiskused+"/"+vval.odisktotal+"</td>";

                                    //HT
                                    var htcol = 'red';
                                    var htstatus = '-'
                                    if (totalReportedMachines>0) {
                                      var resPerFU = totalReportedCores/totalReportedMachines;
                                      if      ((resPerFU==32 && vval.cpu_name=='E5-2670 0') || (resPerFU==48 && vval.cpu_name=='E5-2680 v3') || resPerFU==56) {htstatus="on";htcol="lightgreen"}
                                      else if (resPerFU==16 || (resPerFU==24 && vval.cpu_name=='E5-2680 v3') || (resPerFU==28 && vval.cpu_name=='E5-2680 v4')) {htstatus="off";htcol="lightyellow"}
                                      else {htstatus="?"; htcol = 'red';}
                                    }
                                    content+="<td style='background-color:"+htcol+"'>"+htstatus+"</td>"
                                    //rack name
				    content+='<td style="background-color:';
				    switch(j.split("-")[1].substring(2,3).toUpperCase()){
				    case "D":
					content+='purple;color:white';
					break;
				    case "E":
					content+='pink';
					break;
				    case "F":
					content+='magenta';
					break;
				    }
                                    if (fu_racks.length) content+='" title='+fu_racks.join()+'>';
                                    else content+='">';
				    content+=j.split("-")[1].substring(2,5).toUpperCase()+"</td>";
                                    //end row
				    content+="</tr>";
				}//);
			    // complete the table with the last placeholder in case the last BU was an unused one
			    if(bus_with_zero_fus!=0){
				content+='<tr class="forhiding unused-placeholder ordinal'+placeholder_ordinal+'"><td style="font-weight:bold;border-color:magenta">'+bus_with_zero_fus+' BUs with no connected FUs</td>';
				content+='<td colspan=14 style="background-color:grey;"></td></tr>';
			    }
			    content+="</tr></tr>";//sm:why this??
		}//);
                content+="</div>"
		if (true ||data.hasOwnProperty("fumap")) {
                    var val = fumap;
		    //$('#querytime').html(val.query_time);
		    content+="<tr><td style='font-size:16pt;'>fu_statistics</td>";
		    content +="<td>boxes up:</td>";

                    //var fumap = {"totalHealthyBoxesHLT":0,"totalHealthyBoxesCloud":0};
		    //content +="<td>boxes: "+Object.keys(val).length+"</td>";
		    //totalCores=0.;
		    //totalCloud=0.;
		    //for(var index in val){
		    //    totalCores+=parseInt(val[index].idle);
		    //    totalCores+=parseInt(val[index].online);
		    //    totalCloud+=parseInt(val[index].cloud);
		    //}
		    content +="<td>cores<br>HLT:<br></td>";
		    content +="<td>hyper-<br>thread.:</td><td/>";
		    content +="<td>cores<br>CLOUD:<br></td>";
		    content +="<td>cores<br>QUARAN.:<br></td>";
		    content +="</tr>";

/*        	    content+="<tr><td>all</td>";
		    content +="<td>"+val.boxes+"(+"+val.boxes_bl+")<br>/"+val.boxes_db+"</td>";
		    content +="<td>"+val.totalCores+"</td><td/><td/>";
		    content +="<td>"+val.totalCloud+"</td>";
		    content +="<td>"+val.totalQuarantinedCores+"</td>";
		    content +="</tr>";
*/
                    for (var cput in fumap_cpu) {
                      if (fumap_cpu.hasOwnProperty(cput)) {
                        var cval = fumap_cpu[cput];
                        var htstatus = "<td/>";
                        if (cval.boxes>0) {
                          var cpm = (cval.totalCores+cval.totalCloud+cval.totalQuarantinedCores)/cval.boxes;
                          if (cput=="E5-2680 v3") {
                            if (cpm==48) htstatus="<td>on</td>";
                            else if (cpm==24) htstatus="<td style='background-color:lightyellow'>off</td>";
                            else if (cpm>24 && cpm <48) htstatus="<td style='background-color:red'>partial(HT)</td>";
                            else if (cpm<24) htstatus="<td style='background-color:red'>partial(no HT)</td>";
                            else htstatus="<td style='background-color:yellow'>overcommitted</td>";
                          }
                          else if (cput=="E5-2680 v4") {
                            if (cpm==56) htstatus="<td>on</td>";
                            else if (cpm==28) htstatus="<td style='background-color:lightyellow'>off</td>";
                            else if (cpm>28 && cpm <56) htstatus="<td style='background-color:red'>partial(HT)</td>";
                            else if (cpm<28) htstatus="<td style='background-color:red'>partial(no HT)</td>";
                            else htstatus="<td style='background-color:yellow'>overcommitted</td>";
                          }
                          else if (cput=="E5-2670 0") {
                            if (cpm==32) htstatus="<td>on</td>";
                            else if (cpm==16) htstatus="<td style='background-color:lightyellow'>off</td>";
                            else if (cpm>16 && cpm <32) htstatus="<td style='background-color:red'>partial(HT)</td>";
                            else if (cpm<16) htstatus="<td style='background-color:red'>partial(no HT)</td>";
                            else htstatus="<td style='background-color:yellow'>overcommitted</td>";
                          }
                        }
		        content+="<tr><td>"+cput+"</td>";
		        content +="<td>"+cval.boxes+"(+"+cval.boxes_bl+")<br>/"+cval.boxes_db+"</td>";
		        content +="<td>"+cval.totalCores+"</td>";
		        content +=htstatus+"<td/>";
		        content +="<td>"+cval.totalCloud+"</td>";
		        content +="<td>"+cval.totalQuarantinedCores+"</td>";
		        content +="</tr>";
                        }
                    }
                    
        	    content+="<tr><td>all</td>";
		    content +="<td>"+val.boxes+"(+"+val.boxes_bl+")<br>/"+val.boxes_db+"</td>";
		    content +="<td>"+val.totalCores+"</td><td/><td/>";
		    content +="<td>"+val.totalCloud+"</td>";
		    content +="<td>"+val.totalQuarantinedCores+"</td>";
		    content +="</tr>";


		}
		if (data.hasOwnProperty("central_server") || data.hasOwnProperty("eslocal_server")) {
		    content +="<tr><td style='font-size:16pt;'>elasticsearch</td><td>status</td><td>data<br>nodes</td>"
                    content +="<td title='primary shards'>prim.<br>shards</td><td>%<br>used</td>"
                    content +="</tr>";
                }
		if (data.hasOwnProperty("central_server")) {

                    var val = data.central_server;
		    content+="<tr><td style='font-size:16pt;'>"+"central_server"+"</td>";
		    $('#querytime').html(val.query_time);
			if(val.status=='green') statusvar +=10;
			content +="<td style='background-color:"+val.status+";'>"+val.status+"</td>";
			content +="<td>"+val.number_of_data_nodes+"</td>";
			content +="<td>"+val.active_primary_shards+"</td>";
                        var usedfs = 100-val.disk_free_bytes/val.disk_total_bytes*100;
                        var usedfscol = '';
                        if (usedfs>80) usedfscol='yellow';
                        if (usedfs>90) usedfscol='red';
		        content +="<td style='background-color:"+usedfscol+"'>"+usedfs.toFixed(1)+"</td>";
			content +="</tr>";
		}
		if (data.hasOwnProperty("eslocal_server")) {
                    var val = data.eslocal_server;
		    content+="<tr><td style='font-size:16pt;'>"+"eslocal_server"+"</td>";
		    if(val.status=='green') statusvar +=10;
		    content +="<td style='background-color:"+val.status+";'>"+val.status+"</td>";
		    content +="<td>"+val.number_of_data_nodes+"</td>";
		    content +="<td>"+val.active_primary_shards+"</td>";
                    var usedfs = 100-val.disk_free_bytes/val.disk_total_bytes*100;
                    var usedfscol = '';
                    if (usedfs>80) usedfscol='yellow';
                    if (usedfs>90) usedfscol='red';
		    content +="<td style='background-color:"+usedfscol+"'>"+usedfs.toFixed(1)+"</td>";
		    content +="</tr>";
		}

	    $('#services').html(content);
	    //	    console.log("radio value: "+$("#details :radio:checked").val());
	    show_hide();
	    var now = new Date();
	    $('#timestamp').html(now.toLocaleString());
	    statusvar = Math.round(statusvar*100)/100;
	    $('#statusbar').progressbar( "value", statusvar );

            uruns(callback);
        //});
	}).fail(function(error) {
              var refreshint = parseInt($('input[name=refreshint]:checked').val());
              //var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
              //refreshint*=(1+Math.sqrt(errcount/4)/4);
              refreshint*=(1+errcount*errcount*errcount/64);
              if (refreshint>30000) refreshint=30000;
              $('#errmsg').html(error.statusText+' in cluster_data_format, retrying in '+Math.round(refreshint/1000.)+'s...')
              setTimeout(cluster_data_format,refreshint,callback);
              errcount++;
        });

    }
    else { 
            var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
            callback(post_set);
            setTimeout(cluster_data_format,refreshint);
    }
}

var show_hide=function(){
	    if($("#details :radio:checked").val()=="some"){
                $('.forhiding').show();
		$('#esstatus tr td:nth-child(12)').hide();
		$('#esstatus tr td:nth-child(14)').hide();
		$('#esstatus tr td:nth-child(16)').hide();
		$('#esstatus tr td:nth-child(18)').hide();
                $('#thide1').hide();
                $('#thide2').hide();
                $('#thide3').hide();
                $('#thide4').hide();
	    }
	    else if ($("#details :radio:checked").val()=="on") {
                $('.forhiding').show();
		$('#esstatus tr td:nth-child(12)').show();
		$('#esstatus tr td:nth-child(14)').show();
		$('#esstatus tr td:nth-child(16)').show();
		$('#esstatus tr td:nth-child(18)').show();
                $('#thide1').show();
                $('#thide2').show();
                $('#thide3').show();
                $('#thide4').show();
	    }
            else if ($("#details :radio:checked").val()=="off") {
              $('.forhiding').hide();
            } 
}

var uruns=function(callback) {
    //console.log('uruns.. '+"/f3mon/api/runList?sysName="+$('input[name=setup]:checked', '#setups').val()+"&size=100");
    $.getJSON("api/runList?sysName="+$('input[name=setup]:checked', '#setups').val()+"&size=100",function(adata){
	    var content;
	    var ldata = adata.runlist;
	    $.getJSON("api/runRiverListTable",function(bdata){
	       jQuery.each(ldata, function(i,val){
                    for (var index = 0;index<bdata.list.length;index++) {
                      var found;
                      if (bdata.list[index].name===val.runNumber) {
			found=index;
			break
                      }
		    }
		    var river;
		    if(found!==undefined)
			river=" RIVER:("+bdata.list[found].host+" "+bdata.list[found].status+") ";
		    else
		        river=" RIVER:(none)";
		    content+="<tr><td>"+val.runNumber+" started at "+val.startTime+"</td><td>"+river+"</td><tr>";
		});

	      $('#runlist').html(content);
              if (callback) callback();
              var refreshint = parseInt($('input[name=refreshint]:checked', '#updatetime').val());
              setTimeout(cluster_data_format,refreshint);
	    });
	});
}

var post_set = function() {
    $('.unused-placeholder').click(function(){
	    $(this).hide();
	    var myordinal=$(this).attr('class').split(" ")[1];
	    console.log(myordinal);
	    $.each($('.unused-bu'),function(j,val){		    
		    if(String($(this).attr('class')).indexOf(myordinal)>0){
			$(this).show();
		    }
		});
	});
    if($("#autoupdate").is(":checked")){
	update_funct=true;
    }else{
	update_funct=false;
	$("#updatenotice").html("(updates currently disabled)");
    }
	//update_func = setInterval(cluster_data_format,3000);

}

var post_db = function() {
    //    $('#services td:nth-child(9),th:nth-child(9)').hide();
    $( "#autoupdate" ).prop('checked', true);
    $( "#autoupdate" ).change(function(){
            errcount=0;
	    if($(this).is(":checked")){
		console.log("enabling updates");
		update_funct = true;
		$("#updatenotice").html("(this page updates every 5 seconds)");

	    }
	    else{
		console.log("disabling updates");
		update_funct=false;
		$("#updatenotice").html("(updates currently disabled)");
	    }

	});
    $('#details').buttonset();
    //$('#setups').buttonset();
    $( "#radio" ).buttonset();
    $('#details').click(show_hide);//function callback
    $('#setups').click(function(){
      var setup = $('input[name=setup]:checked', '#setups').val();
      if ( ((old_setup==="cdaq" || old_setup==="minidaq") && setup==="dv")
         ||((setup==="cdaq" || setup==="minidaq") && old_setup==="dv"))
      {
        get_node_tree(cluster_data_format,post_set)
      }
      else 
        cluster_data_format(post_set);
    });
    statusbar = $('#statusbar');
    var statuslabel = $('.status-label');
    statusbar.progressbar({
	    value: false,
		change: function() {
		statuslabel.text( statusbar.progressbar( "value" ) + "%" );
		var value = this.getAttribute( "aria-valuenow" );
		var selector = "#" + this.id + " > div";
		if (value < 10){
		    $(selector).css({ 'background': 'Red' });
		} else if (value < 30){
		    $(selector).css({ 'background': 'Orange' });
		} else if (value < 50){
		    $(selector).css({ 'background': 'Yellow' });
		} else{
		    $(selector).css({ 'background': 'LightGreen' });
		}
		
	    }
	});
    run_data_format();
    cluster_data_format(post_set);
}

var bootstrap_all = function() {
    /*
    $.ajaxSetup({
		async: true,
                headers : {   
                  'f3mon-compression' : 'true'
                }
    });
    */
    $('#setups').buttonset();
    get_node_tree(post_db,null);
}

var doubleClick = function(e) {
  console.log("clicked on element with title: "+e.target.title)
  window.prompt("Copy to clipboard: Ctrl+C, Enter", e.target.title);
}

var doubleClickPP = function(e) {
  if (e.target.title==="") {
    console.log("clicked on element with title: "+e.target.parentNode.title)
    window.prompt("Copy to clipboard: Ctrl+C, Enter", e.target.parentNode.title);
  } else {
    console.log("clicked on element with title: "+e.target.title)
    window.prompt("Copy to clipboard: Ctrl+C, Enter", e.target.title);
  }
}

