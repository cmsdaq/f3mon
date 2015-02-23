<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}

if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 700032;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

//start and end time
$query = "runinfo";
$index = "runindex_".$sysName."_read/run";     

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["filter"]["term"]["_id"] = $runNumber;
$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

$out = $res["hits"]["hits"][0]["_source"];

//streams
$query = "streamsinrun";
$index = "runindex_".$sysName."_read/stream-hist"; 

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["term"]["_parent"] = $runNumber;
$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

$terms = $res["facets"]["streams"]["terms"];
$streams = array();
foreach ($terms as $term) {
    $streams[] = $term['term'];
    
}

$out["streams"] = $streams;

//Last LS number
$query = "lastls";
$index = "runindex_".$sysName."_read/eols";      

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["term"]["_parent"] = $runNumber;
$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

$out["lastLs"] = $res["hits"]["hits"][0]["sort"];


if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>
