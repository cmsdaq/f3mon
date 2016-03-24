<?php 
//include 'jsonDecode.php';
header("Content-Type: application/json");
$run = $_GET["run"];
$stream = $_GET["stream"];
$setup = $_GET["setup"];
$ls = $_GET["ls"];
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/stream-hist/_search?size=1';
$data = '{"query":{"bool":{"must":[{"wildcard":{"stream":"'.$stream.'"}},{"term":{"ls":'.$ls.'}},{"term":{"completion":1.0}},{"term":{"_parent":'.$run.'}}] }},"sort":{"ls":"desc"},"aggs":{"tot":{"sum":{"field":"filesize"}}}}';

$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);

$res=json_decode($ret,true);
if($res["hits"]["total"]>0){
  echo $res["aggregations"]["tot"]["value"]/23.31;
}
else{
  echo "NO DATA";
}
?>
