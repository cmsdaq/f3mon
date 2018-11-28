<?php 

$setup = $_GET["setup"];
$latency = intval($_GET["latency"]);
$intlength = intval($_GET["intlen"]);

if ($latency==null) $latency=1;
if ($intlength==null) $intlength=10;
if ($setup==null) $setup="cdaq";
$interval=1;

$maxtime=time();

header("Content-Type: application/json");
date_default_timezone_set("UTC");
$response=array();
$crl = curl_init();
$hostname = 'es-cdaq';

//unix ms
$endtime = $maxtime - $latency; 
$begintime = $endtime - $interval*$intlength;
//$endtime = date("Y-m-d\TH:i:s\Z",$endtime);
$endtime = $endtime*1000;
//$begintime = date("Y-m-d\TH:i:s\Z",$begintime);
$begintime = $begintime*1000;

$scriptinit = "_agg['cpuavg'] = []; _agg['cpuweight']=[]";

$cpu_script_2G = "cpuw = _source['activePhysCores']/mycount;".
                  "if (cpuw==16) archw=0.96;".
                  "if (cpuw==24) archw=1.13;".
                  "if (cpuw==28 || cpuw==32) archw=1.15;".
                  "if (2*_source['activePhysCores']==_source['activeHTCores']) cpuw= _source['activeHTCores']/mycount;";

$cpu_script_1G = $cpu_script_2G.
                  "else if (_source['activePhysCores']==_source['activeHTCores']) mysum=mysumu;";


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
            "archw=1d;".
	    $cpu_script_1G.
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
            "archw=1d;".
	    $cpu_script_1G.
	    "_agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	    "_agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptuncorrB = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0) {".
          "  archw=1d;".
	     $cpu_script_2G.
	  "  _agg['cpuavg'].add(archw*cpuw*mysum/mycount);".
	  "  _agg['cpuweight'].add(archw*cpuw);".
	  "}";

$scriptuncorrF = "mysum = 0d;".
          "mycount=0d;".
	  "for (i=0;i<_source['fuSysCPUFrac'].size();i++) {".
	  "  mysum+=_source['fuSysCPUFrac'][i]; mycount+=1;".
	  "};".
	  "if (mycount>0 && _source['fuDataNetIn']>100.0) {".
          "  archw=1d;".
	     $cpu_script_2G.
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
          "  archw=1d;".
	     $cpu_script_2G.
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

$data = '{"size":0,"query":{"bool":{"must":[{"range":{"fm_date":{"gt":"'.$begintime.'","lt":"'.$endtime.'"}}},{"range":{"activeFURun":{"gt":0}}}]}},"aggs":{ "corrSysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrB02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"corr2SysCPU02":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptcorrC02.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"uncorrSysCPU":{"scripted_metric":{"init_script":{"lang":"groovy","inline":"'.$scriptinit.'"},"map_script":{"lang":"groovy","inline":"'.$scriptuncorrB.'"},"reduce_script":{"lang":"groovy","inline":"'.$scriptreduce.'"}}},"lsavg":{"avg":{"field":"activeRunCMSSWMaxLS"}}  }} ';


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

$vvalue=$res['aggregations'];
$myLS = intval($vvalue['lsavg']['value']);
$tavg = ($begintime+$endtime)/2.;
$response['fusyscpu2'][0]['data'][]=array($tavg,$vvalue['uncorrSysCPU']['value'],$myLS);
$response['fusyscpu2'][1]['data'][]=array($tavg,$vvalue['corrSysCPU02']['value'], $myLS);
$response['fusyscpu2'][2]['data'][]=array($tavg,$vvalue['corr2SysCPU02']['value'],$myLS);

curl_close($crl);

echo json_encode($response);
?>
