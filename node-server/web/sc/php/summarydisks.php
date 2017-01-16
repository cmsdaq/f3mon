<?php 
include 'jsonDecode.php';
$run = $_GET["run"];
$setup = $_GET["setup"];
if ($setup==null) $setup="cdaq";

header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');

if ($run==null) $added="";
else $added='{"term":{"activeRunList":"'.$run.'"}}';

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/boxinfo/_search?size=0';
$data = '{query:{bool:{must:[{range:{fm_date:{from:"now-20s"}}}'.$added.']}},aggs:{rd:{sum:{field:"usedRamdisk"}},rdt:{sum:{field:"totalRamdisk"}},od:{sum:{field:"usedOutput"}},odt:{sum:{field:"totalOutput"}}},size:0}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);

$result = array();
if ($res["aggregations"]["rdt"]["value"]==0) $result["ramdisk_occ"]=0.0;
else
  $result["ramdisk_occ"]=$res["aggregations"]["rd"]["value"]/$res["aggregations"]["rdt"]["value"];
if ($res["aggregations"]["odt"]["value"]==0) $result["output_occ"]=0.0;
else
  $result["output_occ"]=$res["aggregations"]["od"]["value"]/$res["aggregations"]["odt"]["value"];
if ($res["aggregations"]["rdt"]["value"]==0) $result["ramdisk_tot"]=0.0;
else
  $result["ramdisk_tot"]=$res["aggregations"]["rdt"]["value"];
if ($res["aggregations"]["odt"]["value"]==0) $result["output_tot"]=0.0;
else
  $result["output_tot"]=$res["aggregations"]["odt"]["value"];

echo json_encode($result)
?>
