<?php 
//include 'jsonDecode.php';
header("Content-Type: text/plain");
$hostname = php_uname('n');

$type = $_GET["type"];
$timeout = 10;

if ($type=="events") {
  $url = "http://".$hostname.":9200/runindex_cdaq/eols/_search";
  $data = '{"aggs":{"total":{"avg":{"field":"TotalEvents"}}},"query":{"range":{"fm_date":{"from":"now-1m"}}}}'
}
else if ($type=="resources") {
  $url = "http://".$hostname.":9200/boxinfo_cdaq/resource_summary/_search";
  $data = '{"aggs":{"total":{"avg":{"field":"ramdisk_occupancy"}}},"query":{"bool":{"must":[{"range":{"fm_date":{"from":"now-20s"}}},{"range":{"activeFURun":{"from":1}}}]}}}'
}

$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
echo $ret;

//$res=jsonDecode($ret);
//echo json_encode($result)
?>
