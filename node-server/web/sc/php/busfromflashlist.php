<?php 
include 'jsonDecode.php';
/*
$setup = "cdaq";
$cmd = "test";
$buprefix = "null";
*/
header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');

//cross-check state in run control flashlist if this is CDAQ
$url = 'http://xaas-cdaq-04.cms:9946/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_static';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
$ret = curl_exec($crl);
curl_close($crl);
$result = array();
$bus = array();
if($ret !== false) {
  try {
    $res=jsonDecode($ret);
    $run=$res["table"]["rows"][0]["RUN_NUMBER"];
    $infomap=$res["table"]["rows"][0]["PARTITION_INFO_MAP"];
    $all = explode("&",$infomap);
    foreach($all as $val) {
      if (substr($val,0,3)=="bu-") $bus[]=$val;
    }
  } catch(Exception $e){
  echo $e;
  
  }
   
}
$result[(int)$run]=$bus;
echo json_encode($result);
?>
