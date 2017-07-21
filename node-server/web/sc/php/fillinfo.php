<?php
include 'jsonDecode.php';
header("Content-Type: application/json");

$fill=null;
if (isset($_GET["fill"])) {
//$fill=5887;//test
$fill = $_GET["fill"];
}
$getfills=null;
if (isset($_GET["getfills"])) {
$getfills=1;
}

//test
//$getfills=1;

$response=array();
$dbinfo = file_get_contents("../../../dbinfo.json");
$dbjsn = json_decode($dbinfo,true);
$connp = $dbjsn["cdaq"];
$conn = oci_connect($connp[0],$connp[1],$connp[2]);
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}

if ($getfills) {

    //filtering: require LHC energy of >500 GeV (i.e. ramp) and a run 

    $stid = oci_parse($conn, "SELECT * FROM (select LHCFILL from 
                CMS_RUNTIME_LOGGER.RUNTIME_SUMMARY rts
                WHERE LHCFILL>0 AND EXISTS (select 1 FROM CMS_WBM.RUNSUMMARY rs where rs.LHCFILL=rts.LHCFILL AND LHCENERGY>500) ORDER BY LHCFILL DESC) WHERE ROWNUM<=30");

#    $stid = oci_parse($conn, "select LHCFILL from 
#                CMS_RUNTIME_LOGGER.RUNTIME_SUMMARY rts
#                WHERE LHCFILL>0 AND ROWNUM<=30 AND EXISTS (select 1 FROM CMS_WBM.RUNSUMMARY rs where rs.LHCFILL=rts.LHCFILL AND LHCENERGY>500) ORDER BY LHCFILL DESC");
#                //WHERE LHCFILL>0 AND ROWNUM<=30 AND EXISTS (select 1 FROM CMS_WBM.RUNSUMMARY rs where rs.LHCFILL=rts.LHCFILL) ORDER BY LHCFILL DESC");
}
else {
  if (!$fill)
    $stid = oci_parse($conn, "select RUNNUMBER,LHCFILL,STARTTIME from 
                CMS_WBM.RUNSUMMARY rs
                where rs.STARTTIME = (SELECT MAX(STARTTIME) FROM CMS_WBM.RUNSUMMARY) ORDER BY rs.RUNNUMBER");
  else
    $stid = oci_parse($conn, "select RUNNUMBER,LHCFILL,STARTTIME from 
                CMS_WBM.RUNSUMMARY rs
                where rs.LHCFILL=".$fill." AND rs.LHCENERGY>=500 ORDER BY rs.RUNNUMBER");
}
// Perform the logic of the query
$r = oci_execute($stid);
if (!$r) {
    $e = oci_error($stid);
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}


// Fetch the results of the query
if ($getfills) {
  $fills=array();
  while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
    $fills[]=intval($row['LHCFILL']);
  }
  $ret = array();
  $ret["fills"]=$fills;
}
else {
  $runs=array();
  while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
    $runs[]=intval($row['RUNNUMBER']);
    $st=$row['STARTTIME'];
  }
  $ret["runs"]=$runs;
  $ret["lasttime"]=$st;

}
oci_close($conn);
echo json_encode($ret);

?>
