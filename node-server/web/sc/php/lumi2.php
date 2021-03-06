<?php
include 'jsonDecode.php';
header("Content-Type: application/json");
$run=0;
$fill=0;
$run = $_GET["run"];
$fill = $_GET["fill"];
$basic=0;
if (isset($_GET["basic"])) {
 $basic=1;
}
//$basic = null;
//$basic = $_GET["basic"];
$response=array();
$dbinfo = file_get_contents("../../../dbinfo.json");
$dbjsn = json_decode($dbinfo,true);
$connp = $dbjsn["cdaq"];
$conn = oci_connect($connp[0],$connp[1],$connp[2]);
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}


if($run!=0){
  if ($basic)
    $stid = oci_parse($conn, "select STARTTIME,LHCFILL,RUNNUMBER from 
                CMS_RUNTIME_LOGGER.LUMI_SECTIONS rtl			       
                where rtl.RUNNUMBER=".$run);
  else
    $stid = oci_parse($conn, "select STARTTIME,LUMISECTION,INSTLUMI,DELIVLUMI,LIVELUMI,DEADTIME,PILEUP,LHCFILL,RUNNUMBER,BEAM1_STABLE,BEAM2_STABLE from 
                CMS_RUNTIME_LOGGER.LUMI_SECTIONS rtl			       
                where rtl.RUNNUMBER=".$run);
}else{
  if ($basic)
    $stid = oci_parse($conn, "select STARTTIME,LHCFILL,RUNNUMBER from 
                CMS_RUNTIME_LOGGER.LUMI_SECTIONS rtl			       
                where rtl.RUNNUMBER=".$run);
  else
    $stid = oci_parse($conn, "select STARTTIME,LUMISECTION,INSTLUMI,DELIVLUMI,LIVELUMI,DEADTIME,PILEUP,LHCFILL,RUNNUMBER,BEAM1_STABLE,BEAM2_STABLE from 
                CMS_RUNTIME_LOGGER.LUMI_SECTIONS rtl			       
                where rtl.LHCFILL=".$fill);
}
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

// Fetch the results of the query
$tabli=array();
$tabld=array();
$tabll=array();
$tablp=array();
$tablr=array();
$tabls=array();
$tablls=array();
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
  if($run==0){
    if (!$basic) {
      $tabli[] = array($row['STARTTIME'],floatval($row['INSTLUMI']));
      $tabld[] = array($row['STARTTIME'],floatval($row['DELIVLUMI']));
      $tabll[] = array($row['STARTTIME'],floatval($row['LIVELUMI']));
      $tablp[] = array($row['STARTTIME'],floatval($row['PILEUP']));
    }
    $tablr[] = array($row['STARTTIME'],intval($row['RUNNUMBER']));
    if (!$basic) {
      $tablls[] = array($row['STARTTIME'],intval($row['LUMISECTION']));
      $tabls[] = array($row['STARTTIME'],intval($row['BEAM1_STABLE'])*
		       intval($row['BEAM2_STABLE']));
    }
    $fill = $row['LHCFILL'];
  }
  else{
    if (!$basic) {
    $tabli[] = array(intval($row['LUMISECTION']),floatval($row['INSTLUMI']));
    $tabld[] = array(intval($row['LUMISECTION']),floatval($row['DELIVLUMI']));
    $tabll[] = array(intval($row['LUMISECTION']),floatval($row['LIVELUMI']));
    $tablp[] = array(intval($row['LUMISECTION']),floatval($row['PILEUP']));

    $tabls[] = array(intval($row['LUMISECTION']),intval($row['BEAM1_STABLE'])*
		     intval($row['BEAM2_STABLE']));
    }
    $fill = $row['LHCFILL'];

  }
}


oci_close($conn);
$response["fill"] = array("name"=>"fill","data"=>$fill);
if (!$basic) {
$response["lumi"][] = array("name"=>"instlumi","data"=>$tabli);
$response["lumi"][] = array("name"=>"pileup","data"=>$tablp);
$response["lumi1"][] = array("name"=>"instlumi","data"=>$tabli);
$response["plumi1"][] = array("name"=>"pileup","data"=>$tablp);
$response["ilumi"][] = array("name"=>"delivlumi","data"=>$tabld);
$response["ilumi"][] = array("name"=>"livelumi","data"=>$tabll);
}
$response["run"][] = array("name"=>"runnumber","data"=>$tablr); 
$response["run"][] = array("name"=>"stable","data"=>$tabls); 
echo json_encode($response);

?>
