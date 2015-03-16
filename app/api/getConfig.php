<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["configName"])) $configName = "default";
    else $configName = $_GET["configName"];


prepareServer();

$index = "f3mon/config"; 
$stringQuery = file_get_contents("./json/getconfig.json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["term"]["_id"]["value"] = $configName;
$stringQuery = json_encode($jsonQuery);


$res=json_decode(esQuery($stringQuery,$index), true);

//echo json_encode($res["hits"]["hits"][0]);

$out = array();
$out['config'] = $res["hits"]["hits"][0]["_source"];
$out['time'] = $res["hits"]["hits"][0]["fields"]["_timestamp"];

if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}


?>