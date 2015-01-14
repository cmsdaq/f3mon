<?php
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["start"])) $from = 0;
    else $from = $_GET["start"];
if(!isset($_GET["size"])) $size = 100;
    else $size = $_GET["size"];
if(!isset($_GET["order"])) $order = "";
    else $order = $_GET["order"];
if(!isset($_GET["search"])) $search = "";
    else $search = $_GET["search"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$index = "runindex_".$sysName."_read/run"; 
$query = "rltable";

$sort = array();
foreach($order as $item){
    $field = $_GET["columns"][ $item["column"] ][ "data" ];
    array_push( $sort, array( $field => array( "order" => $item["dir"])   ));
}

//get runlist

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["size"] = $size;
$jsonQuery["from"] = $from;
$jsonQuery["sort"] = $sort;
if ($search["value"] != "" ){
    $jsonQuery["filter"]["query"]["query_string"]["query"] = "*".$search["value"]."*";    
}

$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);

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