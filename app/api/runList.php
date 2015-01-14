<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}

if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];    
if(!isset($_GET["from"])) $from = 0;
    else $from = $_GET["from"];
if(!isset($_GET["to"])) $to = "now";
    else $to = $_GET["to"];     
if(!isset($_GET["size"])) $size = 1000;
    else $size = $_GET["size"];   
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$query = "runlist";
$index = "runindex_".$sysName."_read/run";     

$stringQuery = file_get_contents("./json/".$query.".json");

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["size"] = $size;
$jsonQuery["query"]["range"]["_timestamp"]["from"] = $from;
$jsonQuery["query"]["range"]["_timestamp"]["to"] = $to;

$stringQuery = json_encode($jsonQuery);

//echo json_encode($stringQuery);

$res=json_decode(esQuery($stringQuery,$index), true);

//echo json_encode( $res);
//die();

$hits = $res["hits"]["hits"];
$lasttime = $hits[0]["fields"]["_timestamp"];
$ret = array(
    "lasttime" => $lasttime,
    "runlist" => array(),
    );

foreach ($hits as $hit){
    array_push($ret["runlist"], $hit["_source"]);
}


if ($format=="json"){  
    $json = json_encode($ret);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}


?>
