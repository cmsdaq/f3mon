<?php 
include 'jsonDecode.php';

if(!isset($_GET["runNumber"])) $runNumber = 600006;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["from"])) $from = 1;
    else $from = $_GET["from"];
if(!isset($_GET["to"])) $to = 10;
    else $to = $_GET["to"];     
if(!isset($_GET["interval"])) $interval = 1;
    else $interval = $_GET["interval"];   
if(!isset($_GET["type"])) $type = 'stream-hist';
    else $type = $_GET["type"];   
$setup = $_GET["setup"];

header("Content-Type: application/json");
$url="http://es-cdaq:9200/runindex_".$setup."_read/eols/_search";

$stringQuery = '{"size":0,"fields":[],"sort":{"fm_date":"desc"},"query":{"filtered":{"query":{"range":{"ls":{"from":'.$from.',"to":'.$to.'}}},"filter":{"prefix":{"_id":"run'.$runNumber.'"}}}},"aggregations":{"ls":{"histogram":{"field":"ls","interval":'.$interval.',"min_doc_count":0,"extended_bounds":{"min":'.$from.',"max":'.$to.'}},"aggs":{"events":{"sum":{"field":"NEvents"}},"files":{"sum":{"field":"NFiles"}}}}}}';


$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $stringQuery);
$res = jsonDecode(curl_exec($crl));

$buckets = $res["aggregations"]["ls"]["buckets"];
$ret = array();
$input = array();

//var_dump($ret)
foreach($buckets as $bucket){
  $ls = intval($bucket["key"]);
  $input[$ls] = $bucket["events"]["value"];
}

$processed=($type=='stream-hist')?'in':'processed';
$runNumber=($type=='stream-hist')?$runNumber:'run'.$runNumber;
$query='{"fields":["ls","out"],"size":0,"query":{"query_string":{"query":"_id:'.$runNumber.'*"}},"aggregations":{"streams":{"terms":{"field":"stream","size":0},"aggs":{"ls":{"histogram":{"field":"ls","interval":1},"aggs":{"in":{"sum":{"field":"'.$processed.'"}}}}}}}}';
$url="http://es-cdaq:9200/runindex_".$setup."_read/".$type."/_search";
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $query);
$res = jsonDecode(curl_exec($crl));

curl_close($crl);

$instreams = array();

$streams = $res["aggregations"]["streams"]["buckets"];

$ret = array();

foreach($streams as $stream){
  $instreams[$stream["key"]]=array();
  $ret[$stream["key"]]=array();
  foreach($stream["ls"]["buckets"] as $ls){
    $instreams[$stream["key"]][$ls["key"]] = $ls["in"]["value"];
  }
}

//print_r($instreams);

foreach($input as $key=>$value){
  //  echo $value.", ";
  if($value==0.){
    foreach(array_keys($instreams) as $name){
      $ret[$name][$key]=100.;
    }
  }
  else{
    foreach(array_keys($instreams) as $name){
      //      echo $name.": ".$instreams[$name][$key]." ->".$value;
      $ret[$name][$key]=$instreams[$name][$key]/$value*100.;
    }    
  }
}



echo json_encode($ret);

?>
