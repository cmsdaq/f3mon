<?php 

include 'jsonDecode.php';
header("Content-Type: application/json");

$hostname = 'es-cdaq';

//date_default_timezone_set("UTC");
$reply=array();
$crl = curl_init();

//$hostname = 'es-cdaq';

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
  }
}
else {
 $reply["ERROR"]=$ret;
 $reply["ocupancy_perc"]="N/A";
}
curl_close($crl);
echo json_encode($reply);

?>
