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

$index = "_river"; 
$query = "runrivertable-meta";

//get meta
$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["size"] = $size;
$jsonQuery["from"] = $from;
$jsonQuery["query"]["term"]["_id"]["value"] = '_meta';

if($sortBy != '' && $sortOrder != ''){
    $jsonQuery["sort"] = array($sortBy=>array('order' => $sortOrder,"missing" => 'main',"unmapped_type" => "string"));
}

$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);
//var_dump($stringQuery);

$typeList = array();
$out = array("list"=>array(),"total"=>$res["hits"]["total"]);
foreach ($res["hits"]["hits"] as $item) {
    $typeList[] = $item["_type"]; //for status check
    $runindex = explode('_' , $item["_source"]["runIndex_read"])[1];    
    //$runindex = $runindex[1];
    $out["list"][] = array(
        "name"      => $item["_type"],
        "role"      => array_key_exists ('role',$item['_source']) ? $item['_source']['role'] : 'main' ,
        "status"    => false,
        "subSystem" => $runindex
        );
}

//check status
$query = "runrivertable-status";
$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["bool"]["must"][1]["terms"]["_type"] = $typeList;
$stringQuery = json_encode($jsonQuery);
$res=json_decode(esQuery($stringQuery,$index), true);


$func = function($name) {return function ($value) use ($name) {   return $value["_type"] == $name; }; } ;    
$hits = $res["hits"]["hits"];
//var_dump($hits);
foreach ($out["list"] as &$item) { //pass by reference
    
    $status =  array_filter($hits, $func($item["name"]));
    
    if(!empty($status)){
        //var_dump(reset($status));
        $ipstring = reset($status);
        $ipstring = $ipstring["_source"]["node"]["transport_address"];
        $ip = substr($ipstring,strpos($ipstring,'/')+1,strpos($ipstring,':')-strlen($ipstring));
        $host = gethostbyaddr ($ip);
        $item["status"] = true;
        $item["host"] = $host ? $host : $ip;
    }
}

//echo json_encode($out);
//die();

if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}


?>