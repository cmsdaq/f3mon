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
if(!isset($_GET["size"])) $size = 100;
    else $size = $_GET["size"];
if(!isset($_GET["sortBy"])) $sortBy = "";
    else $sortBy = $_GET["sortBy"];
if(!isset($_GET["sortOrder"])) $sortOrder = "";
    else $sortOrder = $_GET["sortOrder"];
if(!isset($_GET["search"])) $search = "";
    else $search = $_GET["search"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$index = "runindex_".$sysName."_read/run"; 
$query = "rltable";

//get runlist
$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);

$missing = ($sortOrder == 'desc') ? '_first' : '_last';
if($sortBy != '' && $sortOrder != ''){
    $jsonQuery["sort"] = array($sortBy=>array('order' => $sortOrder,"missing" => $missing));
}

$jsonQuery["size"] = $size;
$jsonQuery["from"] = $from;

if ($search != "" ){
    $jsonQuery["filter"]["query"]["query_string"]["query"] = "*".$search."*";    
}

$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

//echo json_encode($res);
//die();

$ret = array();
foreach ($res["hits"]["hits"] as $item) {
    array_push($ret, $item["_source"]);
}
$total = $res["aggregations"]["total"]["value"];
$filteredTotal = $res["hits"]["total"];

//Output
$out = array(
    "iTotalRecords" => $total,
    "iTotalDisplayRecords" => $filteredTotal,
    "aaData" => array()
);

$out['aaData'] = $ret;

if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>