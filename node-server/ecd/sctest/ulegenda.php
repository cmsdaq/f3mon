<?php 
include 'jsonDecode.php';
$run = $_GET["run"];
#$run = "273158";
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_cdaq_read/microstatelegend/_search?size=1';
//$data = '{"query":{"filtered":{"query":{"query_string" : {"query":"_parent:'.$run.'"}}}}}';
//$data = '{"query":{"filtered":{"query":{"term":{"_parent":"'.$run.'"}}}}}';
$data = '{"query":{"parent_id":{"type":"microstatelegend","id":"'.$run.'"}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
$res=json_decode($ret,true);
$hitcount=count($res["hits"]["hits"][0]["_source"]["stateNames"]);
$names="";
foreach($res["hits"]["hits"][0]["_source"]["stateNames"] as $i=>$val){
 if ($i==63) $val="Other";
 if ($i<$hitcount-1)
 $names=$names.$i."=".$val." ";
 else
 $names=$names.$i."=".$val;
}
echo $names;
#echo $res["hits"]["hits"][0]["_source"]["names"];
?>

