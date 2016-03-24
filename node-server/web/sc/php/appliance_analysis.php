<?php 
$run = $_GET["run"];
$setup = $_GET["setup"];
header("Content-Type: application/json");
$response=array();
date_default_timezone_set("UTC");
$crl = curl_init();
$hostname = 'es-cdaq';
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search';
$data =  '{"sort":{"startTime":"desc"},"query":{"term":{"runNumber":'.$run.'}}}';
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);

$res = json_decode($ret,true);
$start = $res["hits"]["hits"][0]["_source"]["startTime"];
$end = $res["hits"]["hits"][0]["_source"]["endTime"];
$ongoing = "";
if($end==null){
  $end=date("Y-m-dkH:i:s.u"); $end=str_replace('k','T',$end);
  $ongoing='ongoing';
}
$span = strtotime($end)-strtotime($start);
$interval=strval(max(1,floor($span/100))).'s';
$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?scroll=1m&search_type=scan';//&size=5000';
//$data =  '{"size":100000,"query":{"query_string":{"query":"_id:run'.$run.'*"}}}';
//$data =  '{"query":{"query_string":{"query":"_id:run'.$run.'*"}}}';
//$data =  '{"filter":{"term":{"_parent":"'.$run.'"}}}';
$data =  '{"size":100000,"query":{"match":{"_parent":"'.$run.'"}}}';

//echo $url." -d'".$data."'\n";

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$ret = curl_exec($crl);
$res = json_decode($ret,true);
$scroll_id=0;
$scroll_id=$res["_scroll_id"];
//echo $scroll_id."\n";
$ratebybu=array();
$bwbybu=array();
$ratetotal=array();


$http_status=200;

do{
  //$url = 'http://'.$hostname.':9200/_search/scroll?scroll=1m&scroll_id='.$scroll_id;
  $url = 'http://'.$hostname.':9200/_search/scroll';
  $data = '{"scroll":"1m","scroll_id":"'.$scroll_id.'"}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

  $ret = curl_exec($crl);
  $http_status = curl_getinfo($crl, CURLINFO_HTTP_CODE);
  if($http_status==200){
    $res = json_decode($ret,true);
    //    $scroll_id=$res["_scroll_id"];
    //echo $scroll_id."\n";
    foreach($res['hits']['hits'] as $key=>$value){
      //$thebu = substr($value['_id'],strrpos($value['_id'],'_')+1);
      $thebu = $value['_source']['appliance'];
      if(!array_key_exists($thebu,$ratebybu)){
  	$ratebybu[$thebu]=array();
  	$bwbybu[$thebu]=array();
      }
      $ls=$value['_source']['ls'];
      $ratebybu[$thebu][$ls]=$value['_source']['NEvents'];
      $bwbybu[$thebu][$ls]=$value['_source']['NBytes'];
      $ratetotal[$ls]=$value['_source']['TotalEvents'];
    }
  }
  //else echo "ERROR: ".$http_status;
}while($http_status == 200);
      

ksort($ratebybu);
ksort($bwbybu);
$response["ratebybu"]=array();
$response["bwbybu"]=array();
$response["ratebytotal"]=array();
$response["ratebytotal"][]=array('name'=>'totals','data'=>array());;
foreach($ratebybu as $key=>$value){
  $response["ratebybu"][]=array('name'=>$key,'data'=>array());
  ksort($value);
  foreach($value as $ls=>$rate){
    $response["ratebybu"][sizeof($response["ratebybu"])-1]['data'][]=array($ls,$rate/23.31);
  }
}
foreach($bwbybu as $key=>$value){
  $response["bwbybu"][]=array('name'=>$key,'data'=>array());
  ksort($value);
  foreach($value as $ls=>$rate){
    $response["bwbybu"][sizeof($response["bwbybu"])-1]['data'][]=array($ls,$rate/23.31);
  }
}
ksort($ratetotal);
foreach($ratetotal as $ls=>$rate){
  $response["ratebytotal"][0]['data'][]=array($ls,$rate/23.31);
}



$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';
$data = '{"sort":{"fm_date":"asc"},"size":0,"query":{"bool":{"must":{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},"must":{"term":{"activeFURun":'.$run.'}}}},"aggs":{"appliance":{"terms":{"field":"appliance","size":70,"order" : { "_term":"asc"}},"aggs":{"ovr":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{"avg":{"avg":{"field":"ramdisk_occupancy"}}}}}}}}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);

$response['ramdisk'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['ramdisk'][$key]=array();
  $response['ramdisk'][$key]['name']=$value['key'];
  $response['ramdisk'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['ramdisk'][$key]['data'][]=array($vvalue['key'],$vvalue['avg']['value']);
  }
}


$response["series1"]=array();
$response["series2"]=array();
$response["series3"]=array();
$response["begins"]=array();
$response["ends"]=array();
$index=0;
 
  $hostname = "es-local";

  $url = 'http://'.$hostname.':9200/run'.$run.'*/prc-in/_search';
  $data='{"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":0,"order":{"_term":"asc"}},"aggs":{"ls":{"terms":{"field":"ls","size":0,"order":{"_term":"asc"}},"aggs":{"maxtime":{"max":{"field":"_timestamp"}},"mintime":{"min":{"field":"_timestamp"}},"events":{"sum":{"field":"data.out"}},"bytes":{"sum":{"field":"data.size"}}}}}}}}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  //echo $ret;
  $res = json_decode($ret,true);
  foreach($res["aggregations"]["bybu"]["buckets"] as $key=>$value){
    //if($value["key"]=='bu'){
    //  continue;
    //}
    $response["series1"][$index]=array();
    $response["series1"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series1"][$index]["data"]=array();
    //$response["series1"][$index]["color"]=("#".substr(dechex($index*24+64).dechex($index*24+64).dechex($index*24+64),-6));
    $response["series2"][$index]=array();
    $response["series2"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series2"][$index]["data"]=array();
    $response["series3"][$index]=array();
    $response["series3"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series3"][$index]["data"]=array();
    $response["begins"][$index]=array();
    $response["begins"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["begins"][$index]["data"]=array();
    $response["ends"][$index]=array();
    $response["ends"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["ends"][$index]["data"]=array();
    $previousmax=$startTime;
    $previousDuration = 0.;
    foreach($value["ls"]["buckets"] as $kkey=>$lss){
      if($previousmax==0){
	$previousmax=$lss["mintime"]["value"];
      }
      $previousmax = min($previousmax,$lss["mintime"]["value"]);
      //$previousmax = $lss["mintime"]["value"];

      $duration = ($lss["maxtime"]["value"]-$previousmax)/1000.;
      if($previousDuration > 2*23.31 && $duration<23.31){
      	$duration += ($previousDuration-23.31);
      }
      $response["series1"][$index]["data"][]=array($lss["key"],$duration);
      $response["series2"][$index]["data"][]=array($lss["key"],$lss["events"]["value"]/$duration);
      $response["series3"][$index]["data"][]=array($lss["key"],$lss["bytes"]["value"]/$duration);
      $response["begins"][$index]["data"][]=array($lss["mintime"]["value"],$lss["key"]);
      $response["ends"][$index]["data"][]=array($lss["maxtime"]["value"],$lss["key"]);
      /* if($lss["events"]["value"]!=$ratebybu[substr($value['key'],strrpos($value['key'],'_')+1)][$lss["key"]]){ */
      /* 	echo "PROBLEM: ".$lss["events"]["value"]." ".$ratebybu[substr($value['key'],strrpos($value['key'],'_')+1)][$lss["key"]]."\n"; */
      /* } */
      $previousmax = $lss["maxtime"]["value"];
      $previousDuration = $duration;
    }
    $index+=1;
  }

$index=0;
$response["series4"]=array();
  
  $hostname = "es-local";

  $url = 'http://'.$hostname.':9200/run'.$run.'*/prc-in/_search';
  $data='{"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":0,"order":{"_term":"asc"}},"aggs":{"ls":{"date_histogram":{"field":"_timestamp","interval":"46s"},"aggs":{"events":{"sum":{"field":"data.out"}}}}}}}}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);

  foreach($res["aggregations"]["bybu"]["buckets"] as $key=>$value){
    if($value["key"]=='bu'){
      continue;
    }
    $response["series4"][$index]=array();
    $response["series4"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series4"][$index]["data"]=array();
    foreach($value["ls"]["buckets"] as $kkey=>$lss){
      $response["series4"][$index]["data"][]=array($lss["key"],$lss["events"]["value"]/46);
    }
  $index+=1;
  }




curl_close($crl);

echo json_encode($response);
?>