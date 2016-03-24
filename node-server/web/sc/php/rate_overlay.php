<?php 
include 'jsonDecode.php';
$run = $_GET["run"];
$ls =  $_GET["ls"];
header("Content-Type: application/json");
$buhosts=array();
$fuhosts=array();

date_default_timezone_set("UTC");
$crl = curl_init();

/* get the health of the tribe server (this will be the one server that the request hits 
   so it does not give information about all other servers) */
$hostname = 'es-local';
$url = 'http://'.$hostname.':9200/run'.$run.'*/prc-in/_search'; 
//$data='{"size":0,"sort":{"_timestamp": "desc"},"query":{"query_string":{"query":"ls:'.$ls.'"}},"aggs":{"bybu":{"terms":{"field":"source","size":0},"aggs":{"lss":{"terms":{"field":"ls","size":0},"aggs":{"eventcount":{"sum":{"field":"data.out"}}}}}}}}';
//$data='{"size":0,"sort":{"_timestamp": "desc"},"query":{"query_string":{"query":"ls:'.$ls.'"}},"aggs":{"eventcount":{"sum":{"field":"data.out"}}}}';
$data='{"size":0,"sort":{"fm_date": "desc"},"query":{"term":{"ls":'.$ls.'}},"aggs":{"eventcount":{"sum":{"field":"data.out"}}}}';
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$response = json_decode(curl_exec($crl));

curl_close($crl);
echo json_encode($response);
?>
