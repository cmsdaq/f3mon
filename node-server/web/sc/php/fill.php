<?php
include 'jsonDecode.php';
header("Content-Type: application/json");
$fill=0;
$fill="5102";
//$fill = $_GET["fill"];
if ($fill==0) {
  echo "{}";
  exit(0);
}
$response=array();
$dbinfo = file_get_contents("../../../dbinfo.json");
$dbjsn = json_decode($dbinfo,true);
$connp = $dbjsn["cdaq"];
$conn = oci_connect($connp[0],$connp[1],$connp[2]);
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}
$stid = oci_parse($conn, "select RUNNUMBER from CMS_RUNTIME_LOGGER.LUMI_SECTIONS rtl where rtl.LHCFILL=".$fill);
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
$runtbl = array();
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
    //echo json_encode($row)."\n";
    $runtbl[$row['RUNNUMBER']]=true;
}


oci_close($conn);
$response["run"][] = array("name"=>"runnumber","data"=>array_keys($runtbl)); 
if (!empty($runtbl))
  echo json_encode($runtbl);
else echo "{}";
//echo json_encode($response);

?>
