<?php 
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');


$url = 'http://'.$hostname.':9200/runindex_cdaq_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"},"query":{"bool":{"should":[{"bool":{"must_not":[{"exists":{"field":"endTime"}}]}},{"range":{"activeBUs":{"from":1}}}],"minimum_should_match":1}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);

$res = json_decode($ret,true);

$found=false;

if (count($res["hits"]["hits"])>0) {
  $rn = $res["hits"]["hits"][0]["_id"];

  $url = 'http://'.$hostname.':9200/runindex_cdaq_read/state-hist/_search?size=1';
  $data = '{"sort":{"date":"desc"},"query":{"parent_id":{"type":"state-hist","id":'.$rn.'}}}';
  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=json_decode($ret,true);
  if (count($res["hits"]["hits"])>0)  {
    $found=true;
    $time=$res["hits"]["hits"][0]["sort"][0];
    $what=$res["hits"]["hits"][0]["_source"]["hmicrov"]["entries"];
    $time=gmdate("Y-m-d\TH:i:s\Z", $time/1000);
    $s=$time." ";
    foreach ($what as $key => $value){
      $s .= " ".$value['key'].",".$value['count'];
    }
  }
}

//no active run or no documents yet, return last one found
if ($found==false) {

  $url = 'http://'.$hostname.':9200/runindex_cdaq_read/state-hist/_search?size=1';
  $data = '{"sort":{"date":"desc"}}';
  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=json_decode($ret,true);
  $time=$res["hits"]["hits"][0]["sort"][0];
  $what=$res["hits"]["hits"][0]["_source"]["hmicrov"]["entries"];
  $time=gmdate("Y-m-d\TH:i:s\Z", $time/1000);
  $s=$time." ";
  foreach ($what as $key => $value){
    $s .= " ".$value['key'].",".$value['count'];
  }
}

echo $s;
echo "\n";
?>
