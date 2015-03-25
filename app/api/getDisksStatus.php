<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}

if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 36;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$query = "disks";
$index = "boxinfo_".$sysName."_read/boxinfo";    

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["wildcard"]["activeRuns"]["value"] = "*".$runNumber."*";
$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);

//echo json_encode($res);
//die();

$ret = $res["aggregations"];

if ($format=="json"){  
    $json = json_encode($ret);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}




?>
