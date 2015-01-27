<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 37;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

//get parameters from the main river
$index = "_river/runriver";
$runIndex = "runindex_".$sysName."_read";  
$jsonQuery["query"]["term"]["runIndex_read"]["value"] = $runIndex;
$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

//gen collector document
$source = $res["hits"]["hits"][0]["_source"];
if (! $source){die();}
$source["role"] = "collector";
$source["runNumber"] = $runNumber;
$source["startsBy"] = "Web Iterface";
$mapping["dynamic"] = true;
//var_dump($source);

//deleting old istances
$riverIndex = "_river/runriver_".$runNumber."/";
$res=json_decode(esDel($riverIndex), true);
$oldRiverDocument = $res;
//if ($format=="json"){ echo json_encode($res); }

//put dynamic mapping
$index = "_river/runriver_".$runNumber."/_mapping";
$stringQuery = json_encode($mapping);
$res=json_decode(esPut($stringQuery,$index), true);
$newRiverMapping = $res;
//if ($format=="json"){ echo json_encode($res); }

//start collector
$index = "_river/runriver_".$runNumber."/_meta";
$stringQuery = json_encode($source);
$res=json_decode(esPut($stringQuery,$index), true);
$newRiverDocument = $res;
//if ($format=="json"){ echo json_encode($res); }

$out = array();
$out['oldRiverDocument'] = $oldRiverDocument;
$out['newRiverMapping'] = $newRiverMapping;
$out['newRiverDocument'] = $newRiverDocument;


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
