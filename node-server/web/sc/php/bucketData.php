<?php

global $colors;
$colors = array('#058DC7', '#50B432', '#ED561B', '#DDDF00', '#24CBE5', '#64E572',
		      '#FF9655', '#FFF263', '#6AF9C4');


class dataSeries
{
  var $name;
  var $series;
  var $count;
  function dataSeries($name_i){
    $this->count=-1;
    $this->name=$name_i;
    $this->series = array();
    $this->series[$this->name]=array();
  }
  function addHistogram($histo){
    $this->count+=1;
    $histo->setOrdinal($this->count);
    $this->series[$this->name][] = $histo;
  }
  function sprint(){
    echo json_encode($this->series);
    }

};

class histogram1D
{  

  var $name;
  var $nbins; 
  var $xlow;
  var $xhigh;
  var $data;
  var $bucketsize;
  var $underflow = 0.;
  var $overflow = 0.;
  var $integral = 0.;
  var $all = 0.;
  var $mean = 0.;
  var $nentries = 0;
  var $ordinal = 0;

  function histogram1D($name_i,$nbins_i,$xlow_i,$xhigh_i,$thresholdx_i=NULL,$sparse=false){
    global $colors;
    $this->name  = $name_i;
    $this->nbins = $nbins_i;
    $this->xlow  = $xlow_i;
    $this->xhigh = $xhigh_i;
    $this->ordinal = 0;
    $this->thresholdx = $thresholdx_i;
    $this->bucketsize=($this->xhigh-$this->xlow)/$this->nbins;
    $color = $colors[$this->ordinal];
    $hicolor=is_null($thresholdx_i) ? $color : "#FF0000";;
    for($i=0;$i<$this->nbins;$i++){
      $pointcolor = ($this->xlow+$this->bucketsize*($i+0.5)) > $this->thresholdx ? $hicolor : $color;
      $this->data[] = array("x"=>round($this->xlow+$this->bucketsize*($i+0.5),2),"y"=>($sparse?0.:0.000000000001),"color"=>$pointcolor);
    }
    
    

  }
  function setOrdinal($ordinal){
    global $colors;
    $this->ordinal = $ordinal;

    $color = $colors[$this->ordinal];
    $hicolor=is_null($this->thresholdx) ? $color : "#FF0000";;
    for($i=0;$i<$this->nbins;$i++){
      $pointcolor = ($this->xlow+$this->bucketsize*($i+0.5)) > $this->thresholdx ? $hicolor : $color;
      $this->data[$i]["color"]=$pointcolor;
    }
  }

  function fill($x,$weight=1.){
    $bucket=floor($x/$this->bucketsize);
    $this->nentries++;
    $this->all+=$weight;
    $this->mean+=$x*$weight;
    $this->mean/=$this->all;
    if($x >= $this->xhigh){
      $this->overflow+=$weight;
    }
    else if($x < $this->xlow){
      $this->underflow+=$weight;
    }
    else{
      $this->integral+=$weight;
      $this->data[$bucket]["y"]+=$weight;
      //    var_dump($this->content["data"][$bucket]);
    }
  }
  
  function sprint(){
    echo json_encode($this->content);
  }
};

class categorized1D
{

  var $name;
  var $data;
  var $nentries = 0;
  var $ordinal = 0;
  var $binboundaries = array();
  var $unitsOfy ="";
  var $intervals=false;
  /*categories must be an array of pairs of numbers which are the limits of the bins*/
  function categorized1D($name_i,$categories_i,$unitsOfy_i){
    global $colors;
    $this->unitsOfy = $unitsOfy_i;
    $this->name  = $name_i;
    $this->nbins = count($categories_i);

    if(count($categories_i[0])==2){
      $this->binboundaries = $categories_i;
      $this->intervals=true;
      foreach($categories_i as $bins){
	$this->categories[] = strval($bins[0])."-".strval($bins[1])." ".$this->unitsOfy;
      }
      $this->categories[0]="&lt;=".strval($this->binboundaries[0][1])." ".$this->unitsOfy;
      $this->categories[count($this->categories)-1]=">".strval($this->binboundaries[count($this->categories)-1][0])." ".$this->unitsOfy;
    }else{
      $bincount=0;
      foreach($categories_i as $bins){
	$this->categories[] = strval($bins)." ".$this->unitsOfy;
	$this->binboundaries[$bins]=$bincount;
	$bincount++;
      }
    }
    $this->ordinal = 0;
    for($i=0;$i<$this->nbins;$i++){
      $pointcolor = $colors[$i];
      $this->data[] = array("name"=>$this->categories[$i],"y"=>null,"color"=>$pointcolor,"visible"=>false);
    }
    
    
    
  }

  function setOrdinal($ordinal){
    $this->ordinal = $ordinal;
  }

  /* legend here is an array of string of same size as the categories array*/
  function useLegend($legend,$last,$setaslast){
    for($i=0;$i<$this->nbins;$i++){
      $this->data[$i]["name"]=$legend[$this->binboundaries[$i][1]];
    }
    if($setaslast && $this->binboundaries[count($this->binboundaries)-1][0]>=$last){$this->data[count($this->binboundaries)-1]["name"]=$setaslast;}
  }
  
  function fill($x,$weight=1.){
    $this->nentries+=$weight;
    if($this->intervals){
      foreach($this->binboundaries as $i=>$limits){
	if($x>$limits[0] && $x<=$limits[1]){
	  $this->data[$i]["y"]+=$weight;
	  $this->data[$i]["visible"]=true;
	}
      }
    }else{
      $this->data[$x]["y"]+=$weight;
    }
  }
  
  function sprint(){
    echo json_encode($this);
  }
};

/* /\* header("Content-Type: application/json"); *\/ */
/* $series = new dataSeries("serie1"); */
/* $h1 = new histogram1D("pippo1",10,0.,100.); */
/* $h2 = new histogram1D("pippo2",10,0.,100.); */
/* $series->addHistogram($h1); */
/* $series->addHistogram($h2); */
/* $h1->fill(3.); */
/* $npoints = rand(1000,10000); */
/* for($i=0;$i<$npoints;$i++){ */
/*   $h2->fill(rand(0.,100.)); */
/* } */
/* $series->sprint(); */

/* $cats = array(array(0.,100.),array(100.,500.),array(500.,1000.),array(1000.,1000000.)); */
/* $c1 = new categorized1D("pippo",$cats); */
/* $c1->fill(1.); */
/* $c1->fill(10.); */
/* $c1->fill(300.); */
/* $c1->fill(350.); */
/* $c1->fill(50000.); */
/* $c1->sprint(); */
?>
