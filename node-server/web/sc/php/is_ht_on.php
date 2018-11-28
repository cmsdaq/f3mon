<?php 
//$run = 297722;
//$setup = "cdaq2017";
$run = $_GET["run"];
$setup = $_GET["setup"];
//if ($setup=="cdaq") $setup="cdaq*";
$minls=null;
$minls = $_GET["minls"];
$maxls=null;
$maxls = $_GET["maxls"];
$multirun = null;
$multirun = isset($_GET["multirun"]);

header("Content-Type: application/json");
date_default_timezone_set("UTC");
$response=array();
$crl = curl_init();
$hostname = 'es-cdaq';
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search';
if ($run)
 $data =  '{"sort":{"startTime":"desc"},"query":{"term":{"runNumber":'.$run.'}}}';
else
 $data =  '{"sort":{"startTime":"desc"}}';
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);

$res = json_decode($ret,true);
$start = $res["hits"]["hits"][0]["_source"]["startTime"];
$end = $res["hits"]["hits"][0]["_source"]["endTime"];
if(!$run){
$run = $res["hits"]["hits"][0]["_source"]["runNumber"];
}
$ongoing = "";
if($end==null){
  $end=date("Y-m-dkH:i:s.u"); $end=str_replace('k','T',$end);
  $ongoing='ongoing';
}

#only look at full run range in case of multirun, so first find max LS
if ($multirun!=null) {
  $minls=1;
  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search';//&size=5000';
  $data = '{"size":0,"query":{"parent_id":{"type":"eols","id":qparam_runNumber}},"aggregations":{"maxls":{"max":{"field":"ls"}}}}';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  $maxls = $res["aggregations"]["maxls"]["value"];
}

//first get timestamps
if ($minls && $maxls) {
  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search';//&size=5000';
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.intval($maxls).'}}}]}},"aggs":{"minfmdate":{"min":{"field":"fm_date"}},"maxfmdate":{"max":{"field":"fm_date"}}  }}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  $start = $res["aggregations"]["minfmdate"]["value"];
  $end = $res["aggregations"]["maxfmdate"]["value"];
}

$span = strtotime($end)-strtotime($start);
if ($span==0)
  $span = ($end-$start)*0.001;

$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'ongoing'=>$ongoing);

$scriptinit = "_agg['hton'] = []; _agg['htoff']=[]; _agg['incons']=[]; _agg['total']=[]";

$scriptmap = //"mycount=_source['fuSysCPUFrac'].size();".
	     "if (_source['activePhysCores']>0) {".
	     " if (2*_source['activePhysCores']==_source['activeHTCores'])  _agg['hton'].add(1);".
	     " else if (_source['activePhysCores']==_source['activeHTCores'])  _agg['htoff'].add(1);".
	     " else _agg['incons'].add(1);".
	     " _agg['total'].add(1);".
	     "}";

$scriptreduce ="fsumon = 0d; fsumoff = 0d; ftot=0d; fincons=0d;".
               "for (agg in _aggs) {".
	       " if (agg) {".
	       "  for (a in agg.hton) fsumon+=a;".
	       "  for (a in agg.htoff) fsumoff+=a;".
	       "  for (a in agg.total) ftot+=a;".
	       "  for (a in agg.incons) fincons+=a;".
	       " }".
	       "};".
	       "if (fincons!=0) return 4;".
	       "if (ftot!=0d) {".
	       " if (fsumon>ftot*0.99) return 3;".
	       " if (fsumoff>=ftot*0.99 && fsumoff<ftot*1.01) return 1;".
	       " return 2;".
	       "} else {return 0d;}";


$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';


$data = '{"sort":{"fm_date":"asc"},"size":0,"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},'.
         '{"term":{"activeFURun":'.$run.'}}]}},"aggs":{"answer":{"scripted_metric":{'.
	 '"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},'.
	 '"map_script":{"lang":"groovy","inline":"'.$scriptmap.'"},'.
	 '"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}'.
	 '}}}}';
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);

$res = json_decode($ret,true);

$response['answer'] = $res["aggregations"]["answer"];
$response['multirun'] = ($multirun!=null);

curl_close($crl);

echo json_encode($response);
?>
