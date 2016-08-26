<?php
header("Content-Type: application/json");
$run=0;
$fill=0;
if (defined('STDIN')) {
  $run = $argv[1];
  $ls = $argv[2];
} else { 
  $run = $_GET["run"];
  $ls = $_GET["ls"];
}
$response=array();
$dbinfo = file_get_contents("../../../dbinfo.json");
$dbjsn = json_decode($dbinfo,true);
$connp = $dbjsn["tcds"];
$conn = oci_connect($connp[0],$connp[1],$connp[2]);
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}
if($run!=0 && $ls!=0){
  $stid = oci_parse($conn, "select * from (select section_number, trg_rate_total, trg_rate_tt1, sup_trg_rate_tt1, trg_rate_tt3, sup_trg_rate_tt3 from cms_tcds_monitoring.tcds_cpm_rates_v where run_number =".$run."and section_number = ".$ls.")");
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
oci_close($conn); 
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
  echo json_encode($row);
}

?>
