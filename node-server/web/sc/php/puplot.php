<?php 
$run = $_GET["run"];
$setup = $_GET["setup"];
$minls=null;
$minls = $_GET["minls"];
$maxls=null;
$maxls = $_GET["maxls"];
header("Content-Type: application/json");
$response=array();
date_default_timezone_set("UTC");

$lsceil=2000;

//flag to use old inline script in case of older doc version without physical/HT CPU count
$new_cpu_match=true;
if ($setup) {
  preg_match("/\d+$/",$setup,$matches);
  if (count($matches)) {
    if (intval($matches[0])<2018) $new_cpu_match=false;
  }
}

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


//TODO: order by LS and filter based on sharp changes in rate in neighboring points

if ($minls && $maxls)
  $data =  '{"size":0,"query":{"bool":{"must":[{"range":{"ls":{"lt":'.$lsceil.'}}},{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.intval($minls).',"to":'.(intval($maxls)+1).'}}}]}},"aggs":{"ls":{"terms":{"size":30000,"field":"ls"},"aggs":{"rate":{"sum":{"field":"NEvents"}},"bw":{"sum":{"field":"NBytes"}} }}}}';
else
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}},"aggs":{"ls":{"terms":{"size":30000,"field":"ls"},"aggs":{"rate":{"sum":{"field":"NEvents"}},"bw":{"sum":{"field":"NBytes"}} }}}}';

//$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?scroll=1m&search_type=scan';//&size=5000';
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$ret = curl_exec($crl);
$res = json_decode($ret,true);

$evsize=array();
$response['eolsrate']=array();
$response['eolsrate'][]=array();
$response['eolsrate'][0]['name']=$run;
$response['eolsrate'][0]['data']=array();

//filtering
$filtered_lskeys=array();

$alength = count($res['aggregations']['ls']['buckets']);
for ($cnt =0; $cnt<$alength;$cnt++) {
  $add_filter=false;
  $pre=array();
  $prenum=1.;
/*  if ($cnt-3>=0) {
    $pre[]=$res['aggregations']['ls']['buckets'][$cnt-3]["rate"]["value"]/23.31;
    $prenum++;
  }*/
  if ($cnt-2>=0) {
    $pre[]=$res['aggregations']['ls']['buckets'][$cnt-2]["rate"]["value"]/23.31;
    $prenum++;
  }
  if ($cnt-1>=0) {
    $pre[]=$res['aggregations']['ls']['buckets'][$cnt-1]["rate"]["value"]/23.31;
    $prenum++;
  }

  $pos=array();
  $posnum=1.;
/*  if ($cnt+3<$alength) {
    $pos[]=$res['aggregations']['ls']['buckets'][$cnt+3]["rate"]["value"]/23.31;
    $posnum++;
  }*/
  if ($cnt+2<$alength) {
    $pos[]=$res['aggregations']['ls']['buckets'][$cnt+2]["rate"]["value"]/23.31;
    $posnum++;
  }
  if ($cnt+1<$alength) {
    $pos[]=$res['aggregations']['ls']['buckets'][$cnt+1]["rate"]["value"]/23.31;
    $posnum++;
  }
  $p0=$res['aggregations']['ls']['buckets'][$cnt]["rate"]["value"]/23.31;
  $pre[]=$p0;
  $pos[]=$p0;

  $preavg=0.;
  $presigma=0.;
  for ($cnt2 =0; $cnt2<$prenum;$cnt2++) {
    $preavg+=$pre[$cnt2];
  }
//  continue;
  $preavg=$preavg/$prenum;
  for ($cnt2 =0; $cnt2<$prenum;$cnt2++) {
    $presigma+=pow($pre[$cnt2]-$preavg,2);
  }
  $presigma=sqrt($presigma/$prenum);

  $posavg=0.;
  $possigma=0.;
  for ($cnt2 =0; $cnt2<$posnum;$cnt2++) {
    $posavg+=$pos[$cnt2];
  }
  $posavg=$posavg/$posnum;
  for ($cnt2 =0; $cnt2<$posnum;$cnt2++) {
    $possigma+=pow($pos[$cnt2]-$posavg,2);
  }

  $possigma=sqrt($possigma/$posnum);
/*
  echo json_encode($pre)."\n";
  echo json_encode($pos)."\n";
  echo "ls ".$res['aggregations']['ls']['buckets'][$cnt]["key"]." ".$preavg." ".$presigma."   ".$posavg." ".$possigma."\n";
*/
  if ($posavg<10000 && $preavg<10000) $add_filter=true;
  if ($possigma>0.05*abs($posavg) || $presigma>0.05*abs($preavg)) $add_filter=true;

  if ($add_filter)
    $filtered_lskeys[intval($res['aggregations']['ls']['buckets'][$cnt]["key"])]=[$preavg,$presigma,$posavg,$possigma];

}
//echo json_encode($filtered_lskeys)."\n";
//echo json_encode($res['aggregations']['ls']['buckets'])."\n";
//exit(0);

foreach($res['aggregations']['ls']['buckets'] as $kkey=>$vvalue){
  $key=$vvalue['key'];
  if (array_key_exists($key,$filtered_lskeys)) continue;
  $rate  = $vvalue["rate"]["value"];
  $bw = $vvalue["bw"]["value"];
  if ($bw>0. && $key>0 ) $evsize[$key]=$bw/(1.*$rate);
  $response['eolsrate'][0]['data'][]=array(intval($key),$rate/23.31);
}

include 'scriptedQuery.php';

//if ($minls && $maxls)
//  $filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';
//else
//$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';


$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}},{"range":{"activeRunCMSSWMaxLS":{"from":1}}},{"range":{"fuDataNetIn":{"from":0.1}}},{"range":{"activeRunCMSSWMaxLS":{"lt":'.$lsceil.'}}}]}}';
//$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}},{"range":{"activeRunCMSSWMaxLS":{"from":1}}}]}}';

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';
$data = '{"size":0,'.$filter1.','.
        '"aggs":{'.
          '"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},'.
	    '"aggs":{'.
	      makeMetric("uncorrSysCPU",$scriptinit,$scriptUncorrCPU_Weighted,$scriptreduce).','.
	      makeMetric("corrSysCPU",$scriptinit,$scriptCorrFuncCPU_Weighted,$scriptreduce).','.
	      makeMetric("eventTimeUn",$scriptinit,$scriptEvtime_Weighted,$scriptreduce).','.
	      '"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},'.
	      '"appliance":{"terms":{"field":"appliance","size":200},"aggs":{'.
	        '"fudatain":{"avg":{"field":"fuDataNetIn"}},'.
		'"res":{"avg":{"field":"active_resources"}}
	      }},'.
	      '"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},'.
	      '"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}'.
	    '}'.
	  '},'.
	  '"rescat":{"terms":{"script":{"inline":"'.getTermScript($run).'"},"size":200,"order" : { "_term":"asc"}},'.
	    '"aggs":{'.
	      '"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},'.
	        '"aggs":{'.
	          makeMetric("uncorrSysCPU",$scriptinit,$scriptUncorrCPU_Weighted,$scriptreduce).
		  ',"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},'.
		  '"appliance":{"terms":{"field":"appliance","size":200},'.
		    '"aggs":{'.
		      '"fudatain":{"avg":{"field":"fuDataNetIn"}},'.
		      '"res":{"avg":{"field":"active_resources"}}'.
		    '}'.
		  '},'.
		  '"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},'.
		  '"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}   }'.
	      '}'.
	    '}'.
	  '}'.
	'}'.
      '}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);

$response['fuetimels'][]=array();
$response['fuetimels'][0]['name']='/inst. BUFU rate';
$response['fuetimels'][0]['data']=array();

$response['pucpu'][]=array();
$response['pucpu'][0]['name']='/';
$response['pucpu'][0]['data']=array();

$response['fuesizels'][]=array();
$response['fuesizels'][0]['name']='/inst. BUFU rate';
$response['fuesizels'][0]['data']=array();
$response['fuetimelsalt'][]=array();
$response['fuetimelsalt'][]['name']='/inst. BUFU rate (2)';
$response['fuetimelsalt'][0]['data']=array();
$invmb = 1./1048576.;

foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if (array_key_exists($myLS,$filtered_lskeys)) continue;
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $erate = (1048576.0*$vvalue['sum_fudatain']['value'])/$esize;
    $response['pucpu'][0]['data'][]=array($myLS,$vvalue['corrSysCPU']['value']);

    if ($erate>10000) {
      $myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / $erate;
    //$myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / ((1048576.*$vvalue['sum_fudatain']['value'])/$esize);
  //  echo $myval." ".$vvalue['sum_res']['value']." ".((1000000*$vvalue['sum_fudatain']['value'])/$esize)."\n";
      $response['fuetimels'][0]['data'][]=array($myLS,$myval);
    }

    $myval_et = $vvalue['eventTimeUn']['value'] * $esize*$invmb;
    if ($myval_et<0.5)//limit "wild" points
      $response['fuetimelsalt'][0]['data'][]=array($myLS,$myval_et);

    $response['fuesizels'][0]['data'][]=array($myLS,$esize);
  }
}

$response['fuetimels2']=array();
foreach($res['aggregations']['rescat']['buckets'] as $key=>$value){
  $response['fuetimels2'][$key]=array();
  $response['fuetimels2'][$key]['name']=$value['key'];
  $response['fuetimels2'][$key]['data']=array();

  //echo $key."\n";
  foreach($value['ovr2']['buckets'] as $kkey=>$vvalue) {
    $myLS = intval($vvalue['lsavg']['value']);
    if (array_key_exists($myLS,$filtered_lskeys)) continue;
    if (array_key_exists($myLS,$evsize)) {
      $esize = $evsize[$myLS];
      $erate = (1048576.0*$vvalue['sum_fudatain']['value'])/$esize;
      if ($erate>300) {
        $myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / $erate;
        //$myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / ((1048576.*$vvalue['sum_fudatain']['value'])/$esize);
        $response['fuetimels2'][$key]['data'][]=array($myLS,$myval);
      }
    }
  }
}

curl_close($crl);
echo json_encode($response);
?>
