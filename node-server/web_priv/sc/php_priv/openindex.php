<?php 
$setup = $_GET["setup"];
$run = $_GET["run"];
header("Content-Type: application/json");
$crl = curl_init();
$hostname = 'es-local';
$url = 'http://'.$hostname.':9200/run'.$run.'_'.$setup.'/_open';
$data='';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
echo $ret;
?>
