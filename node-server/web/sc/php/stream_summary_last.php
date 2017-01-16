<?php 
include 'jsonDecode.php';
header("Content-Type: application/json");
$run = $_GET["run"];
$setup = $_GET["setup"];
$unit = $_GET["unit"];
if ($unit=="events") $var="out";
if ($unit=="bytes") $var="filesize";
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/stream-hist/_search?size=1';
#$data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}},{"range":{"completion":{"gt":0.99}}}]}},"aggs":{"pippo":{"terms":{"field":"ls","order":{"_term":"desc"},"size":10},"aggs":{"pippo2":{"terms":{"field":"stream","size":200},"aggs":{"pippo3":{"sum":{"field":"'.$var.'"}}}}}}}}';
$data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}},{"range":{"completion":{"gt":0.99}}}]}},"aggs":{"pippo":{"terms":{"field":"stream","size":200},"aggs":{"pippo2":{"terms":{"field":"ls","order":{"_term":"desc"},"size":1},"aggs":{"pippo3":{"sum":{"field":"'.$var.'"}}}}}}}}';

$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$retval = array();
$res=jsonDecode($ret);
foreach($res["aggregations"]["pippo"]["buckets"] as $stream){
  foreach($stream["pippo2"]["buckets"] as $entry){
    if (!array_key_exists($entry["key"],$retval))
      $retval[$entry["key"]]=array();
    $retval[$entry["key"]][$stream["key"]]=$entry["pippo3"]["value"]/23.31;
  }
}
echo json_encode($retval);
?>
