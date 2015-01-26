<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 124029;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["from"])) $from = 1;
    else $from = $_GET["from"];
if(!isset($_GET["to"])) $to = 20;
    else $to = $_GET["to"];     
if(!isset($_GET["lastLs"])) $lastLs = 50;
    else $lastLs = $_GET["lastLs"];     
if(!isset($_GET["intervalNum"])) $intervalNum = 20;
    else $intervalNum = $_GET["intervalNum"];   
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];
if(!isset($_GET["streamList"])) $streamList = "A,B,DQM,DQMHistograms, HLTRates,L1Rates";
    else $streamList = $_GET[streamList]; 
if(!isset($_GET["timePerLs"])) $timePerLs = 23.4;
    else $timePerLs = $_GET["timePerLs"]; 
if(!isset($_GET["useDivisor"])) $useDivisor = false;
    else $useDivisor = ($_GET["useDivisor"] === 'true'); 

//if($to == 'last'){$to = $lastLs;}

if($lastLs<20){$lastLs = 20;}

$streamList = split(",",$streamList);

//var_dump($useDivisor);
if(!$useDivisor ){ $timePerLs = 1; };
//var_dump($timePerLs);

$interval = round((intval($to) - intval($from)) / intval($intervalNum) );
if ($interval == 0 ){ $interval = 1; };

//var_dump(round((intval($to) - intval($from)) / intval($intervalNum)));
//var_dump((intval($to) - intval($from)) / intval($intervalNum));

//var_dump($interval);

//NAVBAR FULL RANGE TOTALS
$index = "runindex_".$sysName."_read/eols"; 
$query = "teols.json";

$navInterval = round((intval($lastLs) - intval(1)) / intval($intervalNum) );
if ($navInterval == 0 ){ $navInterval = 1; };

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["aggregations"]["ls"]["histogram"]["interval"] = intval($navInterval);
$jsonQuery["aggregations"]["ls"]["histogram"]["extended_bounds"]["min"]= 1;
$jsonQuery["aggregations"]["ls"]["histogram"]["extended_bounds"]["max"]= $lastLs;
$jsonQuery["query"]["filtered"]["filter"]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["from"]= 1;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["to"]= $lastLs;

$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);
$lastTime = array();
$lastTimes[] = $res['hits']['hits'][0]['fields']['_timestamp'];

$ret = array(
    "events" => array(),
    "files" => array(),
    );

$took = $res["took"];
$buckets = $res["aggregations"]["ls"]["buckets"];


$postOffset = $lastLs-end($buckets)['key'];    

if($navInterval >1){
    $ret["events"][] = array(1,0);
    $ret["files"][] = array(1,0);    
}


//$postOffset = 0;
//echo json_encode(end($buckets));
foreach($buckets as $bucket){

    $ls = $bucket["key"];
    $events = $bucket["events"]["value"];
    $files = $bucket["files"]["value"];

    $ret["events"][] = array($ls+$postOffset,$events);
    $ret["files"][] = array($ls+$postOffset,$files);
} 


$navbar = $ret;

//echo json_encode($ret);




//GET TOTALS
$index = "runindex_".$sysName."_read/eols"; 
$query = "teols.json";

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["aggregations"]["ls"]["histogram"]["interval"] = intval($interval);
$jsonQuery["aggregations"]["ls"]["histogram"]["extended_bounds"]["min"]= $from;
$jsonQuery["aggregations"]["ls"]["histogram"]["extended_bounds"]["max"]= $to;
$jsonQuery["query"]["filtered"]["filter"]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["from"]= $from;
$jsonQuery["query"]["filtered"]["query"]["range"]["ls"]["to"]= $to;

$stringQuery = json_encode($jsonQuery);

//var_dump($stringQuery);


$res=json_decode(esQuery($stringQuery,$index), true);
$lastTime[] = $res['hits']['hits'][0]['fields']['_timestamp'];
//echo json_encode($jsonQuery);


$buckets = $res["aggregations"]["ls"]["buckets"];
$postOffset = $to-end($buckets)['key'];   
$ret = array(
    "lsList" => array(),
    "events" => array(),
    "files" => array(),
    "doc_counts" => array(),
    );


$took = $took + $res["took"];
foreach($buckets as $bucket){

    $ls = $bucket["key"]+$postOffset;
    $events = $bucket["events"]["value"];
    $doc_count = $bucket["doc_count"];
    //$files[$ls] = array($ls,$bucket["files"]["value"]);
    

    $ret["events"][$ls] = $events;
    $ret["doc_counts"][$ls] = $doc_count;
    $ret["lsList"][] = $ls;

}   

$streamTotals = $ret;


//var_dump(json_encode($streamTotals));

//GET STREAM OUT

$index = "runindex_".$sysName."_read/stream-hist"; 
$query = "outls.json";

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["query"]["filtered"]["filter"]["and"]["filters"][0]["prefix"]["_id"] = $runNumber;
$jsonQuery["aggs"]["stream"]["aggs"]["inrange"]["filter"]["range"]["ls"]["from"]= $from;
$jsonQuery["aggs"]["stream"]["aggs"]["inrange"]["filter"]["range"]["ls"]["to"]= $to;
$jsonQuery["aggs"]["stream"]["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["min"]= $from;
$jsonQuery["aggs"]["stream"]["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["max"]= $to;
$jsonQuery["aggs"]["stream"]["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["interval"]= intval($interval);

$stringQuery = json_encode($jsonQuery);

//var_dump($stringQuery);


$res=json_decode(esQuery($stringQuery,$index), true);
$lastTime[] = $res['hits']['hits'][0]['fields']['_timestamp'];

//var_dump(json_encode($res));

$streamData = array(
    "streamList" => array(),
    "data" => array()
);

$took = $took + $res["took"];



$streams = $res["aggregations"]["stream"]["buckets"];
foreach($streams as $stream) {    
    
    if ($stream["key"] == '' || !in_array($stream["key"], $streamList)) { continue; };

    $sout = array("stream"=> $stream["key"]);
    
    $streamData["streamList"][] = $stream["key"];
    //var_dump($ret["streams"]);
    //var_dump($sout);

    $lsList = $stream["inrange"]["ls"]["buckets"];
    foreach ($lsList as $item ) {

        $ls = $item["key"]+$postOffset;

        $total = $streamTotals["events"][$ls];
        $doc_count = $streamTotals["doc_counts"][$ls];
        
        $in = round($item["in"]["value"],2);
        $out = round($item["out"]["value"],2);
        $filesize = round($item["filesize"]["value"],2);

//CALC STREAM PERCENTS        
        if ($total == 0){ 
            if ($doc_count == 0) {$percent = 0;} 
            else {$percent = 100; }
        }
        else{ $percent = round($in/$total*100,2);  }
        
//OUTPUT
        if($timePerLs>1){ 
            $out = round($out/$timePerLs,2); 
            $filesize = round($filesize/$timePerLs,2);
        }

        $sout["dataOut"][] = array("x"=>$ls,"y"=>$out);
        $sout["fileSize"][] = array("x"=>$ls,"y"=>$filesize);
        $sout["percent"][] = array("x"=>$ls,"y"=>$percent);
    }
    $streamData["data"][] = $sout;
}
$streamOut['streams'] = $streamData;
$streamOut["took"] = $took;
$streamOut["lsList"] = $streamTotals["lsList"];



//Filter DQM from streamlist
$mmStreamList = array();
foreach ($streamList as $stream){
    if (!startsWith($stream,"DQM")){
        $mmStreamList[] = $stream;
    }
}
$streamNum = count($mmStreamList);


//GET MINIMERGE

$index = "runindex_".$sysName."_read/minimerge"; 
$query = "minimacromerge.json";

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["query"]["filtered"]["filter"]["and"]["filters"][0]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["aggs"]["inrange"]["filter"]["range"]["ls"]["from"]= $from;
$jsonQuery["aggs"]["inrange"]["filter"]["range"]["ls"]["to"]= $to;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["min"]= $from;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["max"]= $to;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["interval"]= intval($interval);

$stringQuery = json_encode($jsonQuery);

//var_dump($stringQuery);


$res=json_decode(esQuery($stringQuery,$index), true);
$lastTime[] = $res['hits']['hits'][0]['fields']['fm_date'][0]*1000;
//echo json_encode($jsonQuery);
//echo json_encode($res);


$minimerge = array(
    "percents" => array(),
);
$took = $took + $res["took"];
$minimerge["took"] = $res["took"];

$lsList = $res["aggregations"]["inrange"]["ls"]["buckets"];

foreach ($lsList as $item ) {
    $ls = $item["key"]+$postOffset;
    $processed = $item["processed"]["value"];
    $total = $streamTotals["events"][$ls] * $streamNum ;
    $doc_count = $streamTotals["doc_counts"][$ls];
    $mdoc_count = $item["doc_counts"];

//CALC MINIMERGE PERCENTS        
    if ($total == 0){ 
        if ($doc_count == 0 || $mdoc_count == 0) {$percent = 0;} 
        else {$percent = 100; }
    }
    else{ $percent = round($processed/$total*100,2);  }
    $color = percColor($percent);
    $minimerge["percents"][] =  array("x"=>$ls,"y"=>$percent,"color"=>$color);
}



//GET MACROMERGE

$index = "runindex_".$sysName."_read/macromerge"; 
$query = "minimacromerge.json";

$stringQuery = file_get_contents("./json/".$query);

$jsonQuery = json_decode($stringQuery,true);

$jsonQuery["query"]["filtered"]["filter"]["and"]["filters"][0]["prefix"]["_id"] = "run".$runNumber;
$jsonQuery["aggs"]["inrange"]["filter"]["range"]["ls"]["from"]= $from;
$jsonQuery["aggs"]["inrange"]["filter"]["range"]["ls"]["to"]= $to;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["min"]= $from;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["extended_bounds"]["max"]= $to;
$jsonQuery["aggs"]["inrange"]["aggs"]["ls"]["histogram"]["interval"]= intval($interval);

$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);
$lastTime[] = $res['hits']['hits'][0]['fields']['fm_date'][0]*1000;


$macromerge = array(
    "percents" => array(),
);

$took = $took + $res["took"];
$macromerge["took"] = $res["took"];

$lsList = $res["aggregations"]["inrange"]["ls"]["buckets"];
foreach ($lsList as $item ) {
    $ls = $item["key"]+$postOffset;
    $processed = $item["processed"]["value"];
    $total = $streamTotals["events"][$ls] * $streamNum ;
    $doc_count = $streamTotals["doc_counts"][$ls];
    $mdoc_count = $item["doc_counts"];

//CALC macromerge PERCENTS        
    if ($total == 0){ 
        if ($doc_count == 0 || $mdoc_count == 0) {$percent = 0;} 
        else {$percent = 100; }
    }
    else{ $percent = round($processed/$total*100,2);  }
   
    $color = percColor($percent);
    $macromerge["percents"][] =  array("x"=>$ls,"y"=>$percent,"color"=>$color);
}

$streamOut["minimerge"] = $minimerge;
$streamOut["macromerge"] = $macromerge;
$streamOut["navbar"] = $navbar;
$streamOut["took"] = $took;
$streamOut["interval"] = $interval;
$streamOut["lastTime"] = max($lastTime);
//if ($format=="json"){ echo json_encode($streamOut); }


if ($format=="json"){  
    $json = json_encode($streamOut);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}



?>
