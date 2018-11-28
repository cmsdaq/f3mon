<?php 
//include 'jsonDecode.php';
header("Content-Type: application/json");
$run = $_GET["run"];
$stream = $_GET["stream"];
$setup = $_GET["setup"];
$ls = $_GET["ls"];

$lshistory = 30;
#$history = 15;

#max looked at delay:
$lsstart = intval($ls) - $lshistory;
$lsend = intval($ls)-2;

$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/stream-hist/_search?size=1&pretty';
//$data = '{"query":{"filtered":{"query":{"bool":{"must":{"wildcard":{"stream":"'.$stream.'"}},"must":{"term":{"ls":'.$ls.'}},"must":{"range":{"ls":{"to":'.$ls.'}}},"must":{"term":{"completion":1.0}}}},"filter":{"has_parent":{"parent_type":"run","query":{"term":{"runNumber":'.$run.'}}}}}},"sort":{"ls":"desc"},"aggs":{"tot":{"sum":{"field":"out"}}}}';
$data = '{"query":{"bool":{"must":[{"wildcard":{"stream":"'.$stream.'"}},{"range":{"ls":{"from":'.$lsstart.',"to":"'.$lsend.'"}}},{"term":{"completion":1.0}},{"parent_id":{"type":"stream-hist","id":'.$run.'}}]}},"sort":{"ls":"desc"},"aggs":{"lss":{"terms":{"field":"ls","size":'.$lshistory.',"order" : { "_count" : "asc" }},"aggs":{"tot":{"sum":{"field":"out"}}}}}}';

//echo $data."\n";

$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
//echo $ret."\n";
$res=json_decode($ret,true);
//echo json_encode($res);
if($res["hits"]["total"]>0){
  $foundls = $res["hits"]["hits"][0]["_source"]["ls"];
  echo "{\"val\":";
  $cnt  = count($res["aggregations"]["lss"]["buckets"]);
  echo $res["aggregations"]["lss"]["buckets"][$cnt-1]["tot"]["value"]/23.31;
  $foundls = $res["aggregations"]["lss"]["buckets"][$cnt-1]["key"];
  echo ",\"key\":";
  echo $res["hits"]["hits"][0]["_source"]["ls"] ;
  echo "}";
}
else{
  echo "NO DATA";
}
?>
