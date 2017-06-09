<?php
include 'bucketData.php';
header("Content-Type: application/json");
$run=0;
$fill=0;
$run = $_GET["run"];
$setup = $_GET["setup"];
$stream = $_GET["stream"];
$xaxis = $_GET["xaxis"];
//$formatchart = $_GET["chart"];
//$formatstrip = $_GET["strip"];
//$formatbinary=$_GET["binary"];
//
//$setup="cdaq";
//$xaxis="ls";
//$stream="Physic*";
//
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
select files.LS as LS,
files.STREAM as STREAM,
files.P5_INJECTED_TIME as INJTIME, 
files.TRANSFER_START_TIME as NEWTIME, 
files.TRANSFER_END_TIME as COPYTIME, 
files.T0_CHECKED_TIME as CHKTIME, 
files.T0_REPACKED_TIME as REPACKTIME, 
files.P5_DELETED_TIME as DELTIME, 
fqc.FILE_SIZE as FILESIZE
FROM CMS_STOMGR.FILE_TRANSFER_STATUS files
LEFT OUTER JOIN CMS_STOMGR.FILE_QUALITY_CONTROL fqc using (FILENAME)
where files.RUNNUMBER=".$run;

  if($stream){
   $stream =  str_replace("*","%",$stream);
   $query = $query." AND files.STREAM like '".$stream."'";
  }
  $query = $query."ORDER BY STREAM ASC, LS ASC";//lumisection?


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
try{
//if($formatchart){
if(true){

  foreach(array_keys($result) as $i){
    if($result[$i]["COPYTIME"]==null || $result[$i]["INJTIME"]==null || $result[$i]["NEWTIME"]==null) {
      continue;
    }
    $injt = DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["INJTIME"])->format('U');
    $newt = DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["NEWTIME"])->format('U');
    $cpt =  DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["COPYTIME"])->format('U');
    //echo $injt." ".$newt." ".$cpt."\n";
    $copytime = $cpt-$injt;//also include inj to start transfer
    $bwtime = $cpt-$newt;//only latency during copy
    $copybw = $result[$i]["FILESIZE"]/$bwtime/1024/1024;
    /* echo $result[$i]["STREAM"]."\n"; */
    /* echo $i." ".$copybw."\n"; */

    if(!in_array($result[$i]["STREAM"],$streams))
      {
	$streams[] = $result[$i]["STREAM"];
	$transtimes[]=array("name"=>$result[$i]["STREAM"],"data"=>array());
	$bandwidth[]=array("name"=>$result[$i]["STREAM"],"data"=>array());
	$h1 = new histogram1D("cpt_".$result[$i]["STREAM"],20,0.,200.,200.);
	$h2 = new histogram1D("cpbw_".$result[$i]["STREAM"],20,0.,100.,100.);
	$series1->addHistogram($h1);
	$series2->addHistogram($h2);
      }

    $h1->fill($copytime);
    $h2->fill($copybw);
    if($xaxis!="size"){
      $transtimes[count($transtimes)-1]["data"][] = array(intval($result[$i]["LS"]),$copytime);
      $bandwidth[count($transtimes)-1]["data"][] = array(intval($result[$i]["LS"]),$copybw);
      if(count($totals)<intval($result[$i]["LS"])|| $totals[intval($result[$i]["LS"])]==0){
	$totals[intval($result[$i]["LS"])]=$copybw;
      }else{
	$totals[intval($result[$i]["LS"])]+=$copybw;
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

  array_push($retval,$series1->series);
  array_push($retval,$series2->series);

}
/*
else if(!$formatstrip){
  foreach(array_keys($result) as $i){
    //earliest timestamp
    if($result[$i]["INJTIME"]!=null){//diff between inject and transfer start (if any)
      $creatime = DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["INJTIME"])->format('U');
      $result[$i]["INJTIME"]=null;

      if($result[$i]["NEWTIME"]!=null){//diff between inject and transfer start (if any)
        $result[$i]["NEWTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["NEWTIME"])->format('U')-$creatime;
        //$result[$i]["INJTIME"]= $result[$i]["NEWTIME"]-$creatime;
      }
      if($result[$i]["COPYTIME"]!=null){
        $result[$i]["COPYTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["COPYTIME"])->format('U')-$creatime;
        //$result[$i]["COPYTIME"]= $result[$i]["NEWTIME"]-$creatime;
      }
      if($result[$i]["CHKTIME"]!=null){
        $result[$i]["CHKTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["CHKTIME"])->format('U')-$creatime;
        //$result[$i]["CHKTIME"]= $result[$i]["NEWTIME"]-$creatime;
      }
      if($result[$i]["REPACKTIME"]!=null){
        $result[$i]["REPACKTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["REPACKTIME"])->format('U')-$creatime;
        //$result[$i]["REPACKTIME"]= $result[$i]["NEWTIME"]-$creatime;
      }
      if($result[$i]["DELTIME"]!=null){
        $result[$i]["DELTIME"]= DateTime::createFromFormat("d#M#y H#i#s*A",$result[$i]["DELTIME"])->format('U')-$creatime;
        //$result[$i]["DELTIME"]= $result[$i]["NEWTIME"]-$creatime;
      }
      //echo json_encode($result[$i])."\n";
    }

    //newtime is transfer start
    $result[$i]["COPYBW"]= $result[$i]["COPYTIME"]>0 ? 0. : $result[$i]["FILESIZE"]/($result[$i]["COPYTIME"]-$result[$i]["NEWTIME"]);
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
	  $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]=1;
	}
	else{
	  $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]=0;
	}

      }
    else{
    if($result[$i]["INJTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="INJECTED";
    }
    if($result[$i]["NEWTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="NEW";
    }
    if($result[$i]["COPYTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="COPIED";
    }
    if($result[$i]["CHKTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="CHECKED";
    }
    //if($result[$i]["INSTIME"]!=null){
    //  $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="INSERTED";
    //}
    if($result[$i]["REPACKTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="REPACKED";
    }
    if($result[$i]["DELTIME"]!=null){
      $status[count($status)-1][$result[$i]["STREAM"]][$result[$i]["LS"]]="DELETED";
    }
    }
  }
  $retval=$status;
}
*/
echo json_encode($retval);
}
catch(Exception $e){
  echo "Caught Exception ".$e->getMessage()."\n";
}



?>
