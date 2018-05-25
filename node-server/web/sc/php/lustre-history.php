<?php 

include 'jsonDecode.php';
header("Content-Type: application/json");

date_default_timezone_set("UTC");

if (isset($_GET['setup'])) $setup = $_GET["setup"]; else $setup = "cdaq";
if (isset($_GET['runs'])) $runstr = $_GET["runs"]; else $runstr = null;
if (isset($_GET['from'])) $from = $_GET["from"]; else $from = null;
if (isset($_GET['to'])) $to = $_GET["to"]; else $to = null;
if (isset($_GET['getbandwidth'])) $getbandwidth = $_GET["getbandwidth"]; else $getbandwidth = null;

//seconds
$intervalint = 1800.;
$intervalint2 = 120.;

//$from="2018-05-24T10:00:00.000Z";
//$to="2018-05-25T11:00:00.000Z";
//$v = strtotime("2018-05-22T10:42:16.000Z") - strtotime("2018-05-22T09:42:16.000Z");
//if (($v / $intervalint) > 3000) $intervalint = $v/3000;

$fromto=false;

$maxbins = 1000.;
$maxbins2 = 200.;

if ($runstr==null || $runstr=="") {
  $fromto=true;
  $v = strtotime($to) - strtotime($from);
  //cap number of bins
  if (($v / $intervalint) > $maxbins) $intervalint = $v/$maxbins;
  if (($v / $intervalint2) > $maxbins2) $intervalint2 = $v/$maxbins2;
}

$intervalint = intval($intervalint);
$intervalint2 = intval($intervalint2);

$hostname = 'es-cdaq';

$runs = array_map('intval',explode(",",$runstr));

$run_min=min($runs);
$run_max=max($runs);

$reply=array();

$crl = curl_init();

if (!$fromto) {

  //TODO: this is single-index operation,
  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search';
  $data = '{"query":{"term":{"runNumber":'.$run_min.'}}}';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  $start = $res["hits"]["hits"][0]["_source"]["startTime"];

  $url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search';
  $data = '{"query":{"term":{"runNumber":'.$run_max.'}}}';
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  $res = json_decode($ret,true);
  if (array_key_exists("_source",$res["hits"]["hits"][0])) {
    if (array_key_exists("endTime",$res["hits"]["hits"][0]["_source"]))
      $end = $res["hits"]["hits"][0]["_source"]["endTime"];
    else $end="now";
  }

}
else {
  $start = $from;
  $end = $to;
}

$url = 'http://'.$hostname.':9200/lustre_info/occupancy/_search';

#$data = '{"size":9999,"query":{"range":{"occupancy_time":{"from":"'.$start.'","to":"'.$end.'"}}},"sort":{"occupancy_time":"asc"}}';
$data = '{"size":1,"query":{"range":{"occupancy_time":{"from":"'.$start.'","to":"'.$end.'"}}},'.
         '"aggs":{"int":{"date_histogram":{"field":"occupancy_time","interval":"'.$intervalint.'s"},"aggs":{"av":{"avg":{"field":"occupancy_perc"}}}}}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$status= curl_getinfo($crl,CURLINFO_HTTP_CODE );

$reply['occupancies']=array();
$reply['occupancies'][0]=array();
$reply['occupancies'][0]['name']="Lustre occupancy";
$reply['occupancies'][0]['data']=array();

$res = json_decode($ret,true);
$occArray = array();
/*
forEach($res['hits']['hits'] as $key=>$hit) {
  //$occArray []= array($hit["_source"]["occupancy_perc"],$hit["_source"]["occupancy_time"]);
  $occArray []= array($hit["sort"][0],$hit["_source"]["occupancy_perc"]);
}
*/
forEach($res['aggregations']['int']['buckets'] as $v) {
  if ($v['av']['value']!==null)
    $occArray []= array($v['key'],$v['av']['value']);

}
$reply['occupancies'][0]['data']=$occArray;


if ($getbandwidth) {

$url = 'http://'.$hostname.':9200/lustre_info/bandwidth/_mapping';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
$ret = curl_exec($crl);
$res = json_decode($ret,true);

$ost_names = array();

foreach($res as $key=>$val) {
  foreach($val["mappings"]["bandwidth"]["properties"] as $pkey=>$pval) {
    if (strpos($pkey,"OST")===0) {
     $ost_names[]=$pkey;
    }
  }
}

$url = 'http://'.$hostname.':9200/lustre_info/bandwidth/_search?pretty';

$data = '{"size":0,"query":{"range":{"bandwidth_time":{"from":"'.$start.'","to":"'.$end.'"}}},'.
         '"aggs":{"int":{"date_histogram":{"field":"bandwidth_time","interval":"'.$intervalint2.'s"},'.
         '"aggs":{"oss":{"terms":{"field":"host","size":100},'.
	 '"aggs":{'.
	 '"readTotal":{"avg":{"field":"readTotalMB/s"}},'.
	 '"writeTotal":{"avg":{"field":"writeTotalMB/s"}}';
foreach($ost_names as $key) {
  $data=$data.',"'.substr($key,0,8).'":{"avg":{"field":"'.$key.'"}}';
}
$data = $data.'}}}}}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);

$ret = curl_exec($crl);
$res = json_decode($ret,true);

$name_map_tw = array();
$name_map_tr = array();
$name_map_aw = array();
$name_map_ar = array();
$allbw = array();

foreach($res["aggregations"]["int"]["buckets"] as $key) {
  $timestamp = $key['key'];
  $alltotalw = 0.;
  $alltotalr = 0.;
  foreach($key["oss"]["buckets"] as $kkey) {
    $oss=$kkey["key"];
    foreach($kkey as $kkkey=>$vvval) {
      $hkey = $oss."_".$kkkey;
      $hval=null;
      if (is_array($vvval)) {
        if ($vvval["value"]===null) {}
        elseif (strpos($kkkey,"OST")===0) {
	  $hval = floatval($vvval["value"]);

          if (strlen($kkkey) && $kkkey[strlen($kkkey)-1]=="w") $write=true;
	  else $write=false;

	  if ($write) {
	    if (strlen($hkey))
	      $hkey = substr($hkey,0,strlen($hkey)-1);
            if (array_key_exists($hkey,$name_map_aw)) {}
            else $name_map_aw[$hkey]= array();
            $name_map_aw[$hkey][]=[$timestamp,$hval];
	  }
	  else {
	    if (strlen($hkey))
	      $hkey = substr($hkey,0,strlen($hkey)-1);
            if (array_key_exists($hkey,$name_map_ar)) {}
            else $name_map_ar[$hkey]= array();
            $name_map_ar[$hkey][]=[$timestamp,$hval];
	  }
        }
        elseif ($kkkey=="readTotal") {
	  $hval = floatval($vvval["value"]);
	  $alltotalr+=$hval;
          if (array_key_exists($hkey,$name_map_tr)) {}
          else $name_map_tr[$hkey]= array();
          $name_map_tr[$hkey][]=[$timestamp,$hval];

        }
       elseif ($kkkey=="writeTotal") {
 	  $hval = floatval($vvval["value"]);
	  $alltotalw+=$hval;
          if (array_key_exists($hkey,$name_map_tw)) {}
          else $name_map_tw[$hkey]= array();
          $name_map_tw[$hkey][]=[$timestamp,$hval];

        }
        if ($hval!==null) {
          if (array_key_exists($hkey,$name_map)) {}
          else $name_map[$hkey]= array();
          $name_map[$hkey][]=[$timestamp,$hval];
	}
      }
    }
  }
  $hkey = "Lustre_write";
  if (array_key_exists($hkey,$allbw)) {}
  else $allbw[$hkey]= array();
  $allbw[$hkey][]=[$timestamp,$alltotalw];

  $hkey = "Lustre_read";
  if (array_key_exists($hkey,$allbw)) {}
  else $allbw[$hkey]= array();
  $allbw[$hkey][]=[$timestamp,$alltotalr];
}

$reply["allbw"]=array();
foreach ($allbw as $k=>$v) {
  $obj = array();
  $obj["name"]=$k;
  $obj["data"]=$v;
  $reply["allbw"][]= $obj;
}

$reply["bandwidth_tw"]=array();
foreach ($name_map_tw as $k=>$v) {
  $obj = array();
  $obj["name"]=$k;
  $obj["data"]=$v;
  $reply["bandwidth_tw"][]= $obj;
}

$reply["bandwidth_tr"]=array();
foreach ($name_map_tr as $k=>$v) {
  $obj = array();
  $obj["name"]=$k;
  $obj["data"]=$v;
  $reply["bandwidth_tr"][]= $obj;
}

$reply["bandwidth_aw"]=array();
foreach ($name_map_aw as $k=>$v) {
  $obj = array();
  $obj["name"]=$k;
  $obj["data"]=$v;
  $reply["bandwidth_aw"][]= $obj;
}

$reply["bandwidth_ar"]=array();
foreach ($name_map_ar as $k=>$v) {
  $obj = array();
  $obj["name"]=$k;
  $obj["data"]=$v;
  $reply["bandwidth_ar"][]= $obj;
}

}

curl_close($crl);
echo json_encode($reply);

?>
