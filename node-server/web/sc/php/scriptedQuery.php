<?php

if ($new_cpu_match) {
  $cpu_script_2 = "int cpuw = params._source['activePhysCores']/mycount;".
                  "if (cpuw==16) archw=0.96;".
                  "if (cpuw==24) archw=1.13;".
                  "if (cpuw==28 || cpuw==32) archw=1.15;".
                  "if (2*params._source['activePhysCores']==params._source['activeHTCores']) cpuw=params._source['activeHTCores']/mycount;";

  $cpu_script_1 = $cpu_script_2.
                  "else if (params._source['activePhysCores']==params._source['activeHTCores']) mysum=mysumu;";
} else {
  $cpu_script_2 = "int cpuw = params._source['active_resources']/mycount;".
                  "if (cpuw==32 || cpuw==16) archw=0.96;".
                  "if (cpuw==48 || cpuw==24) archw=1.13;".
                  "if (cpuw==56 || cpuw==28) archw=1.15;".
	
  $cpu_script_1 = $cpu_script_2.
                  "if (cpuw<30) mysum=mysumu;";
}

$scriptinit = "params._agg['cpuavg']=[]; params._agg['cpuweight']=[];";

$scriptreduce ='double fsum=0.0;'.
               'double fweights=0.0;'.
	       'for (agg in params._aggs) {'.
	         'if (agg!=null) for (a in agg.cpuavg) fsum+=a;'.
		 'if (agg!=null) for (a in agg.cpuweight) fweights+=a;'.
	       '}'.
	       'if (fweights>0) return fsum/fweights;'.
	       'else return 0;'; 

function makeMetric($name,$sinit,$sinline,$sreduce) {
  return '"'.$name.'":{"scripted_metric":{"init_script":{"inline":"'.$sinit.'"},"map_script":{"inline":"'.$sinline.'"},"reduce_script":{"inline":"'.$sreduce.'"}}}';
}

#old/new rack layout
$termscript_pre297144 = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "def rack = doc['appliance'].value.substring(3,8);".
              "if (rack.startsWith('c2e4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d3') || rack.startsWith('c2d41') || rack.startsWith('c2d42')) return '`15 Megw:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2d4')) return '`16 Action:'+doc['active_resources'].value;".
              "else if (rack.startsWith('c2f') || rack.startsWith('c2e')) return '`12 Dell:'+doc['active_resources'].value;".
              "else return rack+':'+doc['active_resources'].value;";

$termscript_pre298500 = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "def rack = doc['appliance'].value.substring(3,11);".
              "if (doc['appliance'].value=='bu-c2d46-10-01') return '`16 Action(R730):'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2d31-10') || rack.startsWith('c2d32-10') || rack.startsWith('c2d33-10') ||".
	      "    rack.startsWith('c2d34-10') || rack.startsWith('c2d35-10') || rack.startsWith('c2d36-10') ||".
	      "    rack.startsWith('c2d37-10') || rack.startsWith('c2d38-10') ||".
	      "    rack.startsWith('c2d41-10') || rack.startsWith('c2d42-10'))".
	      " return '`17 Huaw:'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2f16-09') || rack.startsWith('c2f16-11') || rack.startsWith('c2f16-13') ||".
	      "    rack.startsWith('c2e18-27') || rack.startsWith('c2e18-29') || rack.startsWith('c2e18-31'))".
	      " return '`17 Huaw:'+doc['active_resources'].value;".
	      "if (rack.startsWith('c2d3') || rack.startsWith('c2d41') || rack.startsWith('c2d42'))  return '`15 Megw:'+doc['active_resources'].value;".
              "if (rack.startsWith('c2e4') || rack.startsWith('c2d4')) return '`16 Action:'+doc['active_resources'].value;".
              "if (rack.startsWith('c2f') || rack.startsWith('c2e')) return '`12 Dell:'+doc['active_resources'].value;".
              "def rack = doc['appliance'].value.substring(3,8);".
              "return rack+':'+doc['active_resources'].value;";

//categories shown in per appliance type plots (latest version after bu/fuCPUName fields have been added)
$termscript_2018 = "if (doc['appliance'].value.startsWith('dv')) return doc['appliance'].value;".
              "def buCPU=doc['buCPUName'].value;".
	      "def fuCPU=doc['fuCPUName'].value;".
              "def buMap = ['E5-2670 0':'','E5-2670 v3':'(R730)'];".
              "def fuMap = ['E5-2670 0':'`12 Dell','E5-2680 v3':'`15 Megw','E5-2680 v4':'`16 Action','E5-2650 v4':'`17 Huaw','Gold 6130':'`18 Gold'];".
	      "def bukey = buMap[buCPU];".
	      "def fukey = fuMap[fuCPU];".
	      "if (fukey==null || fukey=='') fukey=doc['fuCPUName'].value;".
	      "if (bukey!=null && bukey=='') buCPU=bukey; else buCPU='('+buCPU+')';".
	      "return fukey+buCPU+':'+doc['active_resources'].value;";

function getTermScript($run) {

  global $termscript_pre297144;
  global $termscript_pre298500;
  global $termscript_2018;

  if (intval($run)<297144)
    return $termscript_pre297144;
  elseif (intval($run)<298500)
    return $termscript_pre298500;
  else
    return $termscript_2018;
}


//CPU usage with correction
//B: corrections from TSG (single-thread power vs. Ivy bridge) using 'kink' function (20% HT efficiency assumed)
//$scriptcorrB02 = ''.
$scriptCorrSimpleCPU_Weighted = ''.
                 'double mysum=0.0;'.
                 'double mysumu=0.0;'.
		 'int mycount=0;'.
	         "for (uncorr in params._source.fuSysCPUFrac) {".
	           //"float uncorr = _source['fuSysCPUFrac'][i];".
	           'double corr=0;'.
	           'if (uncorr<0.5) {'.
	             'corr = uncorr * 1.6666666;'.
	           '} else {'.
	             'corr = (0.5+0.2*(uncorr-0.5))*1.6666666;'.
	           '}'.
	           'mysum+=corr; mycount+=1;'.
	           'mysumu+=uncorr;'.
	         '}'.
	         'if (mycount>0) {'.
                   'double archw=1.0;'.
	           $cpu_script_1.
	           'params._agg.cpuavg.add(archw*cpuw*mysum/mycount);'.
	           'params._agg.cpuweight.add(archw*cpuw);'.
	         '}';

//CPU usage with correction
//B: corrections from TSG (single-thread power vs. Ivy bridge) and 2x-x*x function used (~20% HT efficiency but turn-on effect is better parametrized)
//TODO:dynamically detect HT on/off based on CPU type
$scriptCorrFuncCPU_Weighted = ''. //scriptCorrC02
          "double mysum=0.0;".
          "double mysumu=0.0;".
	  "int mycount=0;".
	  "for (uncorr in params._source.fuSysCPUFrac) {".
	    "double corr=2*uncorr-uncorr*uncorr;".
	    "mysum+=corr; mycount+=1;".
	    "mysumu+=uncorr;".
	  "}".
	  "if (mycount>0) {".
            "double archw=1.0;".
	    $cpu_script_1.
	    "params._agg.cpuavg.add(archw*cpuw*mysum/mycount);".
	    "params._agg.cpuweight.add(archw*cpuw);".
	  "}";

//uncorrected CPU usage
$scriptUncorrCPU_Weighted = "".//$scriptuncorrB = ''.
          "double mysum=0.0;".
          "int mycount=0;".
	  "for (uncorr in params._source.fuSysCPUFrac) {".
	    "mysum+=uncorr;".
	    "mycount+=1;".
	  "}".
	  "if (mycount>0) {".
            "double archw=1.0;".
	    $cpu_script_2.
	    "params._agg.cpuavg.add(archw*cpuw*mysum/mycount);".
	    "params._agg.cpuweight.add(archw*cpuw);".
	  "}";

//event time with per-CPU weights (to be used in average). later normalized with event size from EoLS.
$scriptEvtime_Weighted = "double mysum = 0.0;".
          "int mycount=0;".
	  "for (uncorr in params._source.fuSysCPUFrac) {".
	  "  mysum+=uncorr; mycount+=1;".
	  "}".
	  "double datain = params._source.fuDataNetIn;".
	  "int ares = params._source.active_resources;".
	  "if (mycount>0 && datain>100.0) {".
          "  double mytimeoversize=ares*mysum/datain;".
          "  double archw=1.0;".
	  $cpu_script_2.
	  "  params._agg.cpuavg.add(archw*cpuw*mytimeoversize/mycount);".
	  "  params._agg.cpuweight.add(archw*cpuw);".
	  "}";

//event time without per-CPU weights (to be plotted for each category). later normalized with event size from EoLS.
$scriptEvtime_Unweighted = "double mysum = 0.0;".
          "int mycount=0;".
	  "for (uncorr in params._source.fuSysCPUFrac) {".
	  "  mysum+=uncorr; mycount+=1;".
	  "}".
	  "double datain = params._source.fuDataNetIn;".
	  "int ares = params._source.active_resources;".
	  "if (mycount>0 && datain>100.0) {".
          "  double mytimeoversize=ares*mysum/datain;".
          "  double cpuw = ares/mycount;".
	  "  params._agg.cpuavg.add(cpuw*mytimeoversize/mycount);".
	  "  params._agg.cpuweight.add(cpuw);".
	  "}";

//alternative method event time from CPU usage (takes into account differences on BU-by-BU basis, other method groups per scripted terms (BU/FU type x number of unblacklisted resources)
//both methods use fu data network input to estimate CPU usage. This is ok because other BU->FUs traffic is <20 MB/s (i.e. <1 effect% at full bandwidth)
//this could however also be based on event b/w information that would be collected by input sources (but is not there at the moment).
$scriptEvtimeAlt_Weighted = ''.
          "double mysum=0.0;".
          "int mycount=0;".
	  "for (uncorr in params._source.fuSysCPUFrac) {".
	    "mysum+=uncorr;".
	    "mycount+=1;".
	  "}".
	  "double datain = params._source.fuDataNetIn;".
	  "int ares = params._source.active_resources;".
	  "if (mycount>0 && datain>100.0) {".
            "double archw=1.0;".
	    $cpu_script_2.
	    "params._agg.cpuavg.add(ares*archw*cpuw*mysum/(mycount*1048576.0*datain));".
	    "params._agg.cpuweight.add(archw*cpuw);".
	  "}";




?>
