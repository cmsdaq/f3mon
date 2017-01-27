<?php
include 'bucketData.php';
header("Content-Type: application/json");
$run=0;
$fill=0;
$run = $_GET["run"];
$setup = $_GET["setup"];
$stream = $_GET["stream"];
$xaxis = $_GET["xaxis"];
$formatchart = $_GET["chart"];
$formatstrip = $_GET["strip"];
$formatbinary=$_GET["binary"];

$series1 = new dataSeries("copytime");
$series2 = new dataSeries("bw");
$h1;
$h2;


$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
$res=json_decode($ret,true);
$retval = array();
$retval["started"]=$res["hits"]["hits"][0]["_source"]["startTime"];
if(array_key_exists("endTime",$res["hits"]["hits"][0]["_source"])){
  $retval["ended"]=$res["hits"]["hits"][0]["_source"]["endTime"];
}
else{
  $retval["ended"]="";
}
$retval["number"]=$res["hits"]["hits"][0]["_source"]["runNumber"];
//$retval["number"]=235477;

if($run==0){ $run = $retval["number"]; }

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
  $query = "
select LUMISECTION,STREAM,
CTIME as CREATIME,  
inj.ITIME as INJTIME, 
inj.FILESIZE as FILESIZE, 
new.ITIME as NEWTIME, 
cop.ITIME as COPYTIME, 
chk.ITIME as CHKTIME, 
ins.ITIME as INSTIME, 
rep.ITIME as REPACKTIME, 
del.DTIME as DELTIME  
FROM CMS_STOMGR.FILES_CREATED files			
LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_INSERTED ins using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_NEW new using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_COPIED cop using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_REPACKED rep using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_CHECKED chk using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_DELETED del using (FILENAME)
LEFT OUTER JOIN CMS_STOMGR.FILES_INJECTED inj using (FILENAME)
where files.RUNNUMBER=".$run;
  if($stream){
    $query = $query." AND STREAM like '%".$stream."%'";
  }
  $query = $query."ORDER BY STREAM ASC, LUMISECTION ASC";


  $stid = oci_parse($conn, $query);
}
if (!$stid) {
    $e = oci_error($conn);
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}


/* oci_execute($stid, OCI_DESCRIBE_ONLY); // Use OCI_DESCRIBE_ONLY if not fetching rows */



/* $ncols = oci_num_fields($stid); */

/* for ($i = 1; $i <= $ncols; $i++) { */
/*   $column_name  = oci_field_name($stid, $i); */
/*   $column_type  = oci_field_type($stid, $i); */

/*   echo "<th>".$column_name."/"; */
/*   echo $column_type."</th>"; */
/*   echo "\n"; */
/* } */

// Perform the logic of the query
$r = oci_execute($stid);
if (!$r) {
    $e = oci_error($stid);
    trigger_error(htmlentities($e['message'], ENT_QUOTES), E_USER_ERROR);
}

// Fetch the results of the query


$result = array();
while ($row = oci_fetch_array($stid, OCI_ASSOC+OCI_RETURN_NULLS)) {
  //  echo json_encode($row);
  array_push($result,$row);
}
oci_close($conn); // we can close so we free the cursor now 
$retval = array();
$transtimes = array();
$bandwidth = array();
$streams = array();
$status = array();
$totals = array();
/* INJTIME, new.ITIME as NEWTIME, cop.ITIME as COPYTIME, chk.ITIME as CHKTIME, ins.ITIME as INS\ */
/*   TIME, rep.ITIME as REPACKTIME, del.DTIME as DELTIME */
try{
if($formatchart){

  foreach(array_keys($result) as $i){
    if($result[$i]["COPYTIME"]==null || $result[$i]["INJTIME"]==null){
      continue;
    }

    $cpt=DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["COPYTIME"])->format('U');
    $injt=DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["INJTIME"])->format('U');
    $copytime = $cpt-$injt;
    $bwtime = $copytime;
    $copybw = $result[$i]["FILESIZE"]/$bwtime/1024/1024;
    /* echo $result[$i]["STREAM"]."\n"; */
    /* echo $i." ".$copybw."\n"; */

    if(!in_array($result[$i]["STREAM"],$streams))
      {
	$streams[] = $result[$i]["STREAM"];
	$transtimes[]=array("name"=>$result[$i]["STREAM"],"data"=>array());
	$bandwidth[]=array("name"=>$result[$i]["STREAM"],"data"=>array());
	$h1 = new histogram1D("cpt".$result[$i]["STREAM"],20,0.,200.,200.);
	$h2 = new histogram1D("cpbw".$result[$i]["STREAM"],20,0.,100.,100.);
	$series1->addHistogram($h1);
	$series2->addHistogram($h2);
      }

    $h1->fill($copytime);
    $h2->fill($copybw);
    if($xaxis!="size"){
      $transtimes[count($transtimes)-1]["data"][] = array(intval($result[$i]["LUMISECTION"]),$copytime);
      $bandwidth[count($transtimes)-1]["data"][] = array(intval($result[$i]["LUMISECTION"]),$copybw);
      if(count($totals)<intval($result[$i]["LUMISECTION"])|| $totals[intval($result[$i]["LUMISECTION"])]==0){
	$totals[intval($result[$i]["LUMISECTION"])]=$copybw;
      }else{
	$totals[intval($result[$i]["LUMISECTION"])]+=$copybw;
      }
    }else{
      $transtimes[count($transtimes)-1]["data"][] = array(intval($result[$i]["FILESIZE"]),$copytime);
      $bandwidth[count($transtimes)-1]["data"][] = array(intval($result[$i]["FILESIZE"]),$copybw);
    }

  }

  if($xaxis!="size"){
    ksort($totals);

    $bandwidth[]=array("name"=>"total","data"=>array());
    foreach($totals as $ls=>$bw){
      $bandwidth[count($bandwidth)-1]["data"][]=array($ls,$bw);
    }
  }

  $retval["params"] = array("xaxis"=>$xaxis);
  $retval["serie1"] = $transtimes;
  $retval["serie2"] = $bandwidth;
}
else if(!$formatstrip){
  foreach(array_keys($result) as $i){

    $creatime = DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["CREATIME"])->format('U');
    if($result[$i]["INJTIME"]!=null){
      $result[$i]["INJTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["INJTIME"])->format('U')-$creatime;
    }
    if($result[$i]["NEWTIME"]!=null){
      $result[$i]["NEWTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["NEWTIME"])->format('U')-$creatime;
    }
    if($result[$i]["COPYTIME"]!=null){
      $result[$i]["COPYTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["COPYTIME"])->format('U')-$creatime;
    }
    if($result[$i]["CHKTIME"]!=null){
      $result[$i]["CHKTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["CHKTIME"])->format('U')-$creatime;
    }
    if($result[$i]["INSTIME"]!=null){
      $result[$i]["INSTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["INSTIME"])->format('U')-$creatime;
    }
    if($result[$i]["REPACKTIME"]!=null){
      $result[$i]["REPACKTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["REPACKTIME"])->format('U')-$creatime;
    }
    if($result[$i]["DELTIME"]!=null){
      $result[$i]["DELTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["DELTIME"])->format('U')-$creatime;
    }

    $result[$i]["COPYBW"]= $result[$i]["COPYTIME"]>0 ? 0. : $result[$i]["FILESIZE"]/($result[$i]["COPYTIME"]-$result[$i]["INJTIME"]);  
  }
  $retval = $result;
}
else{
  foreach(array_keys($result) as $i){
    if(!in_array($result[$i]["STREAM"],$streams))
      {
	$streams[] = $result[$i]["STREAM"];
	$status[]=array($result[$i]["STREAM"]=>array());
      }
    if($formatbinary)
      {
	if($result[$i]["COPYTIME"]!=null){
	  $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]=1;
	}
	else{
	  $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]=0;
	}

      }
    else{
    if($result[$i]["INJTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="INJECTED";
    }
    if($result[$i]["NEWTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="NEW";
    }
    if($result[$i]["COPYTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="COPIED";
    }
    if($result[$i]["CHKTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="CHECKED";
    }
    if($result[$i]["INSTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="INSERTED";
    }
    if($result[$i]["REPACKTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="REPACKED";
    }
    if($result[$i]["DELTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LUMISECTION"]]="DELETED";
    }
    }
  }
  $retval=$status;
}
array_push($retval,$series1->series);
array_push($retval,$series2->series);
echo json_encode($retval);
}
catch(Exception $e){
  echo "Caught Exception ".$e->getMessage()."\n";
}



?>
