<?php 
include 'jsonDecode.php';
$setup = $_GET["setup"];
$bu =  $_GET["bu"];
header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');

$added="";
if ($bu=="null") {}
else if ($bu=="") {echo '["noBU"]';exit(1);}
else {$added=',{"prefix":{"appliance":"'.$bu.'"}}';}

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/boxinfo/_search?size=0';
$data = '{"query":{"bool":{"must":[{"range":{"fm_date":{"from":"now-60s"}}}'.$added.']}},"aggs":{"i":{"sum":{"field":"idles"}},"u":{"sum":{"field":"used"}},"b":{"sum":{"field":"broken"}},"c":{"sum":{"field":"cloud"}},"q":{"sum":{"field":"quarantined"}},"rd":{"sum":{"field":"usedRamdisk"}},"rdt":{"sum":{"field":"totalRamdisk"}},"runs":{"terms":{"field":"activeRunList","size":100}}},"size":0}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);
$max = 0;

$result = array();
$result["i"]=$res["aggregations"]["i"]["value"];
$result["u"]=$res["aggregations"]["u"]["value"];
$result["b"]=$res["aggregations"]["b"]["value"];
$result["q"]=$res["aggregations"]["q"]["value"];
$result["c"]=$res["aggregations"]["c"]["value"];
$result["rd"]=$res["aggregations"]["rd"]["value"]/$res["aggregations"]["rdt"]["value"];
//$result["rdt"]=$res["aggregations"]["rdt"]["value"];
$result["runs"]=array();//$res["aggregations"]["runs"]["buckets"];

foreach ($res["aggregations"]["runs"]["buckets"] as $rn){
  $result["runs"][]=$rn["key"];
}

$crl = curl_init();
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search?size=1';
$data='{"sort":{"startTime":"desc"}}';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);
$result["lastruninfo"]=$res["hits"]["hits"][0];
echo json_encode($result)
?>
