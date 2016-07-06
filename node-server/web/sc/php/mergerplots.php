<?php 
include 'jsonDecode.php';
$setup = $_GET["setup"];
$run = 0;
$run = $_GET["run"];
$xaxis = 'ls';
$xaxis = $_GET["xaxis"];
$yaxis = 'diff';
$yaxis = $_GET["yaxis"];
$streamTo = null;
$streamTo = $_GET["stream"];
//$minLs = null;
$minLs = $_GET["minls"];
//$maxLs = null;
$maxLs = $_GET["maxls"];

//echo var_dump($_GET);

//echo $run." ".$xaxis." ".$yaxis." ".$streamTo."\n";
header("Content-Type: application/json");
$crl = curl_init();
$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/run/_search?size=1';
$data = '{"sort":{"startTime":"desc"}}';

curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

curl_close($crl);
$res=json_decode($ret,true);
$retval = array();
$retval["started"]=$res["hits"]["hits"][0]["_source"]["startTime"];
if(array_key_exists("endTime",$res["hits"]["hits"][0]["_source"])){
  $retval["ended"]=$res["hits"]["hits"][0]["_source"]["endTime"];
}
else{
  $retval["ended"]="";
}
$retval["number"]=$res["hits"]["hits"][0]["_source"]["runNumber"];
//$retval["number"]=235477;

if($run==0){ $run = $retval["number"]; }

$crl = curl_init();

$timeout = 5;
$hostname = php_uname('n');
$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/eols/_search?size=0';

$lsterm="";
if ($maxLs!=null && $maxLs!="") {
  if ($minLs==null || $minLs=="") $minLs="1";
  $lsterm = ',{"range":{"ls":{"from":'.$minLs.',"to":'.$maxLs.'}}}';
}

if($streamTo){
  #$data = '{"query":{"term":{"_parent":'.$run.'}},"sort":{"ls":"asc"},"aggs":{"bu":{"terms":{"field":"appliance","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}},"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}';
  $data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"bu":{"terms":{"field":"appliance","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}},"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}';

}else{
  $data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}';
}
//echo $data;
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

$res=json_decode($ret,true);
$eoltimes=array();
$eoltimesLast=array();
if($streamTo){
  foreach ($res["aggregations"]["bu"]["buckets"] as $bu){  
    $eoltimes[$bu["key"]]=array();
    foreach ($bu["lss"]["buckets"] as $ls){
      $eoltimes[$bu["key"]][$ls["key"]]=$ls["timing"]["value"]/1000;
    }
  }
}
foreach ($res["aggregations"]["lss"]["buckets"] as $ls){
    $eoltimesLast[$ls["key"]]=$ls["timing"]["value"]/1000;
}

//echo json_encode($eoltimesLast);

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/stream-hist/_search?size=0';
if($streamTo){
 $data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}},{term:{"stream":"'.$streamTo.'"}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"streams":{"terms":{"field":"stream","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":10000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"min":{"field":"date"}},"sizes":{"avg":{"field":"filesize"}}}}}}}}';
}
else {
 $data = '{"query":{"bool":{"must":[{"term":{"_parent":'.$run.'}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"streams":{"terms":{"field":"stream","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":10000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"min":{"field":"date"}},"sizes":{"avg":{"field":"filesize"}} }}}}}}';
}
//echo $data;
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

//echo $ret;
$res=json_decode($ret,true);
$microtimes=array();
$sizes=array();
foreach ($res["aggregations"]["streams"]["buckets"] as $stream){  
  $microtimes[$stream["key"]]=array();
  $sizes[$stream["key"]]=array();
  foreach ($stream["lss"]["buckets"] as $ls){
    $microtimes[$stream["key"]][$ls["key"]]=$ls["timing"]["value"]/1000;
    $sizes[$stream["key"]][$ls["key"]]=$ls["sizes"]["value"];
  }
}

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/minimerge/_search?size=0';
$data='{}';
if($streamTo){
  $data = '{"query":{"bool":{"must":[{"prefix":{"_id":"run'.$run.'"}},{"term":{"stream":"'.$streamTo.'"}}'.$lsterm.'] }},"sort":{"ls":"asc"},"aggs":{"bu":{"terms":{"field":"host","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":10000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}}}';

}else{
  $data = '{"query":{"bool":{"must":[{"prefix":{"_id":"run'.$run.'"}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"streams":{"terms":{"field":"stream","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":10000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}}}';
}
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);
$res=json_decode($ret,true);

//echo $ret."\n";

$minitimes=array();
if($streamTo){
  foreach ($res["aggregations"]["bu"]["buckets"] as $bu){  
    $minitimes[$bu["key"]]=array();
    foreach ($bu["lss"]["buckets"] as $ls){
      $minitimes[$bu["key"]][$ls["key"]]=$ls["timing"]["value"]/1000;
    }
  }
}else{
  foreach ($res["aggregations"]["streams"]["buckets"] as $stream){  
    $minitimes[$stream["key"]]=array();
    foreach ($stream["lss"]["buckets"] as $ls){
      $minitimes[$stream["key"]][$ls["key"]]=$ls["timing"]["value"]/1000;
    }
  }
}

$url = 'http://'.$hostname.':9200/runindex_'.$setup.'_read/macromerge/_search?size=0';
$data = '{"query":{"bool":{"must":[{"prefix":{"_id":"run'.$run.'"}}'.$lsterm.']}},"sort":{"ls":"asc"},"aggs":{"streams":{"terms":{"field":"stream","size":100,"order":{"_term":"asc"}},"aggs":{"lss":{"terms":{"field":"ls","size":100000,"order" : { "_term" : "asc" }},"aggs":{"timing":{"max":{"field":"fm_date"}}}}}}}}';
curl_setopt ($crl, CURLOPT_URL,$url);
curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
$ret = curl_exec($crl);

//echo $ret;
$res=json_decode($ret,true);
$macrotimes=array();
foreach ($res["aggregations"]["streams"]["buckets"] as $stream){  
  $macrotimes[$stream["key"]]=array();
  foreach ($stream["lss"]["buckets"] as $ls){
    $macrotimes[$stream["key"]][$ls["key"]]=$ls["timing"]["value"]/1000;
  }
}

$retval = array();
$microeol = array();
$minimicro = array();
$macromini = array();

//echo "$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$\n";
//echo json_encode($minitimes);
if($xaxis=='size'){

  foreach($microtimes as $key=>$dummy){
    $histo=$microtimes[$key];
    if($key!='Error'){
      $microeol[]=array("name"=>$key,"data"=>array());  
      $previoustime = 0;
      foreach($histo as $ls=>$time){
        if (!array_key_exists($ls,$eoltimesLast)) continue;
	$etime = $eoltimesLast[$ls];
	if($yaxis=='lap'){
	  if($previoustime!=0){
	    $microeol[count($microeol)-1]["data"][]=array($sizes[$key][$ls],(round($time)-$previoustime));
	  }
	  $previoustime=$time;
	}else{
	  $microeol[count($microeol)-1]["data"][]=array($sizes[$key][$ls],(round($time)-intval($etime)));
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";
      }
    }
  }

  foreach($minitimes as $stream=>$histo){
    if($stream!='Error'){
      $minimicro[]=array("name"=>$stream,"data"=>array());  
      $previoustime = 0;
      foreach($histo as $ls=>$time){
	if($yaxis=='lap'){
	  if($previoustime!=0){
            if ($streamTo) {
              if (!array_key_exists($ls,$sizes[$streamTo])) continue;
	      $minimicro[count($minimicro)-1]["data"][]=array($sizes[$streamTo][$ls],round($time)-$previoustime);
            }
            else {
              if (!array_key_exists($ls,$sizes[$stream])) continue;
	      $minimicro[count($minimicro)-1]["data"][]=array($sizes[$stream][$ls],round($time)-$previoustime);
            }
	  }
	  $previoustime=$time;
	}else{
	  if($streamTo){
            //if (!array_key_exists($ls,$sizes[$streamTo])) continue;
            if (!array_key_exists($ls,$microtimes[$streamTo])) continue;
	    $minimicro[count($minimicro)-1]["data"][]=array($sizes[$streamTo][$ls],round($time)-intval($microtimes[$streamTo][$ls]));
	  }else{
            //if (!array_key_exists($ls,$sizes[$stream])) continue;
            if (!array_key_exists($ls,$microtimes[$stream])) continue;
	    $minimicro[count($minimicro)-1]["data"][]=array($sizes[$stream][$ls],round($time)-intval($microtimes[$stream][$ls]));
	  }
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";
      }
    }
  }
  
  foreach($macrotimes as $stream=>$histo){
    if ($streamTo && $streamTo!=$stream) continue;
    if($stream!='Error'){
      $macromini[]=array("name"=>$stream,"data"=>array());  
      $previoustime = 0;
      foreach($histo as $ls=>$time){
	if($yaxis=='lap'){
	  if($previoustime!=0){
	    $macromini[count($macromini)-1]["data"][]=array($sizes[$stream][$ls],round($time)-$previoustime);
	  }
	  $previoustime=$time;
	}else{
	  $macromini[count($macromini)-1]["data"][]=array($sizes[$stream][$ls],round($time)-intval($minitimes[$stream][$ls]));
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";                                      
      }
    }
  }
}else{

  foreach($microtimes as $key=>$dummy){
    $histo=$microtimes[$key];
    if($key!='Error'){
      $microeol[]=array("name"=>$key,"data"=>array());  
      $previoustime = 0;
      foreach($histo as $ls=>$time){
        if (!array_key_exists($ls,$eoltimesLast)) continue;
	$etime = $eoltimesLast[$ls];
	//if($streamTo){
	if($yaxis=='lap'){
	  if($previoustime!=0){
	    $microeol[count($microeol)-1]["data"][]=array(intval($ls),(round($time)-$previoustime));
	  }
	  $previoustime=$time;
	}else{
	  $microeol[count($microeol)-1]["data"][]=array(intval($ls),(round($time)-intval($etime)));
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";
      }
    }
  }

  foreach($minitimes as $stream=>$histo){
    if($stream!='Error'){
      $minimicro[]=array("name"=>$stream,"data"=>array());  
      $previoustime = 0;
      foreach($histo as $ls=>$time){
	if($yaxis=='lap'){
	  if($previoustime!=0){
	    $minimicro[count($minimicro)-1]["data"][]=array(intval($ls),round($time)-$previoustime);
	  }
	  $previoustime=$time;
	}else{
	  if($streamTo){
            if (!array_key_exists($ls,$microtimes[$streamTo])) continue;
	    $minimicro[count($minimicro)-1]["data"][]=array(intval($ls),round($time)-intval($microtimes[$streamTo][$ls]));
	  }else{
            if (!array_key_exists($ls,$microtimes[$stream])) continue;
	    $minimicro[count($minimicro)-1]["data"][]=array(intval($ls),round($time)-intval($microtimes[$stream][$ls]));
	  }
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";
      }
    }
  }

  foreach($macrotimes as $stream=>$histo){
    if ($streamTo && $streamTo!=$stream) continue;
    if($stream!='Error'){
      if(!$streamTo || $yaxis=='lap'){ 
	$macromini[]=array("name"=>$stream,"data"=>array());  
      }
      else if($streamTo==$stream){
	$macromini[]=array("name"=>$stream,"data"=>array());  
      }
      $previoustime=0;
      foreach($histo as $ls=>$time){
	if($yaxis=='lap'){
	  if($previoustime!=0){
	    $macromini[count($macromini)-1]["data"][]=array(intval($ls),round($time)-$previoustime);
	  }
	  $previoustime=$time;
	}else{
	  if($streamTo==$stream){
	    $minbutime=100000000000;
	    foreach($minitimes as $bu=>$butime){
	      //	      echo $ls.' '.$time.' '.$bu.' '.$butime[$ls]."\n";
	      if(array_key_exists($ls,$butime) && $butime[$ls]<$minbutime){$minbutime = $butime[$ls];}
	    }
	    //	    echo $ls.' '.$minbutime."\n";
	    if($minbutime<100000000000){
	      $macromini[count($macromini)-1]["data"][]=array(intval($ls),round($time)-$minbutime);
	    }else{
	      $macromini[count($macromini)-1]["data"][]=array(intval($ls),0);
	    }
	  }else if(!$streamTo){
	    $macromini[count($macromini)-1]["data"][]=array(intval($ls),round($time)-intval($minitimes[$stream][$ls]));
	  }
	}
	//    echo round($time).'             '.intval($microtimes[$stream][$ls])/1000."\n";                                      
      }
    }
  }

}
$retval["serie0"]=$microeol;
$retval["serie1"]=$minimicro;
$retval["serie2"]=$macromini;
$retval["run"]=$run;
echo json_encode($retval);

//"facets":{"streams":{"terms":{"field":"stream","order":"term","size":20}}}}';

curl_close($crl);
?>
