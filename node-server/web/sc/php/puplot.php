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
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}},{"range":{"ls":{"from":'.intval($minls).',"to":'.(intval($maxls)+1).'}}}]}},aggs:{ls:{terms:{size:30000,field:"ls"},aggs:{rate:{sum:{field:"NEvents"}},bw:{sum:{field:"NBytes"}} }}}}';
else
  $data =  '{"size":0,"query":{"bool":{"must":[{"parent_id":{"type":"eols","id":"'.$run.'"}}]}},aggs:{ls:{terms:{size:30000,field:"ls"},aggs:{rate:{sum:{field:"NEvents"}},bw:{sum:{field:"NBytes"}} }}}}';


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
            "cpuw = _source['active_resources']/mycount;".
            "archw=1d;".
            "if (cpuw==32 || cpuw==16) archw=0.96;".
            "if (cpuw==48 || cpuw==24) archw=1.13;".
            "if (cpuw==56 || cpuw==28) archw=1.15;".
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
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
          "  if (cpuw==32 || cpuw==16) archw=0.96;".
          "  if (cpuw==48 || cpuw==24) archw=1.13;".
          "  if (cpuw==56 || cpuw==28) archw=1.15;".
	  "  _agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptreduce ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.cpuavg) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 

$termscript = "rack = doc['appliance'].value.substring(3,8);".
              "if (rack.startsWith('c2e4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d3') || rack.startsWith('c2d41') || rack.startsWith('c2d42')) return '`15 Megw:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2f') || rack.startsWith('c2e')) return '`12 Dell:'+doc['active_resources'].value;".
              "else return rack+':'+doc['active_resources'].value;";

//if ($minls && $maxls)
//  $filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';
//else
$filter1 = '"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},{"term":{"activeFURun":'.$run.'}}]}}';

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';
$data = '{"size":0,'.$filter1.',"aggs":{"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}}     }},"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}   }},"rescat":{"terms":{"script":{"lang":"groovy","inline":"'.$termscript.'"},"size":200,"order" : { "_term":"asc"}},"aggs":{ "ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}}     }},"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}   }}  }}    }}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);

$response['fuetimels'][]=array();
$response['fuetimels'][]['name']='/inst. BUFU rate';
$response['fuetimels'][0]['data']=array();
$response['fuesizels'][]=array();
$response['fuesizels'][]['name']='/inst. BUFU rate';
$response['fuesizels'][0]['data']=array();

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
    $response['fuesizels'][0]['data'][]=array($myLS,$esize);
  }
}

$response['fuetimels2'][]=array();
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
