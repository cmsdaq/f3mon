<?php 
include 'bucketData.php';
$setup = $_GET["setup"];
$response= array();
header("Content-Type: application/json");
$buhosts=array();
$fuhosts=array();

date_default_timezone_set("UTC");
$crl = curl_init();

/* get the health of the tribe server (this will be the one server that the request hits 
   so it does not give information about all other servers) */
$hostname = 'es-tribe';
$url = 'http://'.$hostname.':9200/_cluster/health'; 
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$response["tribe_server"] = json_decode(curl_exec($crl));

/*get the list of fus that are connected to the tribemaster */
$url = 'http://'.$hostname.':9200/_nodes/fu*/stats'; 
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$res = json_decode(curl_exec($crl),true);
$fustats = $res["nodes"];
$series1 = new dataSeries("heapUsage");
$series2 = new dataSeries("gcTime");
$series3 = new dataSeries("cpuUsage");
$series4 = new dataSeries("memUsage");
$series5 = new dataSeries("cpuElastic");
$series6 = new dataSeries("memElastic");
$series7 = new dataSeries("memFU");
$series8 = new dataSeries("diskElastic");
$h1 = new histogram1D("heapu",50,0.,100.,70.);
$h2 = new histogram1D("gctimeY",50,0.,100000.);
$h5 = new histogram1D("gctimeO",50,0.,100000.);
$h3 = new histogram1D("cpuu",50,0.,100.,70.);
$h4 = new histogram1D("memu",50,0.,100.,70.);
$h6 = new histogram1D("escpu",50,0.,100.,10.);
$h7 = new histogram1D("esmem",50,0.,5000.,2000.);
$cats=array(array(0.,24.),array(24.,32.),array(32.,48.),array(48.,64.));
$h8 = new categorized1D("fumem",$cats,"GB");
$h9 = new histogram1D("esdisk",50,0.,100.,70.);
$series1->addHistogram($h1);
$series2->addHistogram($h2);
$series2->addHistogram($h5);
$series3->addHistogram($h3);
$series4->addHistogram($h4);
$series5->addHistogram($h6);
$series6->addHistogram($h7);
$series7->addHistogram($h8);
$series8->addHistogram($h9);
$fustat = array();
foreach ($fustats as $key => $value){
  $fustat[$value["host"]]=array();
  $fustat[$value["host"]]["heapu"] = 
    $value["jvm"]["mem"]["heap_used_percent"];
  $h1->fill($value["jvm"]["mem"]["heap_used_percent"]);
  $h2->fill($value["jvm"]["gc"]["collectors"]["young"]["collection_time_in_millis"]);
  $h5->fill($value["jvm"]["gc"]["collectors"]["old"]["collection_time_in_millis"]);
  $h3->fill($value["os"]["cpu"]["usage"]);
  $h4->fill($value["os"]["mem"]["used_percent"]);
  $h6->fill($value["process"]["cpu"]["percent"]);
  $h7->fill($value["process"]["mem"]["resident_in_bytes"]/1024/1024);
  $h8->fill(($value["os"]["mem"]["actual_free_in_bytes"]+$value["os"]["mem"]["actual_used_in_bytes"])/1024/1024/1024);
  $fustat[$value["host"]]["heapyou"] = 
    $value["jvm"]["mem"]["pools"]["young"]["used_in_bytes"];
  $fustat[$value["host"]]["heapsur"] = 
    $value["jvm"]["mem"]["pools"]["survivor"]["used_in_bytes"];
  $fustat[$value["host"]]["heapold"] = 
    $value["jvm"]["mem"]["pools"]["old"]["used_in_bytes"];
  $fustat[$value["host"]]["gcyoung"] = 
    $value["jvm"]["gc"]["collectors"]["young"]["collection_time_in_millis"];
  $fustat[$value["host"]]["gcold"] = 
    $value["jvm"]["gc"]["collectors"]["old"]["collection_time_in_millis"];
  $fustat[$value["host"]]["escpu"] = 
    $value["process"]["cpu"]["percent"];
  $fustat[$value["host"]]["esmem"] = 
    $value["process"]["mem"]["resident_in_bytes"];
  $h9->fill(($value["fs"]["data"][0]["total_in_bytes"]-$value["fs"]["data"][0]["available_in_bytes"])/$value["fs"]["data"][0]["total_in_bytes"]*100);
}

$response["appliance_clusters"]=array();

/* get the list of all *expected* bu nodes*/
/* this is obtained by querying the tribemaster for its settings - this is the list of all known hosts */
//$url = 'http://'.$hostname.':9200/_nodes/{ncsrv*,srv*}/settings';
$url = 'http://'.$hostname.':9200/_nodes/??srv-*/settings';
$data = '';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res=json_decode($ret,true);

foreach( $res["nodes"] as $name => $value){
  foreach( $value["settings"] ["tribe"] as $name2 => $value2){
    $buhost=$value2["discovery"]["zen"]["ping"]["unicast"]["hosts"][0];
    array_push($buhosts,$buhost);
   }
  }
sort($buhosts);
//foreach( $res["nodes"] as $name => $value){
//  $buhosts=$value["settings"]["discovery"]["zen"]["ping"]["unicast"]["hosts"];
//}
foreach ($buhosts as $key => $value){
  $firstlast=explode(".",$value);
  $buhosts[$key]=$firstlast[0];
  $response["appliance_clusters"][$buhosts[$key]]["connected"]="disconnected";
}
$url = 'http://'.$hostname.':9200/_nodes/bu*/_none';
$data = '';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res=json_decode($ret,true);
$what=$res["nodes"];

/* loop on all bu hosts and fill information about appliance, then get the name of all fus actually in the cluster of that appliance (from the ES point of view) */

foreach ($what as $key => $value){

  $fuhosts[$value["host"]]=array();
  $url = 'http://'.$value["host"].':9200/_cluster/health';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt($crl, CURLOPT_TIMEOUT,        2);
  curl_setopt($crl, CURLOPT_CONNECTTIMEOUT, 2);
  $ret = curl_exec($crl);
  $res=json_decode($ret,true);
  $response["appliance_clusters"][$value["host"]]["status"]=$res["status"];
  $response["appliance_clusters"][$value["host"]]["timeout"]=$res["timed_out"];
  $response["appliance_clusters"][$value["host"]]["relocating"]=$res["relocating_shards"];
  $response["appliance_clusters"][$value["host"]]["initializing"]=$res["initializing_shards"];
  $response["appliance_clusters"][$value["host"]]["unassigned"]=$res["unassigned_shards"];
  $response["appliance_clusters"][$value["host"]]["connected"]="connected";
  $response["appliance_clusters"][$value["host"]]["active_primary_shards"]=$res["active_primary_shards"];
  $url = 'http://'.$value["host"].':9200/_nodes/fu*/_none';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res=json_decode($ret,true);
  $fus=$res["nodes"];
  foreach ($fus as $fu){ 
    $fuhosts[$value["host"]][$fu["host"]]=array();
    $fuhosts[$value["host"]][$fu["host"]]["heap"]=$fustat[$fu["host"]]["heapu"];
    $fuhosts[$value["host"]][$fu["host"]]["escpu"]=$fustat[$fu["host"]]["escpu"];
  }
  $response["appliance_clusters"][$value["host"]]["fus"]=$fuhosts[$value["host"]];
}

$hostname = php_uname('n'); // set the host to local to get health of central server
$url = 'http://'.$hostname.':9200/_cluster/health';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$response["central_server"]=json_decode(curl_exec($crl),true);
$response["central_server"]["query_time"]=date_create()->format('D d M Y H:i:s e');




/*query for all bu boxfiles*/

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/boxinfo/_search';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$summary=array();

$bumap = array();
$fumap = array();
$data='{"sort":{"fm_date":"desc"},"size":20000}';
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$now = date_create();
$ret = curl_exec($crl);
$res=json_decode($ret,true);
foreach($res["hits"]["hits"] as $k=>$qres){
  $last_updated = date_create($qres["_source"]["fm_date"]);
  if(strpos($qres["_id"],"bu")!==false){
    $bumap[$qres["_source"]["host"]]=array();
    $bumap[$qres["_source"]["host"]]["age"]=$now->getTimestamp()-$last_updated->getTimestamp();
    $bumap[$qres["_source"]["host"]]["rdiskused"]=$qres["_source"]["usedRamdisk"];
    $bumap[$qres["_source"]["host"]]["rdisktotal"]=$qres["_source"]["totalRamdisk"];
    $bumap[$qres["_source"]["host"]]["odiskused"]=$qres["_source"]["usedOutput"];
    $bumap[$qres["_source"]["host"]]["odisktotal"]=$qres["_source"]["totalOutput"];
    $bumap[$qres["_source"]["host"]]["active_runs"]=$qres["_source"]["activeRuns"];
  }else{
    $fumap[$qres["_source"]["host"]]=array();
    $fumap[$qres["_source"]["host"]]["age"]=$now->getTimestamp()-$last_updated->getTimestamp();
    $fumap[$qres["_source"]["host"]]["idle"]=$qres["_source"]["idles"];
    $fumap[$qres["_source"]["host"]]["online"]=$qres["_source"]["used"];
    $fumap[$qres["_source"]["host"]]["cloud"]=$qres["_source"]["cloud"];
    $fumap[$qres["_source"]["host"]]["uldisk"]=$qres["_source"]["usedDataDir"];
    $fumap[$qres["_source"]["host"]]["tldisk"]=$qres["_source"]["totalDataDir"];
    $fumap[$qres["_source"]["host"]]["activeRunStats"]=$qres["_source"]["activeRunStats"];
    $fumap[$qres["_source"]["host"]]["detectedStaleHandle"]=$qres["_source"]["detectedStaleHandle"];
  }
}

/*also put the individual fu map in the response*/
$response["fumap"]=$fumap;

foreach ($buhosts as $i){
  $stats=array();  

  /*format the response*/
  /*if no box file is found then it means this bu is not in the setup and the corresponding row is removed*/
  if(!array_key_exists($i,$bumap)){
    unset($response["appliance_clusters"][$i]);
  }
  else{
    $response["appliance_clusters"][$i]['rdisk']=$bumap[$i]["rdiskused"]/$bumap[$i]["rdisktotal"];
    $response["appliance_clusters"][$i]['odisk']=$bumap[$i]["odiskused"]/$bumap[$i]["odisktotal"];
    $response["appliance_clusters"][$i]['rdiskused']=$bumap[$i]["rdiskused"];
    $response["appliance_clusters"][$i]['rdisktotal']=$bumap[$i]["rdisktotal"];
    $response["appliance_clusters"][$i]['odiskused']=$bumap[$i]["odiskused"];
    $response["appliance_clusters"][$i]['odisktotal']=$bumap[$i]["odisktotal"];
    $response["appliance_clusters"][$i]['active_runs']=$bumap[$i]["active_runs"];
    $response["appliance_clusters"][$i]['idle']=0;
    $response["appliance_clusters"][$i]['online']=0;
    $response["appliance_clusters"][$i]['cloud']=0;
    $response["appliance_clusters"][$i]['uldisk']=0;
    $response["appliance_clusters"][$i]['tldisk']=0;
    $response["appliance_clusters"][$i]['stale']=array();
    $response["appliance_clusters"][$i]['dead']=array();
    $response["appliance_clusters"][$i]['disc']=array();
    $response["appliance_clusters"][$i]['age']=$bumap[$i]["age"];
    $summary[$i]=$stats;


    if(array_key_exists($i,$fuhosts)){
      foreach ($fuhosts[$i] as $j=>$irrelevant){
	$stats=array();  
	if(array_key_exists($j,$fumap)){
	  if($fumap[$j]["age"]<10){
	    $response["appliance_clusters"][$i]['idle']+=$fumap[$j]["idle"];
	    $response["appliance_clusters"][$i]['online']+=$fumap[$j]["online"];
	    $response["appliance_clusters"][$i]['cloud']+=$fumap[$j]["cloud"];
	    $response["appliance_clusters"][$i]['uldisk']+=$fumap[$j]["uldisk"];
	    $response["appliance_clusters"][$i]['tldisk']+=$fumap[$j]["tldisk"];
	  }
	  else if($fumap[$j]["age"]<3600){
	    $response["appliance_clusters"][$i]['stale'][]=$j;
	  }
	  else{
	    $response["appliance_clusters"][$i]['dead'][]=$j;
	  }
	}
	else{
	  $response["appliance_clusters"][$i]['disc'][]=$j;
	}
      }
      $summary[$i]=$stats;
    }
  }
}
curl_close($crl);
array_push($response,$series1->series);
array_push($response,$series2->series);
array_push($response,$series3->series);
array_push($response,$series4->series);
array_push($response,$series5->series);
array_push($response,$series6->series);
array_push($response,$series7->series);
array_push($response,$series8->series);
echo json_encode($response);

?>
