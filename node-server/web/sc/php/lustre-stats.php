<?php 

include 'jsonDecode.php';
header("Content-Type: application/json");

date_default_timezone_set("UTC");

if (isset($_GET['from'])) $from = $_GET["from"]; else $from = null;
if (isset($_GET['to'])) $to = $_GET["to"]; else $to = null;
$getbandwidth = true;

//seconds
$intervalint = 1800.;
$intervalint2 = 120.;

//$from="2018-05-24T10:00:00.000Z";
//$to="2018-05-25T11:00:00.000Z";
//$v = strtotime("2018-05-22T10:42:16.000Z") - strtotime("2018-05-22T09:42:16.000Z");
//if (($v / $intervalint) > 3000) $intervalint = $v/3000;

$fromto=false;

$maxbins = 1000.;
$maxbins2 = 200.;

if (false) {
  $fromto=true;
  $v = strtotime($to) - strtotime($from);
  //cap number of bins
  if (($v / $intervalint) > $maxbins) $intervalint = $v/$maxbins;
  if (($v / $intervalint2) > $maxbins2) $intervalint2 = $v/$maxbins2;
}

$intervalint = intval($intervalint);
$intervalint2 = intval($intervalint2);

$hostname = 'es-cdaq';

$reply=array();

$crl = curl_init();

#!
$url = 'http://'.$hostname.':9200/lustre_info/occupancy/_search';

$data = '{"size":1,"query":{"range":{"occupancy_time":{"from":"now-70m"}}},"sort":{"occupancy_time":"desc"}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$status= curl_getinfo($crl,CURLINFO_HTTP_CODE );

if ($status==200 || $status==201) {
  $res = json_decode($ret,true);
  if (count($res['hits']['hits'])==0) {
    $reply["ERROR"]="No live info";
    $reply["occupancy_perc"]="N/A";
  } else {
    $doc = $res['hits']['hits'][0]["_source"];
    $reply["occupancy_perc"]=$doc["occupancy_perc"];
    $reply["occupancy_total_B"]=1024*$doc["total"];
    $reply["occupancy_used_B"]=1024*$doc["occupancy"];
    $reply["occupancy_inodes_perc"]=$doc["inodes_perc"];
  }
}
else {
 $reply["ERROR"]=$ret;
 $reply["ocupancy_perc"]="N/A";
}


$url = 'http://'.$hostname.':9200/lustre_info/bandwidth/_search?pretty';

$data = '{"size":0,"query":{"range":{"bandwidth_time":{"from":"now-10m","to":"now"}}},'.
         '"aggs":{"oss":{"terms":{"field":"host","size":100},'.
	 '"aggs":{'.
	 '"thits":{'.
	 '"top_hits":{'.
	 '"sort":[{"bandwidth_time":{"order":"desc"}}],"size":1}}}}}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);


$totalread=0;
$totalwrite=0;

#echo $ret;

foreach($res["aggregations"]["oss"]["buckets"] as $kkey=>$kval) {
  #echo json_encode($kval)."\n";
  foreach($kval["thits"]["hits"]["hits"] as $hkkey=>$hkval) {
    $totalread+=floatval($hkval["_source"]["readTotalMB/s"]);
    $totalwrite+=floatval($hkval["_source"]["writeTotalMB/s"]);
  }
}

$reply["read_Bps"]=intval($totalread*1024*1024);
$reply["write_Bps"]=intval($totalwrite*1024*1024);

curl_close($crl);
echo json_encode($reply);

?>
