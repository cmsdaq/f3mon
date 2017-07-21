<?php 
$run = $_GET["run"];
$setup = $_GET["setup"];
//if ($setup=="cdaq") $setup="cdaq*";
$minls=null;
$minls = $_GET["minls"];
$maxls=null;
$maxls = $_GET["maxls"];

$multirun =intval($_GET["multirun"]);
$perls = 0;
$perls =intval($_GET["perls"]);
$int = 0;
$interval = intval($_GET["int"]);
//$minsb=0;
$minsb = $_GET["minsb"]!=null ? intval($_GET["minsb"]):0;
$maxsb = $_GET["maxsb"]!=null ? intval($_GET["maxsb"]):0;

//$run="298753";
//$setup="cdaq";

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
}

//time format conversion, calculate aggregation interval
$span = strtotime($end)-strtotime($start);
if ($span==0)
  $span = ($end-$start)*0.001;

if ($interval==0)
  $interval = strval(max(floor($span/50),20)).'s';//5? 
else $interval = $interval.'s';

$usec = substr($start,strpos($start,".")+1);
date_default_timezone_set("UTC");
$startTime = strtotime($start)*1000 + round($usec/1000.);
$response["runinfo"]=array('run'=>$run,'start'=>$start,'end'=>$end, 'duration'=>$span, 'interval'=>$interval, 'ongoing'=>$ongoing);

//fetch EoLS documents (using scroll) to get per-LS event size, total L1 rate and LS timestamps
//per-BU aggregation is no longer needed (fu data in is now used to get avg. l1 rate per BU). query could probably be fetched using aggregation
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
$bwbybu=array();
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
  //$response["ratebytotal2"][$ls]=$rate/23.31;
}


//scripted metrics

$scriptinit = "_agg['cpuavg'] = []; _agg['cpuweight']=[]";

//CPU usage with correction
//B: corrections from TSG (single-thread power vs. Ivy bridge) using 'kink' function (20% HT efficiency assumed)
$scriptcorrB02 = " mysum = 0d;mysumu=0d;mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	    "uncorr = _source['fuSysCPUFrac'][i];".
	    "corr=0d;".
	    "if (uncorr<0.5) {".
	      "corr = uncorr * 1.6666666;".
	    "} else {".
	      "corr = (0.5+0.2*(uncorr-0.5))*1.6666666;".
	    "};".
	    "mysum+=corr; mycount+=1;".
	    "mysumu+=uncorr;".
	  "};".
	  "if (mycount>0) {".
            "cpuw = _source['active_resources']/mycount;".
            "archw=1d;".
            "if (cpuw==32 || cpuw==16) archw=0.96;".
            "if (cpuw==48 || cpuw==24) archw=1.13;".
            "if (cpuw==56 || cpuw==28) archw=1.15;".
            "if (cpuw<30) mysum=mysumu;".
	    "_agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	    "_agg['cpuweight'].add(archw*cpuw);".
	  "}";

//CPU usage with correction
//B: corrections from TSG (single-thread power vs. Ivy bridge) and 2x-x*x function used (~20% HT efficiency but turn-on effect is better paramretrized)
$scriptcorrC02 = " mysum = 0d;mysumu=0d;mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	    "uncorr = _source['fuSysCPUFrac'][i];".
	    "corr=2*uncorr-uncorr*uncorr;".
	    "mysum+=corr; mycount+=1;".
	    "mysumu+=uncorr;".
	  "};".
	  "if (mycount>0) {".
            "cpuw = _source['active_resources']/mycount;".
            "archw=1d;".
            "if (cpuw==32 || cpuw==16) archw=0.96;".
            "if (cpuw==48 || cpuw==24) archw=1.13;".
            "if (cpuw==56 || cpuw==28) archw=1.15;".
            "if (cpuw<30) mysum=mysumu;".
	    "_agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	    "_agg['cpuweight'].add(archw*cpuw);".
	  "}";

//uncorrected CPU usage
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

//alternative method CPU usage (takes into account differences on BU-by-BU basis, other method groups per scripted terms (BU/FU type x number of unblacklisted resources)
//both methods use fu data network input to estimate CPU usage. This is ok because other BU->FUs traffic is <20 MB/s (i.e. <1 effect% at full bandwidth)
//this could however also be based on event b/w information that would be collected by input sources (but is not there at the moment).
$scriptuncorrF = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0 && _source['fuDataNetIn']>100.0) {".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
          "  if (cpuw==32 || cpuw==16) archw=0.96;".
          "  if (cpuw==48 || cpuw==24) archw=1.13;".
          "  if (cpuw==56 || cpuw==28) archw=1.15;".
	  "  _agg['cpuavg'].add(_source['active_resources']*archw*cpuw*mysum/(mycount*1048576.0*_source['fuDataNetIn']));".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";


//event time with per-CPU weights (to be used in average). later normalized with event size from EoLS.
$scriptevtimeC = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0 && _source['fuDataNetIn']>100.0) {".
          "  mytimeoversize=_source['active_resources']*mysum/(1.0*_source['fuDataNetIn']);".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
          "  if (cpuw==32) archw=0.96;".
          "  if (cpuw==48) archw=1.13;".
          "  if (cpuw==56) archw=1.15;".
	  "  _agg['cpuavg'].add(archw*cpuw*mytimeoversize/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

//event time without per-CPU weights (to be plotted for each category). later normalized with event size from EoLS.
$scriptevtimeD = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0 && _source['fuDataNetIn']>100.0) {".
          "  mytimeoversize=_source['active_resources']*mysum/(1.0*_source['fuDataNetIn']);".
          "  cpuw = _source['active_resources']/mycount;".
          "  archw=1d;".
	  "  _agg['cpuavg'].add(archw*cpuw*mytimeoversize/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptreduce ="fsum = 0d; fweights=0d; for (agg in _aggs) {if (agg) for (a in agg.cpuavg) fsum+=a; if (agg) for (a in agg.cpuweight) fweights+=a;}; if (fweights>0d) {return fsum/fweights;} else {return 0d;}"; 

$url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/resource_summary/_search';

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
//categories shown in per appliance type plots (latest version after bu/fuCPUName fields have been added)
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

//per scripted terms variables
$aggres = '"rescat":{"terms":{"script":{"lang":"groovy","inline":"'.$termscript.'"},"size":200,"order" : { "_term":"asc"}},"aggs":{"ovr":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},"eventTimeUn":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptevtimeD.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"corr2SysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrC02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"fudatain":{"avg":{"field":"fuDataNetIn"}},"avg":{"avg":{"field":"ramdisk_occupancy"}},"avgbw":{"avg":{"field":"outputBandwidthMB"}},"fusyscpu":{"avg":{"field":"fuSysCPUFrac"}},"fusysfreq":{"avg":{"field":"fuSysCPUMHz"}}   }}}}';

//everything, including aggs not separated per scripted terms
$data = '{"sort":{"fm_date":"asc"},"size":0,"query":{"bool":{"must":{"range":{"fm_date":{"gt":"'.$start.'","lt":"'.$end.'"}}},"must":{"term":{"activeFURun":'.$run.'}}}},"aggs":{'.$aggres.', "ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$interval.'"},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"corr2SysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrC02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"timeMetric":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrF.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"eventTimeUn":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptevtimeC.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}},"appliance":{"terms":{"field":"appliance","size":200},"aggs":{"fudatain":{"avg":{"field":"fuDataNetIn"}},  "res":{"avg":{"field":"active_resources"}} }},"sum_fudatain":{"sum_bucket":{"buckets_path": "appliance>fudatain"}},"sum_res":{"sum_bucket":{"buckets_path": "appliance>res"}}   }} }}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
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

$invmb = 1./1048576.;
foreach($res['aggregations']['ovr2']['buckets'] as $kkey=>$vvalue){
  $myLS = intval($vvalue['lsavg']['value']);
  if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue; 
  if (array_key_exists($myLS,$evsize)) {
    $esize = $evsize[$myLS];
    $erate = (1048576.*$vvalue['sum_fudatain']['value'])/$esize;
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
      $response['bwcompare'][0]['data'][]=array($myLS,$vvalue['sum_fudatain']['value']/(1.0*$bwtot));
      //echo $myLS." ".$vvalue['sum_fudatain']['value']." : ".$bwtot."\n";
    }
  }
}

$response['fuetimelsres'] = array();
$response['fucpures'] = array();
$response['fucpures2'] = array();
$key=0;
foreach($res['aggregations']['rescat']['buckets'] as $keyN=>$value){
  if (count($value['ovr']['buckets'])==1 && $value['ovr']['buckets'][0]['lsavg']['value']==-1) continue;
  $response['fuetimelsres'][$key]=array();
  $response['fuetimelsres'][$key]['name']=$value['key'];
  $response['fuetimelsres'][$key]['data']=array();
  $key1=$key;
  $key2=$key;
  $response['fucpures'][$key1] = array();
  $response['fucpures2'][$key2] = array();
  $response['fucpures'][$key1]['name']=$value['key']."";
  $response['fucpures2'][$key2]['name']=$value['key']."";
  $response['fucpures'][$key1]['data']=array();
  $response['fucpures2'][$key2]['data']=array();
  foreach($value['ovr']['buckets'] as $kkey=>$vvalue){
    $myLS = intval($vvalue['lsavg']['value']);
    if ($minsb && ($myLS<$minsb || $myLS>$maxsb)) continue;
    $esize = $evsize[$myLS];
    $etime = $vvalue['eventTimeUn']['value']*$esize*$invmb;
    $response['fuetimelsresls'][$key]['data'][]=array($myLS,$etime);
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
