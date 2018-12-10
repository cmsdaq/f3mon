<?php 
function getulegenda($run){
  $crl = curl_init();
  $timeout = 5;
  $hostname = php_uname('n');
  $url = 'http://'.$hostname.':9200/runindex_cdaq_read/microstatelegend/_search?size=1';
  //$data = '{"query":{"filtered":{"query":{"query_string" : {"query":"_parent:'.$run.'"}}}}}';
  $data = '{"query":{"parent_id":{"type":"microstatelegend",id":"'.$run.'"}}}';
  //$data = '{"query":{"term" : {"_parent":"'.$run.'"}}}';
  $crl = curl_init();
  curl_setopt ($crl, CURLOPT_URL,$url);
  curl_setopt ($crl, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($crl, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt ($crl, CURLOPT_POSTFIELDS, $data);
  $ret = curl_exec($crl);
  curl_close($crl);
  $res=json_decode($ret,true);
  $pairs = explode(" ",$res["hits"]["hits"][0]["_source"]["names"]);
  $legenda = array();
  foreach($pairs as $i=>$one){
    $pair = explode("=",$one);
    $legenda[$pair[0]]=$pair[1];
  }
  return $legenda;
  //  echo $res["hits"]["hits"][0]["_source"]["names"];
}
?>

