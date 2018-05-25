<?php 
$run = $_GET["run"];
$setup = $_GET["setup"];
//if ($setup=="cdaq") $setup = "cdaq*";
$minls=null;
$minls = $_GET["minls"];
$maxls=null;
$maxls = $_GET["maxls"];
//http://cmsdaqfff.cern.ch/prod/sc/php/appliance_analysis.php?run=315713&setup=cdaq&minls=1&maxls=1132
//$run="315713";
//$setup="cdaq";
//$minls=1;
//$maxls=1000;

//flag to use old inline script in case of older doc version without physical/HT CPU count
$new_cpu_match=true;
if ($setup) {
  preg_match("/\d+$/",$setup,$matches);
  if (count($matches)) {
    if (intval($matches[0])<2018) $new_cpu_match=false;
  }
}

header("Content-Type: application/json");
$response=array();
date_default_timezone_set("UTC");
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
/*
$span = strtotime($end)-strtotime($start);
$interval=strval(max(1,floor($span/100))).'s';
$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);
*/
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
  $span = (intval($end)-intval($start))/1000.;
  //echo intval($start)-intval($end)."\n";
  //$minls=$maxls=null;
}
else {
  $span = strtotime($end)-strtotime($start);
}
$interval = strval(max(max(1,floor($span/100)),10)).'s';//5?
//$interval=strval(max(1,floor($span/100))).'s';
//if ($interval>200) interval=200;
$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);



if ($minls && $maxls)
  $data =  '{"sort":["_doc"],"size":10000,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}}]}}}';
else {
  $data =  '{"sort":["_doc"],"size":10000,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}}}';
}

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?scroll=1m';//&size=5000';
//echo $url." -d'".$data."'\n";

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$ret = curl_exec($crl);
$res = json_decode($ret,true);
$scroll_id=0;
$scroll_id=$res["_scroll_id"];
//echo $scroll_id."\n";
$ratebybu=array();
$bwbybu=array();
$ratetotal=array();
$evsize=array();

$http_status=200;
$http_status=curl_getinfo($crl, CURLINFO_HTTP_CODE);
$first_scroll=true;

do{
  if (!$first_scroll) {
    //$url = 'http://'.$hostname.':9200/_search/scroll?scroll=1m&scroll_id='.$scroll_id;
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
    if (sizeof($res['hits']['hits'])==0 && !$first_scroll) break;
    foreach($res['hits']['hits'] as $key=>$value){
      $thebu = $value['_source']['appliance'];
      if(!array_key_exists($thebu,$ratebybu)){
  	$ratebybu[$thebu]=array();
  	$bwbybu[$thebu]=array();
      }
      $ls=$value['_source']['ls'];
      $ratebybu[$thebu][$ls]=$value['_source']['NEvents'];
      $bwbybu[$thebu][$ls]=$value['_source']['NBytes'];
      if ($value['_source']['NEvents']>0) {
        $evsize[$ls]=$value['_source']['NBytes']/(1.0*$value['_source']['NEvents']);
      }
      $ratetotal[$ls]=$value['_source']['TotalEvents'];
    }
  }
  //else echo "ERROR: ".$http_status;
  $first_scroll=false;
}while($http_status == 200);
      

ksort($ratebybu);
ksort($bwbybu);
$response["ratebybu"]=array();
$response["bwbybu"]=array();
$response["ratebytotal"]=array();
$response["ratebytotal2"]=array();
$response["ratebytotal"][]=array('name'=>'totals','data'=>array());;
foreach($ratebybu as $key=>$value){
  $response["ratebybu"][]=array('name'=>$key,'data'=>array());
  ksort($value);
  foreach($value as $ls=>$rate){
    $response["ratebybu"][sizeof($response["ratebybu"])-1]['data'][]=array($ls,$rate/23.31);
  }
}
foreach($bwbybu as $key=>$value){
  $response["bwbybu"][]=array('name'=>$key,'data'=>array());
  ksort($value);
  foreach($value as $ls=>$rate){
    $response["bwbybu"][sizeof($response["bwbybu"])-1]['data'][]=array($ls,$rate/23.31);
  }
}
ksort($ratetotal);
foreach($ratetotal as $ls=>$rate){
  $response["ratebytotal"][0]['data'][]=array($ls,$rate/23.31);
  $response["ratebytotal2"][$ls]=$rate/23.31;
}

$scriptinit = "_agg['cpuavg'] = []; _agg['cpuweight']=[]";


if ($new_cpu_match) {

  $cpu_script_2 = "cpuw = _source['activePhysCores']/mycount;".
                  "if (cpuw==16) archw=0.96;".
                  "if (cpuw==24) archw=1.13;".
                  "if (cpuw==28 || cpuw==32) archw=1.15;".
                  "if (_source['activePhysCores']==2*_source['activeHTCores']) cpuw= _source['activeHTCores']/mycount;";

  $cpu_script_1 = $cpu_script_2.
                  "else if (_source['activePhysCores']==_source['activeHTCores']) mysum=mysumu;";
	
} else {
  $cpu_script_2 = "cpuw = _source['active_resources']/mycount;".
                  "if (cpuw==32 || cpuw==16) archw=0.96;".
                  "if (cpuw==48 || cpuw==24) archw=1.13;".
                  "if (cpuw==56 || cpuw==28) archw=1.15;".
	
  $cpu_script_1 = $cpu_script_2.
                  "if (cpuw<30) mysum=mysumu;";
}
	


$scriptcorr02 = " mysum = 0d;          mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	    "uncorr = _source['fuSysCPUFrac'][i];".
	    "corr=0d;".
	    "if (uncorr<0.5) {".
	      "corr = uncorr * 1.6666666;".
	    "} else {".
	      "corr = (0.5+0.2*(uncorr-0.5))*1.6666666;".
	    "};".
	    "mysum+=corr; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
	    "_agg['cpuavg'].add(_source['active_resources']*mysum/(mycount*mycount));".
	    "_agg['cpuweight'].add(_source['active_resources']/mycount);".
	  "}";

//B: corrections from TSG (single-thread power vs. Ivy bridge
$scriptcorrB02 = " mysum = 0d;          mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	    "uncorr = _source['fuSysCPUFrac'][i];".
	    "corr=0d;".
	    "if (uncorr<0.5) {".
	      "corr = uncorr * 1.6666666;".
	    "} else {".
	      "corr = (0.5+0.2*(uncorr-0.5))*1.6666666;".
	    "};".
	    "mysum+=corr; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
            "archw=1d;".
	    $cpu_script_1.
	    "_agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	    "_agg['cpuweight'].add(archw*cpuw);".
	  "}";


$scriptuncorr = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
	  "  _agg['cpuavg'].add(_source['active_resources']*mysum/(mycount*mycount));".
	  "  _agg['cpuweight'].add(_source['active_resources']/mycount);".
	  "}";

$scriptuncorrB = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
          "  archw=1d;".
	    $cpu_script_2.
	  "  _agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptreduce ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.cpuavg) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 


$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';
$data = '{"sort":{"fm_date":"asc"},"size":0,"query":{"bool":{"must":{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},"must":{"term":{"activeFURun":'.$run.'}}}},"aggs":{"appliance":{"terms":{"field":"appliance","size":200,"order" : { "_term":"asc"}},"aggs":{"ovr":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{"avg":{"avg":{"field":"ramdisk_occupancy"}}, "avgbw":{"avg":{"field":"outputBandwidthMB"}},"fusyscpu":{"avg":{"field":"fuSysCPUFrac"}},"fusysfreq":{"avg":{"field":"fuSysCPUMHz"}},"fudatain":{"avg":{"field":"fuDataNetIn"}},"activeRunLSBWMB":{"avg":{"field":"activeRunLSBWMB"}}}}}}, "ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}}     }},"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}   }} }}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);

//echo $ret;
//exit(1);

$response['ramdisk'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['ramdisk'][$key]=array();
  $response['ramdisk'][$key]['name']=$value['key'];
  $response['ramdisk'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['ramdisk'][$key]['data'][]=array($vvalue['key'],$vvalue['avg']['value']);
  }
}

$response['outputbw'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['outputbw'][$key]=array();
  $response['outputbw'][$key]['name']=$value['key'];
  $response['outputbw'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['outputbw'][$key]['data'][]=array($vvalue['key'],$vvalue['avgbw']['value']);
  }
}

$response['fusyscpu'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['fusyscpu'][$key]=array();
  $response['fusyscpu'][$key]['name']=$value['key'];
  $response['fusyscpu'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['fusyscpu'][$key]['data'][]=array($vvalue['key'],$vvalue['fusyscpu']['value']);
  }
}

$response['fusysfreq'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['fusysfreq'][$key]=array();
  $response['fusysfreq'][$key]['name']=$value['key'];
  $response['fusysfreq'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['fusysfreq'][$key]['data'][]=array($vvalue['key'],$vvalue['fusysfreq']['value']);
  }
}

$response['fudatain'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['fudatain'][$key]=array();
  $response['fudatain'][$key]['name']=$value['key'];
  $response['fudatain'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['fudatain'][$key]['data'][]=array($vvalue['key'],$vvalue['fudatain']['value']);
  }
}

$response['lumibw'] = array();
foreach($res['aggregations']['appliance']['buckets'] as $key=>$value){
  $response['lumibw'][$key]=array();
  $response['lumibw'][$key]['name']=$value['key'];
  $response['lumibw'][$key]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $response['lumibw'][$key]['data'][]=array($vvalue['key'],$vvalue['activeRunLSBWMB']['value']);
  }
}

$response['fusyscpu2'][]=array();
$response['fusyscpu2'][0]['name']='avg uncorr';
$response['fusyscpu2'][0]['data']=array();
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $response['fusyscpu2'][0]['data'][]=array($vvalue['key'],$vvalue['uncorrSysCPU']['value']);
}

$response['fusyscpu2'][]=array();
$response['fusyscpu2'][1]['name']='avg 20% ht corr';
$response['fusyscpu2'][1]['data']=array();
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $response['fusyscpu2'][1]['data'][]=array($vvalue['key'],$vvalue['corrSysCPU02']['value']);
}


$response['fuetime'][]=array();
$response['fuetime'][0]['name']='/global L1 rate';
$response['fuetime'][1]['name']='/inst. BUFU rate';
$response['fuetime'][0]['data']=array();
$response['fuetime'][1]['data']=array();
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  //echo $myLS;
  if (array_key_exists($myLS,$response["ratebytotal2"])) {
     $erate = $response["ratebytotal2"][$myLS];
     if ($erate==0) continue;
     $myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / (1.*$erate);
     $response['fuetime'][0]['data'][]=array($vvalue['key'],$myval);
     //echo $myval." ".$vvalue['sum_res']['value']." ".$erate."\n";
  }
  //$response["ratebytotal"][0]['data']
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $myval = $vvalue['uncorrSysCPU']['value'] * $vvalue['sum_res']['value'] / ((1048576.*$vvalue['sum_fudatain']['value'])/$esize);
  //  echo $myval." ".$vvalue['sum_res']['value']." ".((1000000*$vvalue['sum_fudatain']['value'])/$esize)."\n";
    $response['fuetime'][1]['data'][]=array($vvalue['key'],$myval);
  }
}

/*

//OLD plots (based on live run indices)

$response["series1"]=array();
$response["series2"]=array();
$response["series3"]=array();
$response["begins"]=array();
$response["ends"]=array();
$index=0;
 
  $hostname = "es-local";

  $url = 'http://'.$hostname.':9200/run'.$run.'*'.'/prc-in/_search';
  if ($minls && $maxls)
    $data='{"query":{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}},"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":200,"order":{"_term":"asc"}},"aggs":{"ls":{"terms":{"field":"ls","size":30000,"order":{"_term":"asc"}},"aggs":{"maxtime":{"max":{"field":"_timestamp"}},"mintime":{"min":{"field":"_timestamp"}},"events":{"sum":{"field":"data.out"}},"bytes":{"sum":{"field":"data.size"}}}}}}}}';
  else
    $data='{"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":200,"order":{"_term":"asc"}},"aggs":{"ls":{"terms":{"field":"ls","size":30000,"order":{"_term":"asc"}},"aggs":{"maxtime":{"max":{"field":"_timestamp"}},"mintime":{"min":{"field":"_timestamp"}},"events":{"sum":{"field":"data.out"}},"bytes":{"sum":{"field":"data.size"}}}}}}}}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  foreach($res["aggregations"]["bybu"]["buckets"] as $key=>$value){
    //if($value["key"]=='bu'){
    //  continue;
    //}
    $response["series1"][$index]=array();
    $response["series1"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series1"][$index]["data"]=array();
    //$response["series1"][$index]["color"]=("#".substr(dechex($index*24+64).dechex($index*24+64).dechex($index*24+64),-6));
    $response["series2"][$index]=array();
    $response["series2"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series2"][$index]["data"]=array();
    $response["series3"][$index]=array();
    $response["series3"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series3"][$index]["data"]=array();
    $response["begins"][$index]=array();
    $response["begins"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["begins"][$index]["data"]=array();
    $response["ends"][$index]=array();
    $response["ends"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["ends"][$index]["data"]=array();
    $previousmax=$startTime;
    $previousDuration = 0.;
    foreach($value["ls"]["buckets"] as $kkey=>$lss){
      if($previousmax==0){
	$previousmax=$lss["mintime"]["value"];
      }
      $previousmax = min($previousmax,$lss["mintime"]["value"]);
      //$previousmax = $lss["mintime"]["value"];

      $duration = ($lss["maxtime"]["value"]-$previousmax)/1000.;
      if($previousDuration > 2*23.31 && $duration<23.31){
      	$duration += ($previousDuration-23.31);
      }
      $response["series1"][$index]["data"][]=array($lss["key"],$duration);
      $response["series2"][$index]["data"][]=array($lss["key"],$lss["events"]["value"]/$duration);
      $response["series3"][$index]["data"][]=array($lss["key"],$lss["bytes"]["value"]/$duration);
      $response["begins"][$index]["data"][]=array($lss["mintime"]["value"],$lss["key"]);
      $response["ends"][$index]["data"][]=array($lss["maxtime"]["value"],$lss["key"]);
      // if($lss["events"]["value"]!=$ratebybu[substr($value['key'],strrpos($value['key'],'_')+1)][$lss["key"]]){ 
      // 	echo "PROBLEM: ".$lss["events"]["value"]." ".$ratebybu[substr($value['key'],strrpos($value['key'],'_')+1)][$lss["key"]]."\n"; 
      // }
      $previousmax = $lss["maxtime"]["value"];
      $previousDuration = $duration;
    }
    $index+=1;
  }

$index=0;
$response["series4"]=array();
  
  $hostname = "es-local";

  $url = 'http://'.$hostname.':9200/run'.$run.'*'.'/prc-in/_search';
  if ($minls && $maxls)
    $data='{"query":{"range":{"ls":{"from":'.$minls.',"to":'.$maxls.'}}},"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":200,"order":{"_term":"asc"}},"aggs":{"ls":{"date_histogram":{"field":"_timestamp","interval":"46s"},"aggs":{"events":{"sum":{"field":"data.out"}}}}}}}}';
  else
    $data='{"size":0,"aggs":{"bybu":{"terms":{"field":"appliance","size":200,"order":{"_term":"asc"}},"aggs":{"ls":{"date_histogram":{"field":"_timestamp","interval":"46s"},"aggs":{"events":{"sum":{"field":"data.out"}}}}}}}}';
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);

  foreach($res["aggregations"]["bybu"]["buckets"] as $key=>$value){
    if($value["key"]=='bu'){
      continue;
    }
    $response["series4"][$index]=array();
    $response["series4"][$index]["name"] = $value['key'];//substr($value['key'],strrpos($value['key'],'_')+1);
    $response["series4"][$index]["data"]=array();
    foreach($value["ls"]["buckets"] as $kkey=>$lss){
      $response["series4"][$index]["data"][]=array($lss["key"],$lss["events"]["value"]/46);
    }
  $index+=1;
  }
*/

curl_close($crl);

echo json_encode($response);
?>
