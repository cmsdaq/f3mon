<?php 
include 'jsonDecode.php';

if(isset($_GET["setup"])) $setup = $_GET["setup"];
else $setup="cdaq";

header("Content-Type: application/json");
//date_default_timezone_set("UTC");

//$size=99999;
$hostname = php_uname('n');
//if ($setup=="cdaq") $setup="cdaq*";//TODO: add year selection

//check cardinality
$timeout = 30;
$url = 'http://'.$hostname.':9200/hltdlogs_'.$setup.'_read/hltdlog/_search';

$filter  = '"query":{"bool":{"must":[{"range":{"run":{"from":100000,"to":1000000000}}}'.
           '],"minimum_should_match":1,"should":['.
	     '{"bool":{"must":[{"term":{"message":"exited" }},{"term":{"message":"with"}}]}},'.
	     '{"bool":{"must":[{"term":{"message":"exit" }},{"term":{"message":"code"}},{"term":{"message":"90"}}]}}'.
	   ']}}';
$data = '{"size":0,"aggs":{"distinct_runs":{"cardinality":{"field":"run"}}},'.$filter.'}';

$crl = curl_init();

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
curl_close($crl);
$res=jsonDecode($ret);

$cardinality = intval($res['aggregations']['distinct_runs']['value']);

$size=$cardinality; //should be same

$partions=1.;
$pcutoff = 100;

$partitions = floor($size/$pcutoff) + round(($size%$pcutoff)>0);
if ($partitions==0) $partitions=1;

//echo $cardinality."!\n";
//$partitions=1;
//exit(0);

$summary = array();
$runs = array();

for ($current_part = 0; $current_part < $partitions ; $current_part+=1) {
  //echo $current_part."/".$partitions."\n";
  //terms query(es)
  $timeout = 60;
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

  $script = "int code90 = params['_source']['message'].indexOf('exit code 90');".
          "if (code90!=-1) return '90';".
          "int exception=params['_source']['message'].indexOf('exited with code ');".
          "int signal=params['_source']['message'].indexOf('exited with signal ');".
          "int end=params['_source']['message'].indexOf(', retries');".
          "if (end==-1) return null;".
          "if (exception!=-1) return params['_source']['message'].substring(exception+17,end);".
          "if (signal!=-1) return params['_source']['message'].substring(signal+19,end);".
          "return null;";

  $data='{"size":0,'.
      $filter.','.
//      '"query":{"bool":{"must":[{"range":{"run":{"from":100000,"to":1000000000}}},'.
//      '{"script":{"script":{"lang":"groovy","inline":"_source.message.find(\'exited with \')!=null || _source.message.find(\'exit code 90\')!=null"}}}]}},'.
      '"aggs":{'.
      '"run":{"terms":{"include":{"num_partitions":'.$partitions.',"partition":'.$current_part.'},"field":"run","order":{"_term":"desc"},"size":'.$size.'}'.
      ',"aggs":{"error":{"terms":{"size":1000,"order":{"_term":"asc"},"script":{"inline":"'.$script.'"}}}}'.
      '}}}';

  $crl = curl_init();

  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=jsonDecode($ret);

  //parse

  foreach($res['aggregations']['run']['buckets'] as $key=>$runbucket){
    $run = $runbucket["key"];
    $runs[$run]=array();
    //echo json_encode($runbucket)."\n";
    foreach($runbucket["error"]["buckets"] as $errkey=>$errbucket) {
      //echo json_encode($errbucket)."!\n";
      $crash = $errbucket["key"];
      $count = $errbucket["doc_count"];
      $runs[$run][$crash]=$count;

      if (array_key_exists($crash,$summary))
        $summary[$crash]+=$count;
      else
        $summary[$crash]=$count;
 
    }
  }
}
$retval=array();
$retval["summary"]=$summary;
$retval["runs"]=$runs;
$retval["query_partitions"]=$partitions;

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
