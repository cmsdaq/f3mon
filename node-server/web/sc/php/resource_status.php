<?php 
include 'jsonDecode.php';
$setup=null;
$setup =  $_GET["setup"];
if (!$setup) $setup = "cdaq";//TEST
header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"}}';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);


$sum_q = 0.;
$sum_c = 0.;
$sum_maxqc = 0.;
$sum_rawCrashes = 0;
$sum_res = 0.;
$sum_resold = 0.;
$last_run = -1;
$n_bus = 0;

if (sizeof($res["hits"]["hits"])) {
  $last_run = $res["hits"]["hits"][0]["_source"]["runNumber"];

  $url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search?pretty';
  $data = '{"query":{"bool":{"must":[{"range":{"fm_date":{"from":"now-10s"}}},{"term":{"activeFURun":'.$last_run.'}}]}},"aggs":{"appliances":{"terms":{"field":"appliance","size":200},"aggs":{"last":{"terms":{"field":"fm_date","size":1,"order":{"_term":"desc"}},"aggs":{"q":{"avg":{"field":"quarantined"}},"c":{"avg":{"field":"activeRunHLTErr"}},"res":{"avg":{"field":"active_resources"}},"resold":{"avg":{"field":"active_resources_oldRuns"}}}}}}}} },"size":0}';

  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=jsonDecode($ret);

  foreach ($res["aggregations"]["appliances"]["buckets"] as $appl){
    $bkt = $appl["last"]["buckets"][0];
    $sum_q += $bkt["q"]["value"];
    $sum_c += $bkt["c"]["value"];
    $sum_maxqc += max($bkt["c"]["value"],$bkt["q"]["value"]);
    $sum_res += $bkt["res"]["value"];
    $sum_resold += $bkt["resold"]["value"];
    $n_bus+=1;

  }
}
else {

$sum_q = -1.;
$sum_c = -1.;
$sum_maxqc = -1.;
$sum_rawCrashes = -1.;
$sum_res = -1.;
$sum_resold = -1.;
}

$sum_rawCrashes = intval($sum_c * 6./4.); //* (number restars + 1) / (threads/process)
$result = array();
$result["last_run"]=intval($last_run);
$result["num_BUs_with_last_run"]=$n_bus;
$result["quarantinedRes"]=$sum_q;
$result["crashedRes"]=$sum_c;
$result["crashedOrQuarantinedRes"]=$sum_maxqc;
$result["crashes"]=$sum_rawCrashes;
$result["activeRes"]=$sum_res;
$result["activeResOldRuns"]=$sum_resold;
echo json_encode($result)

?>
