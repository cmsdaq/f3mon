<?php 
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_cdaq_read/state-hist-summary/_search?size=20';
$data = '{"sort":{"date":"desc"},"query":{"bool":{"must_not":[{"exists":{"field":"cpuslotsmax"}}],"must":{"range":{"date":{"from":"now-120s"}}}}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=json_decode($ret,true);
$totals=0;
$idle=0;
$docs=$res["hits"]["hits"];
foreach ($docs as $key => $doc) {
  $what=$doc["_source"]["hmicro"]["entries"];
  foreach ($what as $key => $value) {
    if ($value['key']==1) $idle+=intval($value['count']);
    $totals += intval($value['count']);
  }
}
if ($totals>0) echo 1.-floatval($idle)/floatval($totals);
else echo $totals;
echo "\n";
?>
