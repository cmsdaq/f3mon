<?php
include 'config.php';

$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


if(!isset($_GET["format"])) $format = "json";
    else $format = $_GET["format"];


$index = "_alias/runindex*read";
$stringQuery = NULL;

$res=json_decode(esQuery($stringQuery,$index), true);


$ret = array('list'=>array());

foreach ($res as $key => $value){
    $index = strtolower(key($value["aliases"]));
    $system = explode("_",$index);
    $system = strtolower($system[1]);
    //array_push($ret, array($index,$system));
    $ret['list'][] = array(
        'subSystem'=>$system,
        'index'=>$index
        );
}



if ($format=="json"){  
    $json = json_encode($ret);
    header("Content-type: text/javascript");
    if ($callback)
        echo $callback .' (' . $json . ');';
    else
        echo $json;
}

?>
