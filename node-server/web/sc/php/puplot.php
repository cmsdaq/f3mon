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
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.intval($minls).',"to":'.(intval($maxls)+1).'}}}]}},"aggs":{"ls":{"terms":{"size":30000,"field":"ls"},"aggs":{"rate":{"sum":{"field":"NEvents"}},"bw":{"sum":{"field":"NBytes"}} }}}}';
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
foreach($res['aggregations']['ls']['buckets'] as $kkey=>$vvalue){
  $key=$vvalue['key'];
  $rate  = $vvalue["rate"]["value"];
  $bw = $vvalue["bw"]["value"];
  if ($bw>0. && $key>0 ) $evsize[$key]=$bw/(1.*$rate);
  $response['eolsrate'][0]['data'][]=array($key,$rate/23.31);
}

$scriptinit = "_agg['cpuavg'] = []; _agg['cpuweight']=[]";

//todo: use fuCPUName here
$scriptuncorrB = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
          "  if (cpuw==32 || cpuw==16) archw=0.96;".
          "  if (cpuw==48 || cpuw==24) archw=1.13;".
          "  if (cpuw==56 || cpuw==28) archw=1.15;".
	  "  _agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";


$scriptuncorrCPU = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
	  "  cpuName=_source['fuCPUName'];".
          "  if (cpuName=='E5-2670 0') archw=0.96;".
          "  else if (cpuName=='E5-2680 v3') archw=1.13;".
          "  else if (cpuName=='E5-2680 v4' || cpuName=='E5-2650 v4') archw=1.15;".
	  "  _agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";


$scriptinit_etime = "_agg['timeun'] = []; _agg['cpuweight']=[]";



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


$scriptreduce_etime ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.timeun) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 




$scriptreduce ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.cpuavg) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 

#old/new rack layout
if (intval($run)<297144)
$termscript = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "rack = doc['appliance'].value.substring(3,8);".
              "if (rack.startsWith('c2e4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d3') || rack.startsWith('c2d41') || rack.startsWith('c2d42')) return '`15 Megw:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2f') || rack.startsWith('c2e')) return '`12 Dell:'+doc['active_resources'].value;".
              "else return rack+':'+doc['active_resources'].value;";

else if (intval($run)<298500)
$termscript = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "rack = doc['appliance'].value.substring(3,11);".
              "if (doc['appliance'].value=='bu-c2d46-10-01') return '`16 Action(R730):'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2d31-10') || rack.startsWith('c2d32-10') || rack.startsWith('c2d33-10') ||".
	      "    rack.startsWith('c2d34-10') || rack.startsWith('c2d35-10') || rack.startsWith('c2d36-10') ||".
	      "    rack.startsWith('c2d37-10') || rack.startsWith('c2d38-10') ||".
	      "    rack.startsWith('c2d41-10') || rack.startsWith('c2d42-10'))".
	      " return '`17 Huaw:'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2f16-09') || rack.startsWith('c2f16-11') || rack.startsWith('c2f16-13') ||".
	      "    rack.startsWith('c2e18-27') || rack.startsWith('c2e18-29') || rack.startsWith('c2e18-31'))".
	      " return '`17 Huaw:'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2d3') || rack.startsWith('c2d41') || rack.startsWith('c2d42'))  return '`15 Megw:'+doc['active_resources'].value;".
              "if (rack.startsWith('c2e4') || rack.startsWith('c2d4')) return '`16 Action:'+doc['active_resources'].value;".
              "if (rack.startsWith('c2f') || rack.startsWith('c2e')) return '`12 Dell:'+doc['active_resources'].value;".
              "rack = doc['appliance'].value.substring(3,8);".
              "return rack+':'+doc['active_resources'].value;";

else {
$termscript = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "buCPU=doc['buCPUName'].value;".
	      "fuCPU=doc['fuCPUName'].value;".
              "buMap = ['E5-2670 0':'','E5-2670 v3':'(R730)'];".
              "fuMap = ['E5-2670 0':'`12 Dell','E5-2680 v3':'`15 Megw','E5-2680 v4':'`16 Action','E5-2650 v4':'`17 Huaw'];".
	      "bukey = buMap.find{ it.key == buCPU }?.value;".
	      "fukey = fuMap.find{ it.key == fuCPU }?.value;".
	      "if (!fukey) fukey=doc['fuCPUName'].value;".
	      "if (bukey || bukey=='') buCPU=bukey; else buCPU='('+buCPU+')';".
	      "return fukey+buCPU+':'+doc['active_resources'].value;";

}

//if ($minls && $maxls)
//  $filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';
//else
//$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';

$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}},{"range":{"activeRunCMSSWMaxLS":{"from":1}}},{"range":{"fuDataNetIn":{"from":0.1}}}]}}';
//$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}},{"range":{"activeRunCMSSWMaxLS":{"from":1}}}]}}';

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';
$data = '{"size":0,'.$filter1.','.
        '"aggs":{'.
          '"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},'.
	    '"aggs":{'.
	      '"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},'.
              '"eventTimeUn":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit_etime.'"},"map_script":{"lang":"groovy","inline":"'.$scriptevtime.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce_etime.'"}}},'.
	      '"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},'.
	      '"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}}     }},'.
	      '"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},'.
	      '"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}'.
	    '}'.
	  '},'.
	  '"rescat":{"terms":{"script":{"lang":"groovy","inline":"'.$termscript.'"},"size":200,"order" : { "_term":"asc"}},'.
	    '"aggs":{'.
	      '"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},'.
	        '"aggs":{'.
		  '"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}}'.
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
$response['fuesizels'][]=array();
$response['fuesizels'][0]['name']='/inst. BUFU rate';
$response['fuesizels'][0]['data']=array();
$response['fuetimelsalt'][]=array();
$response['fuetimelsalt'][]['name']='/inst. BUFU rate (2)';
$response['fuetimelsalt'][0]['data']=array();
$invmb = 1./1048576.;

foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $erate = (1048576.0*$vvalue['sum_fudatain']['value'])/$esize;

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
