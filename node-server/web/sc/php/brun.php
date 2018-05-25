<?php 
include 'jsonDecode.php';
//$setup = $_GET["setup"];
if(isset($_GET["setup"])) $setup = $_GET["setup"];
else $setup="cdaq";
header("Content-Type: application/json");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);
$retval = array();
$retval["started"]=$res["hits"]["hits"][0]["_source"]["startTime"];
if(array_key_exists("endTime",$res["hits"]["hits"][0]["_source"])){
  $activeBUs = intval($res["hits"]["hits"][0]["_source"]["activeBUs"]); //active BUs in the run (0 if run ended properly)
  $totalBUs = intval($res["hits"]["hits"][0]["_source"]["totalBUs"]); //max BUs in the run
  if ($totalBUs!=0 && $activeBUs==0) //if at least one BU participated and ended run, reprot that run is finished
  $retval["ended"]=$res["hits"]["hits"][0]["_source"]["endTime"];
  else {
    $retval["ended"]="";
  }
}
else{
  $retval["ended"]="";
}
$retval["number"]=$res["hits"]["hits"][0]["_source"]["runNumber"];

echo json_encode($retval);

?>
