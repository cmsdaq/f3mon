<?php 
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}



if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];
if(!isset($_GET["runNumber"])) $runNumber = 10;
    else $runNumber = $_GET["runNumber"];
if(!isset($_GET["timeRange"])) $timeRange = 60; //seconds
    else $timeRange = $_GET["timeRange"];
if(!isset($_GET["sysName"])) $sysName = "cdaq";
    else $sysName = $_GET["sysName"];


//GET LEGEND
$query = "ulegenda";
$index = "runindex_".$sysName."_read/microstatelegend";

$stringQuery = file_get_contents("./json/".$query.".json");

$jsonQuery = json_decode($stringQuery,true);
$jsonQuery["query"]["filtered"]["query"]["term"]["_parent"] = $runNumber;
$stringQuery = json_encode($jsonQuery);

$res=json_decode(esQuery($stringQuery,$index), true);
$data = array();
if($res['hits']['total']==0){$legend=false;}
else{
    $rawLegend = split(' ',trim($res["hits"]["hits"][0]["_source"]["names"]));
    foreach($rawLegend as $item){
        $kv = split('=',$item);
        if($kv[1]==''){ continue; $name = $kv[0];} //accept empty legend???
            else{$name=$kv[1];}
        $legend[$kv[0]]  = $name;
        $data[$name] = array();
    }
}

//echo json_encode($legend);
//die();

if($legend){

    //GET STATES
    $query = "nstates";
    $index = "runindex_".$sysName."_read/state-hist";     
    
    
    $stringQuery = file_get_contents("./json/".$query.".json");
    $jsonQuery = json_decode($stringQuery,true);
    $jsonQuery["query"]["bool"]["must"][1]["range"]["_timestamp"]["from"] = 'now-'.$timeRange.'s';
    $jsonQuery["query"]["bool"]["must"][0]["term"]["_parent"] = $runNumber;
    $stringQuery = json_encode($jsonQuery);
    $res=json_decode(esQuery($stringQuery,$index), true);
    
    //echo json_encode($res);
    $hits = $res["hits"]["hits"];
    $timeList=array();
    foreach ($hits as $hit){
        
        $timestamp = $hit['sort'][0];
        $timeList[] = $timestamp;
        $entries = $hit['_source']['hmicro']['entries'];

        $entriesList = array();
        foreach ($entries as $entry){
            $key = $entry['key'];
            $value = $entry['count'];
            $name = $legend[$key];
            $entriesList[] = $name;
            $data[$name][] = array($timestamp,$value);
        }
        $diff = array_diff(array_keys($data),$entriesList);
        foreach ($diff as $name){
            $data[$name][] = array($timestamp,null);   

        }
        
    }

//    echo json_encode($data);
}

$lastTime = end($hits);
$lastTime = $lastTime['sort'][0];

$out = array(   "lastTime"=>$lastTime,
                "timeList"=>$timeList,
                //"legend"=>$legend,
                "data"=>$data,
            );

if ($format=="json"){  
    $json = json_encode($out);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}


?>
