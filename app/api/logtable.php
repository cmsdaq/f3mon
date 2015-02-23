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
if(!isset($_GET["search"])) $search = "*";
    else $search = $_GET["search"];
if(!isset($_GET["startTime"])) $startTime = "0";
    else $startTime = $_GET["startTime"];
if(!isset($_GET["endTime"])) $endTime = "now";
    else $endTime = $_GET["endTime"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];

$index = "hltdlogs_".$sysName."/hltdlog"; 
$query = "logmessages";

$stringQuery = file_get_contents("./json/".$query.".json");
$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["size"] = $size;
$jsonQuery["from"] = $from;
$jsonQuery["query"]["filtered"]["filter"]["and"][0]["range"]["_timestamp"]["from"] = $startTime;
$jsonQuery["query"]["filtered"]["filter"]["and"][0]["range"]["_timestamp"]["to"] = $endTime ;

if ($search != ""  ){
    $jsonQuery["query"]["filtered"]["query"]["bool"]["should"][0]["query_string"]["query"] = $search;    
}

$missing = ($sortOrder == 'desc') ? '_first' : '_last';
if($sortBy != '' && $sortOrder != ''){
    $jsonQuery["sort"] = array($sortBy=>array('order' => $sortOrder,"missing" => $missing));
}

//echo json_encode($jsonQuery);

$stringQuery = json_encode($jsonQuery);
//echo $stringQuery;

$res=json_decode(esQuery($stringQuery,$index), true);

$total = $res["hits"]["total"];
$ret = array();
foreach ($res["hits"]["hits"] as $item) {
    array_push($ret, $item["_source"]);
}


//Output
$output = array(
    "iTotalRecords" => $total,
    "iTotalDisplayRecords" => $total,
    "aaData" => array()
);

$output['aaData'] = $ret;
$output['lastTime'] = $res['aggregations']['lastTime']['value'];


//echo json_encode( $output );
if ($format=="json"){  
    $json = json_encode($output);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>
