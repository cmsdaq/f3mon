<?php

$timeout=10;

$url = 'http://xaas-cdaq-04.cms:9946/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_static';
//$url = 'http://ucsrv-c2e41-10-01.cms:9946/urn:xdaq-application:lid=16/retrieveCollection?fmt=json&flash=urn:xdaq-flashlist:levelZeroFM_static';
$crl = curl_init();
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
$ret = curl_exec($crl);
curl_close($crl);
$result = array();
$bus = array();
$run=-1;
if($ret !== false) {
  try {
    $res=json_decode($ret,1);
    foreach($res["table"]["rows"] as $row) {

      $run=max($row["RUN_NUMBER"],$run);
      if ($run==$row["RUN_NUMBER"])
        $hwcfgkey = $row["HWCFG_KEY"];
      $infomap=$row["PARTITION_INFO_MAP"];
      $all = explode("&",$infomap);
      foreach($all as $val) {
        if (substr($val,0,3)=="bu-") $bus[]=$val;
      }
    }
  } catch(Exception $e){
  echo $e;
  
  }
}
#$x = array();
#$x["HWCFG_KEY"]="/daq2/eq_180404/fb_all_wTOTEM586587/dp_bl655_75BU:0";

#$hwcfgkey = $x["HWCFG_KEY"];

$pos1 = strpos($hwcfgkey,"/dp_bl");
$len = 6;
if ($pos1===null) {$pos1=strpos($hwcfgkey,"_bl");$len=3;}
if ($pos1===null) {echo "ERROR";exit(0);}

$blkey=substr($hwcfgkey,$pos1+$len);
$pos2=strpos($blkey,"_");
if ($pos2!==null) $blkey=substr($blkey,0,$pos2);

//echo $blkey;

$hosts=array();

$sql_blacklist_hosts =
"SELECT DISTINCT h.hostname
   FROM Daq_Bl_Hosts            h,
        Daq_Bl_Blacklist_Hosts bh, 
        Daq_Bl_Blacklists       b,
        Daq_Bl_Host_Info       hi
  WHERE     h.Host_ID       = bh.Host_ID
        and hi.Host_ID      = bh.Host_ID
        and bh.Blacklist_id = b.Blacklist_ID
        and b.setup_id = 1
	and h.hostname like 'bu-%'
        and b.TAG = ".$blkey." ORDER BY h.hostname";

$dbinfo = file_get_contents("../../../dbinfo.json");
$dbjsn = json_decode($dbinfo,true);
$connp = $dbjsn["cdaq"];
$conn = oci_connect($connp[0],$connp[1],$connp[2]);
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}
$stid = oci_parse($conn, $sql_blacklist_hosts);
if (!$stid) {
    $e = oci_error($conn);
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}

// Perform the logic of the query
$r = oci_execute($stid);
if (!$r) {
    $e = oci_error($stid);
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}
oci_close($conn); 
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
//echo json_encode($row)."\n";

$hosts[$row["HOSTNAME"]]=true;
$result["blacklist"]=$hosts;
}
//print_r($hosts);


$bus2=array();
foreach($bus as $bu) {
  if (strpos($bu,".cms")!==null)
  //if (array_key_exists($bu,$hosts)) {echo "exists".$bu."\n";}
  if (array_key_exists($bu,$hosts)) {}
  else $bus2[]=$bu;
}

$result[(int)$run]=$bus2;
//echo json_encode($result);
//echo "\n";
//$result[(int)$run]=$bus;
echo json_encode($result);


?>
