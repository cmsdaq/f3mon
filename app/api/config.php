<?php

//$runindex = "runindex_cdaq_read";
//$boxinfoindex = "boxinfo_cdaq_read";
header("Content-Type: application/json");

function esPut ($document,$index) {
    $timeout = 5;

    $hostname = 'localhost';

    $url = 'http://'.$hostname.':9200/'.$index;

    $crl = curl_init();
    curl_setopt ($crl, CURLOPT_URL,$url);
    curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
    curl_setopt ($crl, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_setopt ($crl, CURLOPT_POSTFIELDS, $document);
    $ret = curl_exec($crl);
    curl_close($crl);
    //var_dump($ret);
    return $ret;
};

function esDel($index)
{
    $timeout = 5;
    $hostname = 'localhost';

    $url = 'http://'.$hostname.':9200/'.$index;
    
    $crl = curl_init();
    curl_setopt($crl, CURLOPT_URL,$url);
    curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
    curl_setopt($crl, CURLOPT_CUSTOMREQUEST, "DELETE");
    $ret = curl_exec($crl);
//    $httpCode = curl_getinfo($crl, CURLINFO_HTTP_CODE);
    curl_close($crl);

    return $ret;
}

function esQuery ($stringQuery,$index) {
    $timeout = 5;
    $hostname = 'localhost';
    //echo $hostname;
    if ($stringQuery != NULL && end(explode( '_', $index )) != "count") 
        { $index = $index."/_search"; };
    //var_dump($index);

    $url = 'http://'.$hostname.':9200/'.$index;

    //echo $url;

    $crl = curl_init();
    curl_setopt ($crl, CURLOPT_URL,$url);
    curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);

    if ($stringQuery != NULL){ curl_setopt ($crl, CURLOPT_POSTFIELDS, $stringQuery); };
    
    $ret = curl_exec($crl);
    curl_close($crl);
    
    return $ret;
};



function getStringQuery($query){
    $stringQuery = file_get_contents("../json/".$query.".json");
    return $stringQuery;
};

function percColor($percent){
    $color = "";
    if($percent == 100){$color = "green";}
        else if ($percent >50) {$color = "orange";}
            else if ($percent < 50) {$color = "red";}
    return $color;
}

function startsWith($haystack, $needle)
{
     $length = strlen($needle);
     return (substr($haystack, 0, $length) === $needle);
}


?>