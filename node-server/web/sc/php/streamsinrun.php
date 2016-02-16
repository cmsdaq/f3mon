<?php 

header("Content-Type: text/plain");
$run = $_GET["run"];
$setup = $_GET["setup"];
if(!$setup){
  $setup="cdaq";
}
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/stream-hist/_search';
//$data = '{"query":{"term":{"_parent":'.$run.'}},"sort":{"date":"desc"},"facets":{"streams":{"terms":{"field":"stream","order":"term","size":100}}}}';
$data = '{"size":0,"query":{"term":{"_parent":'.$run.'}},"aggs":{"streams":{"terms":{"field":"stream","size":100}}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=json_decode($ret,true);

$ret = array();
foreach ($res["aggregations"]["streams"]["buckets"] as $hit){
  $ret[] = $hit["key"];
}
echo json_encode($ret);

?>
