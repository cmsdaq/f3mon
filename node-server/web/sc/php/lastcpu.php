<?php 

/**/
$setup = $_GET["setup"];
$maxtime = $_GET["maxtime"];
$interval = intval($_GET["int"]);
$intlength = intval($_GET["intlen"]);
/**/

/*
$setup = 'cdaq';
$maxtime = time();
$interval = 3;
$intlength = 30;
*/

header("Content-Type: application/json");
date_default_timezone_set("UTC");
$response=array();
$crl = curl_init();
$hostname = 'es-cdaq';

//unix ms
$endtime = $maxtime - $maxtime % $interval;//30s rounding
$begintime = $endtime - $interval*$intlength;
//$endtime = date("Y-m-d\TH:i:s\Z",$endtime);
$endtime = $endtime*1000;
//$begintime = date("Y-m-d\TH:i:s\Z",$begintime);
$begintime = $begintime*1000;

//echo "\n".$begintime ." ". $endtime."\n";
$intlength = $intlength."s";

$scriptinit = "_agg['cpuavg'] = []; _agg['cpuweight']=[]";

//B: corrections from TSG (single-thread power vs. Ivy bridge
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

//B: corrections from TSG (single-thread power vs. Ivy bridge) and 2x-x*x correction
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

$data = '{"size":0,"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$begintime.'","lt":"'.$endtime.'"}}},{"range":{"activeFURun":{"gt":0}}}]}},"aggs":{"ovr2":{"date_histogram":{"field":"fm_date","interval":"'.$intlength.'"},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":"'.$scriptinit.'","map_script":"'.$scriptcorrB02.'","reduce_script":"'.$scriptreduce.'"}},"corr2SysCPU02":{"scripted_metric":{"init_script":"'.$scriptinit.'","map_script":"'.$scriptcorrC02.'","reduce_script":"'.$scriptreduce.'"}},"uncorrSysCPU":{"scripted_metric":{"init_script":"'.$scriptinit.'","map_script":"'.$scriptuncorrB.'","reduce_script":"'.$scriptreduce.'"}},"timeMetric":{"scripted_metric":{"init_script":"'.$scriptinit.'","map_script":"'.$scriptuncorrF.'","reduce_script":"'.$scriptreduce.'"}},"eventTimeUn":{"scripted_metric":{"init_script":"'.$scriptinit.'","map_script":"'.$scriptevtimeC.'","reduce_script":"'.$scriptreduce.'"}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}}  }} }}';

curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);


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
  $response['fusyscpu2'][0]['data'][]=array($vvalue['key'],$vvalue['uncorrSysCPU']['value'], $myLS);
  $response['fusyscpu2'][1]['data'][]=array($vvalue['key'],$vvalue['corrSysCPU02']['value'], $myLS);
  $response['fusyscpu2'][2]['data'][]=array($vvalue['key'],$vvalue['corr2SysCPU02']['value'],$myLS);
}

curl_close($crl);

echo json_encode($response);
?>
