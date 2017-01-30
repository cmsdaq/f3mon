<?php 
include 'jsonDecode.php';
//$setup = $_GET["setup"];
if(isset($_GET["setup"])) $setup = $_GET["setup"];
else $setup="cdaq";
header("Content-Type: application/json");
//date_default_timezone_set("UTC");

$size=99999;

$crl = curl_init();
$timeout = 60;
$hostname = php_uname('n');
if ($setup=="cdaq") $setup="cdaq*";//TODO: add year selection
$url = 'http://'.$hostname.':9200/hltdlogs_'.$setup.'_read/hltdlog/_search';

$script = "code90 = _source.message.find('exit code 90');".
          "if (code90!=null) return '90';".
          "exception=_source.message.indexOf('exited with code ');".
          "signal=_source.message.indexOf('exited with signal ');".
          "end=_source.message.indexOf(', retries');".
          "if (end==-1) return null;".
          "if (exception!=-1) return _source.message.substring(exception+17,end);".
          "if (signal!=-1) return _source.message.substring(signal+19,end);".
          "return null;";

//$script="return 1";

$data='{"size":0,"query":{"bool":{"must":[{"range":{"run":{"from":100000,"to":1000000000}}},'.
      '{"script":{"script":{"lang":"groovy","inline":"_source.message.find(\'exited with \')!=null || _source.message.find(\'exit code 90\')!=null"}}}]}},'.
      '"aggs":{'.
      '"error":{"terms":{"size":1000,"order":{"_term":"asc"},"script":{"lang":"groovy","inline":"'.$script.'"}}}'.
      ',"run":{"terms":{"field":"run","order":{"_term":"desc"},"size":'.$size.'}'.
      ',"aggs":{"error":{"terms":{"size":1000,"order":{"_term":"asc"},"script":{"lang":"groovy","inline":"'.$script.'"}}}}}}}';


//echo $data;

$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
$res=jsonDecode($ret);

//echo $ret;


$summary = array();
$runs = array();

foreach($res['aggregations']['error']['buckets'] as $key=>$errbucket){
  $crash = $errbucket["key"];
  $count = $errbucket["doc_count"];
  $summary[$crash]=$count;
}

$runs = array();
foreach($res['aggregations']['run']['buckets'] as $key=>$runbucket){
  $run = $runbucket["key"];
  $runs[$run]=array();
  //echo json_encode($runbucket)."\n";
  foreach($runbucket["error"]["buckets"] as $errkey=>$errbucket) {
      //echo json_encode($errbucket)."!\n";
      $crash = $errbucket["key"];
      $count = $errbucket["doc_count"];
      $runs[$run][$crash]=$count;
  }
}
$retval=array();
$retval["summary"]=$summary;
$retval["runs"]=$runs;


$url = 'http://'.$hostname.':9200/hltdlogs_'.$setup.'_read/cmsswlog/_search';
$data = '{"size":0,"query":{"bool":{"must":[{"term":{"message":"frontieraccess"}}]}},"aggs":{"runs":{"terms":{"field":"run"}}}}';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
$res=jsonDecode($ret);
//echo $res;

$runerrorsfrontier = array();
foreach($res['aggregations']['runs']['buckets'] as $key=>$bucket) {
  //echo $bucket."\n";
  $runerrorsfrontier[$bucket["key"]]=$bucket["doc_count"];
}
$retval["runerrorsfrontier"]=$runerrorsfrontier;

echo json_encode($retval);
?>
