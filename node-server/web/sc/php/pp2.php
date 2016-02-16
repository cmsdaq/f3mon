<?php
$setup = $_GET["setup"];
//$setup = "dv";
header("Content-Type: application/json");
//edit this to insert password!
if ($setup=="dv") {
  $conn = oci_connect('CMS_DAQ2_TEST_HW_CONF_R','', 'int2r2-v.cern.ch:10121/int2r_lb.cern.ch');
}
else {
  $conn = oci_connect('CMS_DAQ2_HW_CONF_R','', 'cmsonr1-v.cms:10121/cms_rcms.cern.ch');
}
if (!$conn) {
    $e = oci_error();
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}

if ($setup=="dv") {

  $stid = oci_parse($conn, "select attr_name, attr_value, d.dnsname from 
                DAQ_EQCFG_HOST_ATTRIBUTE ha,			       
                DAQ_EQCFG_HOST_NIC hn,				       
                DAQ_EQCFG_DNSNAME d				       
                where						       
                ha.eqset_id=hn.eqset_id AND			       
                hn.eqset_id=d.eqset_id AND			       
                ha.host_id = hn.host_id AND			       
                ha.attr_name like 'myBU!_%' escape '!' AND 
                hn.nic_id = d.nic_id AND			       
                d.dnsname like 'dvrubu-%'				       
                AND d.eqset_id = (select eqset_id from DAQ_EQCFG_EQSET 
                where tag='DAQ2VAL' AND			
                ctime = (SELECT MAX(CTIME) FROM DAQ_EQCFG_EQSET WHERE tag='DAQ2VAL'))");
}
else {

  $stid = oci_parse($conn, "select attr_name, attr_value, d.dnsname from 
                DAQ_EQCFG_HOST_ATTRIBUTE ha,			       
                DAQ_EQCFG_HOST_NIC hn,				       
                DAQ_EQCFG_DNSNAME d				       
                where						       
                ha.eqset_id=hn.eqset_id AND			       
                hn.eqset_id=d.eqset_id AND			       
                ha.host_id = hn.host_id AND			       
                ha.attr_name like 'myBU!_%' escape '!' AND 
                hn.nic_id = d.nic_id AND			       
                d.dnsname like 'fu-%'				       
                AND d.eqset_id = (select eqset_id from DAQ_EQCFG_EQSET 
                where tag='DAQ2' AND			
                ctime = (SELECT MAX(CTIME) FROM DAQ_EQCFG_EQSET WHERE tag='DAQ2'))");
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
$tabl=array();
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
  $bu = explode(".",$row['ATTR_VALUE']);
  $fu = explode(".",$row['DNSNAME']);
  if(!array_key_exists ( $bu[0] , $tabl )){
    $tabl[$bu[0]]=array();
  }
  if(!in_array ( $fu[0] , $tabl[$bu[0]] )){
    $tabl[$bu[0]][]=$fu[0];
  }
}

oci_close($conn);
echo json_encode($tabl);

?>
