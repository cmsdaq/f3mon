<?php 
include 'jsonDecode.php';
header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_cdaq_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
$res=jsonDecode($ret);
$started=$res["hits"]["hits"][0]["_source"]["startTime"];
$ended=$res["hits"]["hits"][0]["_source"]["endTime"];
$number=$res["hits"]["hits"][0]["_source"]["runNumber"];
$s="Not Found";
$zero = 'CRAP';
if($ended){
   echo $number;
 }
 else{
  echo $number;

 }

?>
