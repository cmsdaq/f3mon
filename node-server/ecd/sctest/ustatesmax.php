<?php 
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
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
  if ($key>=63) break;
  if ($value['count']==0) continue;
  $s .= " ".$value['key'].",".$value['count'];
}

#print_r($what);

function test_regular($var)
{
return($var['key'] >= 64);
}

$what_up = array_filter($what,"test_regular");

function invenDescSort($item1,$item2)
{
    if ($item1['count'] == $item2['count']) return 0;
    return ($item1['count'] < $item2['count']) ? 1 : -1;
}
usort($what_up,'invenDescSort');
#print_r($what_up);

$s2="";
$what_cnt=0;
$what_other=0;
foreach ($what_up as $key => $value){
if ($value['count']==0) continue;
if ($what_cnt<20)
  $s2 .= " ".$value['key'].",".$value['count'];
else $what_other+=$value['count'];
$what_cnt++;
}
if ($what_other>0)
  $s.=" 63,".$what_other.$s2;
else
  $s.=$s2;

echo $s;
echo "\n";
?>
