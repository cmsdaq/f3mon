<?php 
include 'jsonDecode.php';
$setup = $_GET["setup"];
$run = $_GET["run"];
header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?size=10';
$data = '{"sort":{"fm_date":"desc"},"query":{"term":{"_parent":"'.$run.'"}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);
$max = 0;
foreach ($res["hits"]["hits"] as $hit){  
  if($max < $hit["_source"]["ls"]){
    $max = $hit["_source"]["ls"];
  }
}
echo $max
?>
