<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["query"])) $query = "runinfo";
    else $query = $_GET["query"];
if(!isset($_GET["runNumber"])) $runNumber = "180017";
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$index = "runindex_".$sysName."_write/run"; 

$riverIndex = "_river/runriver_".$runNumber."/";
$stringQuery = file_get_contents("./json/".$query.".json");

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["filter"]["term"]["_id"] = $runNumber;

$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);

$time = date(DATE_W3C,time());

$ret = $res["hits"]["hits"][0]["_source"];

if (empty($ret)){die();} 

$ret["endTime"] = $time;
$document = json_encode($ret); 

$index = $index."/".$runNumber;

$res=json_decode(esPut($document,$index), true);
$runDocument = $res;
//if ($format=="json"){ echo json_encode($res); }

$res=json_decode(esDel($riverIndex), true);
$riverDocument = $res;
//if ($format=="json"){ echo json_encode($res); }

$out = array();
$out['runDocument'] = $runDocument;
$out['riverDocument'] = $riverDocument;

//echo json_encode( $output );
if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>