<?php 
$callback = $_GET['callback'];
$pattern = '/^[\\w\\._\\d]+$/';
if (!preg_match($pattern, $callback)) {
  exit('invalid callback');
}


$hostname = php_uname('n');


$data = array(
  "host" => $hostname);



$json = json_encode($data);
header("Content-type: text/javascript");
if ($callback)
    echo $callback .' (' . $json . ');';
else
    echo $json;
?>
