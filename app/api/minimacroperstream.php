<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 390008;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["from"])) $from = 1000;
    else $from = $_GET["from"];
if(!isset($_GET["to"])) $to = 2000;
    else $to = $_GET["to"];     
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];
if(!isset($_GET["streamList"])) $streamList = "A,B,DQM,DQMHistograms, HLTRates,L1Rates";
    else $streamList = $_GET["streamList"]; 
if(!isset($_GET["type"])) $type = "minimerge";
    else $type = $_GET["type"];

$streamList = split(",",$streamList);
$streamNum = count($streamList);

//echo json_encode($_GET);

//GET TOTAL
$index = "runindex_".$sysName."_read/eols"; 
$query = "teols.json";

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

//remove ls histogram aggs
$jsonQuery["aggregations"] = $jsonQuery["aggregations"]["ls"]["aggs"];

$jsonQuery["query"]["filtered"]["filter"]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["from"]= $from;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["to"]= $to;

$stringQuery = json_encode($jsonQuery);
//var_dump($stringQuery);

$res=json_decode(esQuery($stringQuery,$index), true);

$total = $res["aggregations"]["events"]["value"];
$doc_count = $res["aggregations"]["hits"]["total"];

//var_dump($total);
//var_dump($doc_count);

//GET MINIMERGE

$index = "runindex_".$sysName."_read/".$type; 
$query = "minimacroperstream.json";


$stringQuery = file_get_contents("./json/".$query);
$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["query"]["bool"]["must"][1]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["query"]["bool"]["must"][0]["range"]["ls"]["from"]= $from;
$jsonQuery["query"]["bool"]["must"][0]["range"]["ls"]["to"]= $to;
//$jsonQuery["aggs"]["stream"]["terms"]["size"] = $streamNum+1;

$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);
//echo json_encode($jsonQuery);
//echo json_encode($res);



$out = array(
    "percents" => array(),
);

$streams = $res["aggregations"]["stream"]["buckets"];
foreach ($streams as $item ) {
    $stream = $item["key"];
    if ($stream == '' || !in_array($stream, $streamList)) { continue; };

    $processed = $item["processed"]["value"];
    $doc_count = $item["doc_count"];

//CALC MINIMERGE PERCENTS        
    if ($total == 0){ 
        if ($doc_count == 0) {$percent = 0;} 
        else {$percent = 100; }
    }
    else{ $percent = round($processed/$total*100,2);  }

    $color = percColor($percent);

    $out["percents"][] = array("name"=>$stream,"y"=>$percent,"color"=>$color, "drilldown"=> true);
}



//if ($format=="json"){ echo json_encode($out); }


if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>
