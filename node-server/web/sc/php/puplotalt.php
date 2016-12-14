<?php 
$run = $_GET["run"];
$setup = "cdaq*";
header("Content-Type: application/json");
$response=array();
date_default_timezone_set("UTC");
$crl = curl_init();
$hostname = 'es-cdaq';
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search';
$data =  '{"sort":{"startTime":"desc"},"query":{"term":{"runNumber":'.$run.'}}}';
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

//first get timestamps
$span = strtotime($end)-strtotime($start);
if ($span==0)
  $span = ($end-$start)*0.001;

$interval = strval(min(230,max(floor($span/50),20))).'s';//5?
$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);

$data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}},aggs:{ls:{terms:{size:0,field:"ls"},aggs:{rate:{sum:{field:"NEvents"}},bw:{sum:{field:"NBytes"}} }}}}';
//$data =  '{"size":10000,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}}}';

//$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?scroll=1m&search_type=scan';//&size=5000';
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$ret = curl_exec($crl);
$res = json_decode($ret,true);

$evsize=array();
foreach($res['aggregations']['ls']['buckets'] as $kkey=>$vvalue){
  //echo $kkey." ".$vvalue."\n";
  $rate  = $vvalue["rate"]["value"];
  $bw = $vvalue["bw"]["value"];
  if ($bw>0. && $kkey>0 ) $evsize[$kkey]=$bw/(1.*$rate);
}

$scriptinit = "_agg['timeun'] = []; _agg['cpuweight']=[]";

/*
$scriptuncorr = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
	  "  _agg['timeun'].add(_source['active_resources']*mysum/(mycount*mycount));".
	  "  _agg['cpuweight'].add(_source['active_resources']/mycount);".
	  "}";
*/

$scriptevtime = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0 && _source['fuDataNetIn']>0.0) {".
          "  mytimeoversize=_source['active_resources']*mysum/(1.0*_source['fuDataNetIn']);".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
          "  if (cpuw==32) archw=0.96;".
          "  if (cpuw==48) archw=1.13;".
          "  if (cpuw==56) archw=1.15;".
	  "  _agg['timeun'].add(archw*cpuw*mytimeoversize/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptreduce ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.timeun) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';

$data = '{'.
          'size:0,'.
          'query:{'.
            '"bool":{'.
             'must:[{range:{fm_date:{gt:"'.$start.'",lt:"'.$end.'"}}},{term:{activeFURun:'.$run.'}}]'.
            '}'.
          '},'.
          'aggs:{'.
            'ovr2:{'.
              'date_histogram:{field:"fm_date",interval:"'.$interval.'"},'.
              'aggs:{'.
                'eventTimeUn:{scripted_metric:{init_script:"'.$scriptinit.'",map_script:"'.$scriptevtime.'",reduce_script:"'.$scriptreduce.'"}},'.
                'lsavg:{avg:{field:"activeRunCMSSWMaxLS"}}'.
              '}'.
            '}'.
          '}'.
        '}';

//echo $data."\n";

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
//echo $ret."\n";
$res = json_decode($ret,true);

$response['fuetimels'][]=array();
$response['fuetimels'][]['name']='/inst. BUFU rate';
$response['fuetimels'][0]['data']=array();
$invmb = 1./1048576.;
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $myval = $vvalue['eventTimeUn']['value'] * $esize*$invmb;
  //  echo $myval." ".$vvalue['sum_res']['value']." ".((1000000*$vvalue['sum_fudatain']['value'])/$esize)."\n";
    //$response['fuetime'][0]['data'][]=array($vvalue['key'],$myval);
    if ($myval<0.5)//limit "wild" points
    $response['fuetimels'][0]['data'][]=array($myLS,$myval);
  }
}


curl_close($crl);

echo json_encode($response);
?>
