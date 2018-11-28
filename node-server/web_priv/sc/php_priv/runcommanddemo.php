<?php 
include 'jsonDecode.php';
/*
$setup = "cdaq";
$cmd = "test";
$buprefix = "null";
*/
$setup = $_GET["setup"];
$cmd = $_GET["cmd"];
$buprefix = $_GET["bu"];

header("Content-Type: text/plain");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');

if ($buprefix=="null") {
 $buprefix="bu-";
 if ($setup=="dv") $buprefix="dvbu-";
}
else if ($bu=="") {echo '{"bus":["noBU"],"rcstatus":"Unknow","daqstatus":"Unknown"}';exit(1);}

$myaction="OK";
$rcstate="Unknown";
$daqstate="Unknown";
$result=array();

//$use_es=true;
$use_es=false;

$es_zone_prefix=$setup;
if ($setup=="dv") $es_zone_prefix="daqval";

//cross-check state in run control flashlist if this is CDAQ
if ($setup=="cdaq" || $setup=="dv") {
  //$url = 'http://pc-c2e11-18-01.cms:9941/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_dynamic';
  if ($use_es) {
    $url = 'http://cmsos-iaas-cdaq.cms:9200/'.$es_zone_prefix.'-levelzerofm_dynamic_*/_search';
    //$data='{ "query": { "match_all": {} }, "size": 1, "sort": [ { "creationtime_": { "order": "desc" } } ] }';
    $data='{ "query":{"bool":{"must":[{"range":{"creationtime_":{"from":"now-1m"}}}]}}, "size": 1, "sort": [ { "creationtime_": { "order": "desc" } } ] }';
  }
  else {
    $url = 'http://xaas-cdaq-04.cms:9946/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_dynamic';
  }
  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  if ($use_es)
    curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  if($ret !== false) {
    try {
      $res=jsonDecode($ret);
      if ($use_es) { 
        //echo json_encode($res["hits"]["hits"][0]["_source"]["STATE"]); 
        $rcstate=$res["hits"]["hits"][0]["_source"]["STATE"]; 
      }
      else {
        $rcstate=$res["table"]["rows"][0]["STATE"];
      }
      $mystateup=strtoupper($rcstate);
      if ($mystateup=="STARTING"
          || $mystateup=="STOPPING"
          || $mystateup=="RUNNING"
          || $mystateup=="PAUSED"
          || $mystateup=="PAUSING"
          || $mystateup=="RESUMING") {
        $myaction="notOK";
	//file_put_contents("/tmp/dump-demo-flashlist-levelZero-",$ret);
	file_put_contents("/tmp/dump-demo-flashlist-levelZero-".date("Y-m-d\TH:i:s\Z"),$ret);
      }
      
      #check second flashlist
      if ($use_es) {
        $url = 'http://cmsos-iaas-cdaq.cms:9200/'.$es_zone_prefix.'-levelzerofm_subsys_*/_search';
        $data='{ "query":{"bool":{"must":[{"term": {"SUBSYS":"DAQ"}},{"range":{"creationtime_":{"from":"now-1m"}}}]}}, "size": 1, "sort": [ { "creationtime_": { "order": "desc" } } ] }';
      }
      else {
        $url = 'http://xaas-cdaq-04.cms:9946/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_subsys';
      }
      $crl = curl_init();
      curl_setopt ($crl, CURLOPT_URL,$url);
      curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
      curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
      if ($use_es)
        curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
      $ret = curl_exec($crl);
      curl_close($crl);
      if  ($ret !== false) {
        try {
          $res=jsonDecode($ret);
          if ($use_es)
            $datahits=$res["hits"]["hits"];
          else
            $datahits = $res["table"]["rows"];
          foreach ($datahits as $row) {
            if ($use_es) {
              $rowsubsys=$row["_source"]["SUBSYS"];
              $rowstate=$row["_source"]["STATE"];
            }
            else {
              $rowsubsys=$row["SUBSYS"];
              $rowstate=$row["STATE"];
            }
            if ($rowsubsys=="DAQ") {
              $daqstate=$rowstate;
              $daqstateup=strtoupper($daqstate);
              if  ($mystateup=="STARTING"
                   || $mystateup=="STOPPING"
                   || $mystateup=="RUNNING"
                   || $mystateup=="PAUSED"
                   || $mystateup=="PAUSING"
                   || $mystateup=="RESUMING"
                   || $mystateup=="ERROR"
                   || $mystateup=="RUNNINGDEGRADED"
                   || $mystateup=="RUNBLOCKED"
                 ) {
                   $myaction="notOK";
		   //file_put_contents("/tmp/dump-demo-flashlist-subsys-",$ret);
		   file_put_contents("/tmp/dump-demo-flashlist-subsys-".date("Y-m-d\TH:i:s\Z"),$ret);
              }
              break;
            }
          }
        } catch(Exception $e){}
      }
    } catch(Exception $e){}
  }
}

$host_list = array();

if ($myaction=="OK") {
 
  $url = 'http://'.$hostname.':9200/boxinfo_'.$setup.'_read/boxinfo/_search?size=200';
  $data = '{"query":{"bool":{"must":[{"prefix":{"host":"'.$buprefix.'"}},{"range":{"fm_date":{"from":"now-60s"}}}]}},"size":200}';
  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=jsonDecode($ret);
  $max = 0;

  $crlm = curl_multi_init();
  $curl_arr = array();


  $i=0;

  foreach ($res["hits"]["hits"] as $value){


	$appliance =  $value["_source"]["host"];
	$host_list[$i]=$appliance;

	//echo $appliance."\n";
        
	$url = 'http://'.$appliance.':9000/cgi-bin/test_cgi.py';

	$data='';
	$curl_arr[$i] = curl_init();
        curl_setopt ($curl_arr[$i], CURLOPT_URL,$url);
        curl_setopt ($curl_arr[$i], CURLOPT_RETURNTRANSFER, 1);
        curl_setopt ($curl_arr[$i], CURLOPT_POSTFIELDS, $data);
	//$ret=curl_exec($crl);
	curl_multi_add_handle($crlm,$curl_arr[$i]);

	$i++;
        //echo "POST ".$url." executed\n";	
  }

  do {
	$mrc = curl_multi_exec($crlm,$running);
	$sres = curl_multi_select($crlm);
	if ($res == false) {}
  } while  ($running > 0);


}//run command condition

$result["bus"]=$host_list;
$result["action"]=$myaction;
$result["rcstatus"]=$rcstate;
$result["daqstatus"]=$daqstate;

echo json_encode($result);
?>
