<?php 
$run = $_GET["run"];
$setup = $_GET["setup"];
$multirun =intval($_GET["multirun"]);



//cutoff
$lsceil=2000;


//if ($setup=="cdaq") $setup="cdaq*";
$minls=null;
$minls = $_GET["minls"];
$maxls=null;
$maxls = $_GET["maxls"];

$perls = 0;
$perls =intval($_GET["perls"]);
$int = 0;
$interval = intval($_GET["int"]);
//$minsb=0;
$minsb = $_GET["minsb"]!=null ? intval($_GET["minsb"]):0;
$maxsb = $_GET["maxsb"]!=null ? intval($_GET["maxsb"]):0;

//flag to use old inline script in case of older doc version without physical/HT CPU count
$new_cpu_match=true;
if ($setup) {
  preg_match("/\d+$/",$setup,$matches);
  if (count($matches)) {
    if (intval($matches[0])<2018) $new_cpu_match=false;
  }
}

header("Content-Type: application/json");
date_default_timezone_set("UTC");
$response=array();

$crl = curl_init();
$hostname = 'es-cdaq';

//find queried run doc in ES and start/stop time
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
//first get timestamps
//timestamps of min and max LS if specified in query parameters 
$mints=0;
$maxts=0;
if ($minls && $maxls) {
  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search';//&size=5000';
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.(intval($maxls)+1).'}}}]}},"aggs":{"minfmdate":{"min":{"field":"fm_date"}},"maxfmdate":{"max":{"field":"fm_date"}}  }}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  $start = $res["aggregations"]["minfmdate"]["value"];
  $end = $res["aggregations"]["maxfmdate"]["value"];
  if (intval($maxls)-intval($minls)>2000) $lsceil=intval($minls)+2000;
  $span = (intval($end)-intval($start))/1000.;
  //echo intval($start)-intval($end)."\n";
  //$minls=$maxls=null;
}
else {
  $span = strtotime($end)-strtotime($start);
}

//time format conversion, calculate aggregation interval
//$span = strtotime($end)-strtotime($start);
if ($span==0)
  $span = ($end-$start)*0.001;

if ($interval==0) {
  if ($span<360)
  $interval = strval(max(floor($span/50),5)).'s';//5? 
  elseif ($span<720)
  $interval = strval(max(floor($span/50),10)).'s';//5? 
  else
  $interval = strval(max(floor($span/50),10)).'s';//5? 
}
else $interval = $interval.'s';

$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);

//fetch EoLS documents (using scroll) to get per-LS event size, total L1 rate and LS timestamps
//per-BU aggregation is no longer needed (fu data in is now used to get avg. l1 rate per BU). query could probably be fetched using aggregation
if (false) {

  if ($minls && $maxls)
    $data =  '{"sort":["_doc"],"size":10000,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}}]}}}';
  else {
    $data =  '{"sort":["_doc"],"size":10000,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}}}';
  }

  //echo $url." -d'".$data."'\n";
  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?scroll=1m';//&size=5000';

  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  $scroll_id=0;
  $scroll_id=$res["_scroll_id"];
  //echo $scroll_id."\n";
  //$bwbybu=array();
  $ratetotal=array();
  $bwtotal = array();
  $evsize=array();
  $lstimes=array();

  $http_status=200;
  $first_scroll=true;

  do{
    if (!$first_scroll) {
      $url = 'http://'.$hostname.':9200/_search/scroll';
      $data = '{"scroll":"1m","scroll_id":"'.$scroll_id.'"}';
      curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
      curl_setopt ($crl, CURLOPT_URL,$url);
      curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

      $ret = curl_exec($crl);
      $http_status = curl_getinfo($crl, CURLINFO_HTTP_CODE);
    }
    if($http_status==200){
      if (!$first_scroll)
        $res = json_decode($ret,true);
      //echo $scroll_id."\n";
      //let try again on second scroll
      if (sizeof($res['hits']['hits'])==0 && !$first_scroll) break;
      foreach($res['hits']['hits'] as $key=>$value){
        $thebu = $value['_source']['appliance'];
        $ls=$value['_source']['ls'];
        $time=$value['_source']['fm_date'];
        if (!array_key_exists($ls,$lstimes)) {
          $lstimes[$ls]=strtotime($time)*1000;
        }
        if ($minsb && (intval($ls)<$minsb || intval($ls)>$maxsb)) continue; 
        //$bwbybu[$thebu][$ls]=$value['_source']['NBytes'];
        $ratetotal[$ls]=$value['_source']['TotalEvents'];
        if ($value['_source']['NEvents']>0) {
          $evsize[$ls]=$value['_source']['NBytes']/(1.0*$value['_source']['NEvents']);
	  //bw per secod:
          $bwtotal[$ls]=($ratetotal[$ls]/23.31)*($evsize[$ls]/1048576.);
        }
        else $bwtotal[$ls]=0;
      }
    }
    //else echo "ERROR: ".$http_status;
    $first_scroll=false;
  }while($http_status == 200);
  
}

else {

  $ratetotal=array();
  $bwtotal = array();
  $evsize=array();
  $lstimes=array();
  $trate=array();


  $agg = ',"aggs":{"ls":{"terms":{"field":"ls","size":10000},"aggs":{"TotalEvents":{"max":{"field":"TotalEvents"}},"NEvents":{"sum":{"field":"NEvents"}},"NBytes":{"sum":{"field":"NBytes"}},"fm_date":{"max":{"field":"fm_date"}}}}}';
  if ($minls && $maxls) {
    //$data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}}]}}'.$agg.'}';
    $max_ls_q = min(intval($maxls),intval($lsceil)-1);
    //$data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}},{"range":{"ls":{"lt":'.$lsceil.'}}}]}}'.$agg.'}';
    $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.$max_ls_q.'}}}]}}'.$agg.'}';
  }
  else
    $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}}'.$agg.'}';

  //echo $data."\n";

  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?pretty';//&size=5000';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

  $ret = curl_exec($crl);
  $http_status = curl_getinfo($crl, CURLINFO_HTTP_CODE);

  $res = json_decode($ret,true);
  //echo $ret."\n";
  foreach($res['aggregations']['ls']['buckets'] as $key=>$value){
    $ls=intval($value['key']);
    $time=$value['fm_date']['value_as_string'];
    if (!array_key_exists($ls,$lstimes)) {
      $lstimes[$ls]=strtotime($time)*1000;
    }
      
    if ($minsb && (intval($ls)<$minsb || intval($ls)>$maxsb)) continue; 
    $ratetotal[$ls]=$value['TotalEvents']['value'];
    if ($value['NEvents']['value']>0) {
      $evsize[$ls]=$value['NBytes']['value']/(1.0*$value['NEvents']['value']);
      //bw per second:
      $bwtotal[$ls]=($ratetotal[$ls]/23.31)*($evsize[$ls]/1048576.);
    }
    else
      $bwtotal[$ls]=0;
  }
}

$response['lstimes']=$lstimes;
      
//ksort($bwbybu);
//$response["bwbybu"]=array();
$response["ratebytotal"]=array();
//$response["ratebytotal2"]=array();
$response["ratebytotal"][]=array('name'=>'totals','data'=>array());
$response["ratebytotalls"]=array();
$response["ratebytotalls"][]=array('name'=>'totals','data'=>array());

/*
foreach($bwbybu as $key=>$value){
  $response["bwbybu"][]=array('name'=>$key,'data'=>array());
  ksort($value);
  foreach($value as $ls=>$rate){
    if ($minsb && (intval($ls)<$minsb || intval($ls)>$maxsb)) continue;  
    $response["bwbybu"][sizeof($response["bwbybu"])-1]['data'][]=array($ls,$rate/23.31);
  }
}*/

ksort($ratetotal);
foreach($ratetotal as $ls=>$rate){
  if ($minsb && (intval($ls)<$minsb || intval($ls)>$maxsb)) continue;
  if ($multirun==0)
    $response["ratebytotal"][0]['data'][]=array($ls,$rate/23.31);
  else
    $response["ratebytotal"][0]['data'][]=array($lstimes[$ls],$rate/23.31);
  $response["ratebytotalls"][0]['data'][]=array($ls,$rate/23.31);
  $trate[$ls]=($rate/23.31);
  //$response["ratebytotal2"][$ls]=$rate/23.31;
}


//scripted metrics

include 'scriptedQuery.php';

//per scripted terms variables
$aggres = '"rescat":{"terms":{"script":{"inline":"'.getTermScript($run).'"},"size":200,"order" : { "_term":"asc"}},"aggs":{"ovr":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{'.
  makeMetric("corrSysCPU02", $scriptinit,$scriptCorrSimpleCPU_Weighted,$scriptreduce).','.
  makeMetric("corr2SysCPU02",$scriptinit,$scriptCorrFuncCPU_Weighted,$scriptreduce).','.
  makeMetric("uncorrSysCPU",$scriptinit,$scriptUncorrCPU_Weighted,$scriptreduce).','.
  makeMetric("eventTimeUn",  $scriptinit,$scriptEvtime_Unweighted,$scriptreduce).','.
  '"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},'.
  '"fudatain":{"avg":{"field":"fuDataNetIn"}},'.
  '"avg":{"avg":{"field":"ramdisk_occupancy"}},'.
  '"avgbw":{"avg":{"field":"outputBandwidthMB"}},'.
  '"fusyscpu":{"avg":{"field":"fuSysCPUFrac"}},'.
  '"fusysfreq":{"avg":{"field":"fuSysCPUMHz"}}'.
'}}}}';

//everything, including aggs not separated per scripted terms
$data = '{"sort":{"fm_date":"asc"},"size":0,"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}},{"range":{"activeRunCMSSWMaxLS":{"lt":'.$lsceil.'}}}]}},"aggs":{'.
  $aggres.','.
  '"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{'.
    makeMetric("corrSysCPU02", $scriptinit,$scriptCorrSimpleCPU_Weighted,$scriptreduce).','.
    makeMetric("corr2SysCPU02",$scriptinit,$scriptCorrFuncCPU_Weighted,$scriptreduce).','.
    makeMetric("uncorrSysCPU", $scriptinit,$scriptUncorrCPU_Weighted,$scriptreduce).','.
    makeMetric("eventTimeUn",  $scriptinit,$scriptEvtime_Weighted,$scriptreduce).','.
    makeMetric("timeMetric",   $scriptinit,$scriptEvtimeAlt_Weighted,$scriptreduce).','.
    '"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},'.
    '"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}} }},'.
    '"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},'.
    '"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}'.
  '}}'.
'}}';

//echo $data."\n";

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);

$status= curl_getinfo($crl,CURLINFO_HTTP_CODE );
if ($status>201) {
  echo $ret."\n";
  exit(0);
}
//echo $ret;

$res = json_decode($ret,true);

$response['ramdisk'] = array();
$response['outputbw'] = array();
$response['fusyscpu'] = array();
$response['fusysfreq'] = array();
$response['fudatain'] = array();
$response['fusyscpu2']=array();
$response['fusyscpu2ls']=array();

$key=0;
foreach($res['aggregations']['rescat']['buckets'] as $key2=>$value){

  //if (count($value['ovr']['buckets'])<=1) continue;
  if (count($value['ovr']['buckets'])==1 && $value['ovr']['buckets'][0]['lsavg']['value']==-1) continue;
  $response['ramdisk'][$key]=array();
  $response['ramdisk'][$key]['name']=$value['key'];
  $response['ramdisk'][$key]['data']=array();

  $response['outputbw'][$key]=array();
  $response['outputbw'][$key]['name']=$value['key'];
  $response['outputbw'][$key]['data']=array();

  $response['fusyscpu'][$key]=array();
  $response['fusyscpu'][$key]['name']=$value['key'];
  $response['fusyscpu'][$key]['data']=array();

  $response['fusysfreq'][$key]=array();
  $response['fusysfreq'][$key]['name']=$value['key'];
  $response['fusysfreq'][$key]['data']=array();

  $response['fudatain'][$key]=array();
  $response['fudatain'][$key]['name']=$value['key'];
  $response['fudatain'][$key]['data']=array();

  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $myLS = intval($vvalue['lsavg']['value']);
    if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue;
    $response['ramdisk'][$key]['data'][]=array($vvalue['key'],$vvalue['avg']['value']);
    $response['outputbw'][$key]['data'][]=array($vvalue['key'],$vvalue['avgbw']['value']);
    $response['fusyscpu'][$key]['data'][]=array($vvalue['key'],$vvalue['fusyscpu']['value']);
    $response['fusysfreq'][$key]['data'][]=array($vvalue['key'],$vvalue['fusysfreq']['value']);
    $response['fudatain'][$key]['data'][]=array($vvalue['key'],$vvalue['fudatain']['value']);
  }
  $key+=1;
}

$response['fusyscpu2'][]=array();
$response['fusyscpu2'][0]['name']='avg uncorr';
$response['fusyscpu2'][0]['data']=array();
$response['fusyscpu2'][]=array();
$response['fusyscpu2'][1]['name']='20% htcor';
$response['fusyscpu2'][1]['data']=array();
$response['fusyscpu2'][]=array();
$response['fusyscpu2'][2]['name']='20% htcor(2x-x*x)';
$response['fusyscpu2'][2]['data']=array();

foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue;
  if ($perls==0) {
    $response['fusyscpu2'][0]['data'][]=array($vvalue['key'],$vvalue['uncorrSysCPU']['value']);
    $response['fusyscpu2'][1]['data'][]=array($vvalue['key'],$vvalue['corrSysCPU02']['value']);
    $response['fusyscpu2'][2]['data'][]=array($vvalue['key'],$vvalue['corr2SysCPU02']['value']);
  }
  else {
    $response['fusyscpu2'][0]['data'][]=array($myLS,$vvalue['uncorrSysCPU']['value']);
    $response['fusyscpu2'][1]['data'][]=array($myLS,$vvalue['corrSysCPU02']['value']);
    $response['fusyscpu2'][2]['data'][]=array($myLS,$vvalue['corr2SysCPU02']['value']);
  }
}

$response['fusyscpu2ls'][]=array();
$response['fusyscpu2ls'][0]['name']='avg uncorr';
$response['fusyscpu2ls'][0]['data']=array();
$response['fusyscpu2ls'][]=array();
$response['fusyscpu2ls'][1]['name']='20% htcor';
$response['fusyscpu2ls'][1]['data']=array();
$response['fusyscpu2ls'][]=array();
$response['fusyscpu2ls'][2]['name']='20% htcor(2x-x*x)';
$response['fusyscpu2ls'][2]['data']=array();

foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue;
  $response['fusyscpu2ls'][0]['data'][]=array($myLS,$vvalue['uncorrSysCPU']['value']);
  $response['fusyscpu2ls'][1]['data'][]=array($myLS,$vvalue['corrSysCPU02']['value']);
  $response['fusyscpu2ls'][2]['data'][]=array($myLS,$vvalue['corr2SysCPU02']['value']);
}




$response['fuetime'][]=array();
$response['fuetime'][]=array();
$response['fuetimels'][]=array();
$response['fuetimels'][]=array();

$response['fuetime'][0]['name']='/inst. BUFU rate';
$response['fuetime'][1]['name']='/inst. BUFU rate (alt)';
$response['fuetimels'][0]['name']='/inst. BUFU rate';
$response['fuetimels'][1]['name']='/inst. BUFU rate (alt)';

$response['fuetime'][0]['data']=array();
$response['fuetime'][1]['data']=array();
$response['fuetimels'][0]['data']=array();
$response['fuetimels'][1]['data']=array();
$response['bwcompare']=array();
$response['bwcompare'][0]['name']="FU/EoLS bw";
$response['bwcompare'][0]['data']=[];

$response['erate'][]=array();
$response['erate'][0]['name']='total inst. event rate to FUs';
$response['erate'][0]['data']=[];
$response['erater'][]=array();
$response['erater'][0]['name']='FU rate/bw ratio';
$response['erater'][0]['data']=[];

$invmb = 1./1048576.;
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue; 
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $erate = (1048576.*$vvalue['sum_fudatain']['value'])/$esize;
    $response['erate'][0]['data'][]=array($vvalue['key'],$erate);
    if (array_key_exists($myLS,$trate))
      $response['erater'][0]['data'][]=array($vvalue['key'],$erate/$trate[$myLS]);
    $myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / $erate;
    $myval1 = $vvalue['timeMetric']['value'] * $esize;
    $myval2 = $vvalue['eventTimeUn']['value'] * $esize*$invmb;
    $response['fuetime'][0]['data'][]=array($vvalue['key'],$myval);
    if ($myval1<10)
      $response['fuetime'][1]['data'][]=array($vvalue['key'],$myval1);
    $response['fuetimels'][0]['data'][]=array($myLS,$myval);
    $response['fuetimels'][1]['data'][]=array($myLS,$myval2);
    $bwtot=$bwtotal[$myLS];
    if ($bwtot!=0) {
      if ($multirun) {
	if (array_key_exists($myLS,$lstimes))
          $response['bwcompare'][0]['data'][]=array($lstimes[$myLS],$vvalue['sum_fudatain']['value']/(1.0*$bwtot));
      }
      else
        $response['bwcompare'][0]['data'][]=array($myLS,$vvalue['sum_fudatain']['value']/(1.0*$bwtot));
      //echo $myLS." ".$vvalue['sum_fudatain']['value']." : ".$bwtot."\n";
    }
  }
}

$response['fuetimelsres'] = array();
$response['fuetimelsresls'] = array();
$response['fucpures'] = array();
$response['fucpuresls'] = array();
$response['fucpures2'] = array();
$key=0;
foreach($res['aggregations']['rescat']['buckets'] as $keyN=>$value){
  if (count($value['ovr']['buckets'])==1 && $value['ovr']['buckets'][0]['lsavg']['value']==-1) continue;
  $response['fuetimelsres'][$key]=array();
  $response['fuetimelsres'][$key]['name']=$value['key'];
  $response['fuetimelsres'][$key]['data']=array();
  $response['fuetimelsresls'][$key]=array();
  $response['fuetimelsresls'][$key]['name']=$value['key'];
  $response['fuetimelsresls'][$key]['data']=array();
  $key1=$key;
  $key2=$key;
  $response['fucpures'][$key1] = array();
  $response['fucpuresls'][$key1] = array();
  $response['fucpures2'][$key2] = array();
  $response['fucpures'][$key1]['name']=$value['key']."";
  $response['fucpuresls'][$key1]['name']=$value['key']."";
  $response['fucpures2'][$key2]['name']=$value['key']."";
  $response['fucpures'][$key1]['data']=array();
  $response['fucpuresls'][$key1]['data']=array();
  $response['fucpures2'][$key2]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $myLS = intval($vvalue['lsavg']['value']);
    if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue;
    $esize = $evsize[$myLS];
    $etime = $vvalue['eventTimeUn']['value']*$esize*$invmb;
    $response['fuetimelsresls'][$key]['data'][]=array($myLS,$etime);
    $response['fucpuresls'][$key1]['data'][]=array($myLS,$vvalue['uncorrSysCPU']['value']);
    if ($multirun==0) {
      $response['fuetimelsres'][$key]['data'][]=array($myLS,$etime);
      $response['fucpures'][$key1]['data'][]=array($myLS,$vvalue['uncorrSysCPU']['value']);
      $response['fucpures2'][$key2]['data'][]=array($myLS,$vvalue['corr2SysCPU02']['value']);
    }
    else {
      $response['fuetimelsres'][$key]['data'][]=array($vvalue['key'],$etime);
      $response['fucpures'][$key1]['data'][]=array($vvalue['key'],$vvalue['uncorrSysCPU']['value']);
      $response['fucpures2'][$key2]['data'][]=array($vvalue['key'],$vvalue['corr2SysCPU02']['value']);
    }
  }
  $key+=1;
}

curl_close($crl);

echo json_encode($response);
?>
