'use strict';

var oracledb = require('oracledb'); //module that enables db access
oracledb.outFormat = oracledb.OBJECT //returns query result-set row as a JS object (equiv. to OCI_ASSOC param in php oci_fetch_array call)
oracledb.maxRows = 50000; //approx 2000 lumis x 25 streams

var f3MonCache;
var f3MonCacheSec;
var client;
var ttls;
var totalTimes;
var dbInfo;

//escapes client hanging upon an ES request error by sending http 500
var excpEscES = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Elasticsearch query error during the request execution, an admin should seek further info in the logs)');
}

var excpEscOracle = function (res, error){
	//message can be augmented with info from error
        res.status(500).send('Internal Server Error (Oracle DB query error during the request execution, an admin should seek further info in the logs)');
}



module.exports = {
setup : function(cache,cacheSec,cl,ttl,totTimes,dbinfo) {
  f3MonCache = cache
  f3MonCacheSec = cacheSec
  client = cl
  ttls = ttl
  totalTimes = totTimes
  dbInfo = dbinfo
},

runTransferQuery : function (reqQuery, remoteAddr, res, reply) {
 //params definition
 var eTimeT = new Date().getTime();
 var fill=0;
 var cb = reqQuery.callback;
 var run = reqQuery.run;
 var stream = reqQuery.stream;
 var xaxis = reqQuery.xaxis;
 var formatchart = reqQuery.chart;
 var formatstrip = reqQuery.strip;
 var formatbinary = reqQuery.binary;
 var nonblocking = reqQuery.nonblocking;
 var aggregate = reqQuery.aggregate

 if (aggregate!==null) stream = null;

 var requestKey = 'sc_transfer?run='+run+'&stream='+stream+'&xaxis='+xaxis+'&formatchart='+formatchart+'&formatstrip='+formatstrip;
 var requestValue = f3MonCache.get(requestKey);
 var ttl = ttls.sctransfer; //cached db response ttl (in seconds)
 //var reply=doreply;
  

 var getFromDB = function(){ 
  var retObj; //request formatted response
  var sendResult = function(){
     f3MonCache.set(requestKey, [retObj,ttl], ttl);
     var srvTime = (new Date().getTime())-eTimeT;
     totalTimes.queried += srvTime;
     console.log('sc_transfer (src:'+remoteAddr+')>responding from query (time='+srvTime+'ms)');
     if (!reply) return;
     res.set('Content-Type', 'text/javascript');
     res.header("Cache-Control", "no-cache, no-store");
     //res.send(cb +' ('+JSON.stringify(retObj)+')'); //f3mon response format
     if (cb === undefined)
       res.send(JSON.stringify(retObj));
     else
       res.send(cb +' ('+JSON.stringify(retObj)+')');
  }

  var suffix;
  if (stream == null){
    if (aggregate)
      suffix = " ORDER BY LUMISECTION ASC, STREAM ASC";
    else
      suffix = " ORDER BY STREAM ASC, LUMISECTION ASC";
  }else{
    suffix = " AND STREAM like '%"+stream+"%'";
  }

  var exec = function (){
    //connection and query to Oracle DB
    oracledb.getConnection(
    {
       user          : dbInfo.cdaq[0],//"CMS_DAQ2_HW_CONF_R",
       password      : dbInfo.cdaq[1],//"mickey2mouse",	//change this before any git push!
       connectString : dbInfo.cdaq[2]//"cmsonr1-v.cms:10121/cms_rcms.cern.ch"
    },
    function(err, connection)
    {
    	if (err) {
        	console.error(err.message);
		//equiv to (if (!$conn), err at oci_connect)
		excpEscOracle(res,err);
    		return;
    	}

    connection.execute(
      "select LUMISECTION,STREAM,"+
      "CTIME as CREATIME,"+
       "inj.ITIME as INJTIME,"+
       "inj.FILESIZE as FILESIZE,"+
       "new.ITIME as NEWTIME,"+
       "cop.ITIME as COPYTIME,"+
       "chk.ITIME as CHKTIME,"+
       "ins.ITIME as INSTIME,"+
       "rep.ITIME as REPACKTIME,"+
       "del.DTIME as DELTIME  "+
       "FROM CMS_STOMGR.FILES_CREATED files                     "+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_INSERTED ins using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_NEW new using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_COPIED cop using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_REPACKED rep using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_TRANS_CHECKED chk using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_DELETED del using (FILENAME)"+
       "LEFT OUTER JOIN CMS_STOMGR.FILES_INJECTED inj using (FILENAME)"+
       "where files.RUNNUMBER=:runnumber"+suffix,
       {'runnumber':run},
     	function(err, result){
    		if (err) {
      		  console.error(err.message);
		  //equiv to (if (!$r), err at oci_execute)
		  excpEscOracle(res,err);
      		  return;
   		}
    		//console.log(result.rows);

		//assumes associative array rows (oracledb outformat set to OBJECT rather than ARRAY)
		var tuples = result.rows;

			retObj = [
			];

		if (aggregate!=null){
                        var ls = 0;
                        var lsobj = undefined;
                        for (var i=0;i<tuples.length;i++){
                                var tls = tuples[i].LUMISECTION;
				var copied = tuples[i].COPYTIME;

                                //stream = tuples[i].STREAM;
                                if (tls>ls) {
                                  if (lsobj!==undefined) {
                                    //normalized by number of streams
                                    //retObj.comp = retObj.copy / retObj.s;
                                    retObj.push(lsobj);
                                    lsobj = undefined;
                                  }
                                  lsobj = {"ls":tls,"copy":(copied!==null), "s":1};// "comp":0}
                                  ls=tls;
                                }
                                if (tls<ls) {
                                  console.log('should not be here, rows unsorted by lumisection in reply from DB')
                                }
                                else {
                                  lsobj.copy = lsobj.copy + (copied!==null);
                                  lsobj.s++;
                                  if (i===tuples.length-1) {
                                    //retObj.comp = retObj.cop / retObj.s;
                                    retObj.push(lsobj);
                                    lsobj = undefined;
                                  }
                                }
                        }
                }
		//review? maybe conditions below if precisely mapped to the php code conditions
		else if (formatchart!=null){	
			retObj = {
				"params": null,
				"serie1": null,
				"serie2": null
			};
                        var transtimes = [];
                        var bandwidth = [];
			var strms = {};
                        for (var i=0;i<tuples.length;i++){
				var copytime = (Date.parse(tuples[i].COPYTIME)-Date.parse(tuples[i].INJTIME))/1000;
				if (!strms.hasOwnProperty(tuples[i].STREAM)){
                                                strms[tuples[i].STREAM] = true;
						transtimes.push({"name":tuples[i].STREAM, "data":[]});
						bandwidth.push({"name":tuples[i].STREAM, "data":[]});
                                }
				var t;
				var b;
				if (xaxis!='size'){
					t = [parseInt(tuples[i].LUMISECTION),copytime];
					b = [parseInt(tuples[i].LUMISECTION),tuples[i].FILESIZE/copytime/1024/1024];
					transtimes[transtimes.length-1].data.push(t);
					bandwidth[transtimes.length-1].data.push(b);
				}else{
					t = [parseInt(tuples[i].FILESIZE),copytime];
                                        b = [parseInt(tuples[i].FILESIZE),tuples[i].FILESIZE/copytime/1024/1024];
                                        transtimes[transtimes.length-1].data.push(t);
                                        bandwidth[transtimes.length-1].data.push(b);
				}
			}
			retObj.params = {"xaxis":(xaxis==undefined) ? null : xaxis}; //assigning a null value to a non-set arg, initially undefined
                        retObj.serie1 = transtimes;
                        retObj.serie2 = bandwidth;
		}else if (formatstrip==null){
			for (var i=0;i<tuples.length;i++){
				var creatime = Date.parse(tuples[i].CREATIME);
				tuples[i].CREATIME = (new Date(creatime)).toUTCString(); //friendlier format
				tuples[i].INJTIME = (Date.parse(tuples[i].INJTIME)-creatime)/1000; //in seconds
				tuples[i].NEWTIME = (Date.parse(tuples[i].NEWTIME)-creatime)/1000;
				tuples[i].COPYTIME = (Date.parse(tuples[i].COPYTIME)-creatime)/1000;
				tuples[i].CHKTIME = (Date.parse(tuples[i].CHKTIME)-creatime)/1000;
				tuples[i].INSTIME = (Date.parse(tuples[i].INSTIME)-creatime)/1000;
				tuples[i].REPACKTIME = (Date.parse(tuples[i].REPACKTIME)-creatime)/1000;
				tuples[i].DELTIME = (Date.parse(tuples[i].DELTIME)-creatime)/1000;
				tuples[i]["COPYBW"] = tuples[i].FILESIZE/(tuples[i].COPYTIME-tuples[i].INJTIME);
			}
			//send reformatted tuples as response
                        retObj = tuples;
		}else{
			var stat = [];
			var streams = {};
			for (var i=0;i<tuples.length;i++){
				if (!streams.hasOwnProperty(tuples[i].STREAM)){
						streams[tuples[i].STREAM] = true;
						var o = {};
						o[tuples[i].STREAM] = {};
						stat.push(o);
				}
				if (formatbinary!=null){
					if (tuples[i].COPYTIME!=null){
						stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = 1;
					}else{
						stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = 0;
					}
				}
				
				if (tuples[i].INJTIME != null){
					stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "INJECTED";
				}
				if (tuples[i].NEWTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "NEW";
                                }
				if (tuples[i].COPYTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "COPIED";
                                }
				if (tuples[i].CHKTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "CHECKED";
                                }
                                if (tuples[i].INSTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "INSERTED";
                                }
                                if (tuples[i].REPACKTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "REPACKED";
                                }
				if (tuples[i].DELTIME != null){
                                        stat[stat.length-1][tuples[i].STREAM][tuples[i].LUMISECTION] = "DELETED";
                                }		
			}
			retObj = stat;	
		}
		sendResult(); 
	
     });
    }); //end oracle access
  }//end exec

  if (run!=undefined){
        exec();
  }else{
	//run ES query and then call exec() in its callback
	var queryJSON = {
	"size":1,
	"sort":{"startTime":"desc"}
	};
    client.search({
     index: 'runindex_cdaq_read',
     type: 'run',
     body : JSON.stringify(queryJSON)
     }).then (function(body){
        var results = body.hits.hits; //hits for query
	var resp = {};
	resp["started"] = results[0]["_source"]["startTime"];
	if (results[0]["_source"].hasOwnProperty("endTime")){
		resp["ended"] = results[0]["_source"]["endTime"];
	}else{
		resp["ended"] = "";
	}
	resp["number"] = results[0]["_source"]["runNumber"];
	run = (run==undefined) ? resp["number"] : run;
	
	exec();
   }, function (error){
	excpEscES(res,error);
        console.trace(error.message);
  });
	
  }

 }//end getFromDB

  if (requestValue=="requestPending"){
  	requestValue = f3MonCacheSec.get(requestKey);
  }

  if (requestValue == undefined){
	f3MonCache.set(requestKey, "requestPending", ttl);
        if (!reply) {
	  getFromDB();
          return null;
        }
        else {
          if (nonblocking !== undefined) {
            res.set('Content-Type', 'text/javascript');
            res.header("Cache-Control", "no-cache, no-store");
            if (cb === undefined)
              res.send(JSON.stringify({}));
            else
              res.send(cb +' ('+JSON.stringify({})+')');
         
             reply=false;
          }
        }
	getFromDB();
  }else{
        if (!reply) {
          return requestValue[0];
        }
        else {
          var srvTime = (new Date().getTime())-eTimeT;
          totalTimes.cached += srvTime;
          console.log('sc_transfer (src:'+remoteAddr+')>responding from cache (time='+srvTime+'ms)');
          res.set('Content-Type', 'text/javascript');
          res.header("Cache-Control", "no-cache, no-store");
          //res.send(cb + ' (' + JSON.stringify(requestValue)+')');  //f3mon format
          if (cb === undefined)
	    res.send(JSON.stringify(requestValue[0]));
          else
            res.send(cb +' ('+JSON.stringify(requestValue[0])+')');
        }
  }

},//end function


runPPquery : function (reqQuery, remoteAddr, res, reply, callback) {

  var ttl = ttls.pp;
  var eTimeT = new Date().getTime();

  var setup = reqQuery.setup;
  var setuptag="";
  var fuprefix="";
  if (setup === "minidaq") setup="cdaq";//same db

  if (setup==="cdaq" || setup==="minidaq") {setuptag='DAQ2';fuprefix='fu-%';}
  if (setup==="dv") {setuptag='DAQ2VAL';fuprefix='dvrubu-%';}

  var cb = reqQuery.cb;//angular callback (optional)

  var requestKey = 'sc_pp?setup='+setup
  var requestValue = f3MonCache.get(requestKey);
  if (requestValue=="requestPending")
  	requestValue = f3MonCacheSec.get(requestKey);

  var retObj = {};

  var sendResult = function(){
     f3MonCache.set(requestKey, [retObj,ttl], ttl);
     var srvTime = (new Date().getTime())-eTimeT;
     totalTimes.queried += srvTime;
     console.log('sc_pp (src:'+remoteAddr+')>responding from query (time='+srvTime+'ms)');
     res.set('Content-Type', 'text/javascript');
     res.header("Cache-Control", "no-cache, no-store");
     if (cb === undefined || cb === null)
       res.send(JSON.stringify(retObj));
     else
       res.send(cb +' ('+JSON.stringify(retObj)+')');
  }

  if (requestValue !== undefined){
    //return from cache
    if (!reply)
      callback(requestValue[0]);
    else {
     var srvTime = (new Date().getTime())-eTimeT;
     console.log('sc_pp (src:'+remoteAddr+')>responding from cache (time='+srvTime+'ms)');
     res.set('Content-Type', 'text/javascript');
     res.header("Cache-Control", "no-cache, no-store");
     if (cb === undefined || cb === null)
       res.send(JSON.stringify(requestValue[0]));
     else
       res.send(cb +' ('+JSON.stringify(requestValue[0])+')');
    }
    return;
  }

  //not found in cache: run query
  f3MonCache.set(requestKey, "requestPending", ttl);

  //connection and query to Oracle DB
  oracledb.getConnection(
    {
       user          : dbInfo[setup][0],//"CMS_DAQ2_HW_CONF_R",
       password      : dbInfo[setup][1],//"mickey2mouse",	//change this before any git push!
       connectString : dbInfo[setup][2]//"cmsonr1-v.cms:10121/cms_rcms.cern.ch"
    },
    function(err, connection)
    {
      if (err) {
        	console.error(err.message);
		//equiv to (if (!$conn), err at oci_connect)
                if (!reply)
                  callback(null);
                else
		  excpEscOracle(res,err);
    		return;
      }

      //TODO:support daq2val query & DB params
      console.log(setuptag)

      connection.execute(
        "select attr_name, attr_value, d.dnsname from "+
        "DAQ_EQCFG_HOST_ATTRIBUTE ha,"+
        "DAQ_EQCFG_HOST_NIC hn,"+
        "DAQ_EQCFG_DNSNAME d "+
        "where "+                                                 
        "ha.eqset_id=hn.eqset_id AND "+
        "hn.eqset_id=d.eqset_id AND "+                          
        "ha.host_id = hn.host_id AND "+                           
        "ha.attr_name like 'myBU!_%' escape '!' AND "+
        "hn.nic_id = d.nic_id AND "+           
        "d.dnsname like :fuprefix "+                             
        "AND d.eqset_id = (select eqset_id from DAQ_EQCFG_EQSET "+
        "where tag=:setuptag AND "+
        "ctime = (SELECT MAX(CTIME) FROM DAQ_EQCFG_EQSET WHERE tag=:setuptag))",
//        "where tag='DAQ2' AND "+
//        "ctime = (SELECT MAX(CTIME) FROM DAQ_EQCFG_EQSET WHERE tag='DAQ2'))",
        {'setuptag':setuptag,'fuprefix':fuprefix},
        function(err, result){
    	  if (err) {
      	    console.error(err.message);
            //clear key on error?
	    //f3MonCache.set(requestKey, [{},ttl], ttl);
            if (!reply)
              callback(null);
            else
              excpEscOracle(res, err);
      	    return;
   	  }
	  var tuples = result.rows;
	  retObj = {
          };

          for (var i=0;i<tuples.length;i++) {
            var bu = tuples[i].ATTR_VALUE;
            bu = bu.substring(0,bu.indexOf('.'));
            var fu = tuples[i].DNSNAME;
            fu = fu.substring(0,fu.indexOf('.'));
            //if (fu.indexOf('.')!==fu.indexOf('.cms')) continue; //skip data addr

            if (retObj.hasOwnProperty(bu)) {
              var mybu = retObj[bu];
              var found=false;
              for (var myfu in mybu) {
                if (mybu[myfu]===fu) {
                  found=true;
                  break;
                }
              }
              if (!found)
                mybu.push(fu)
            }
            else
              retObj[bu] = [fu];
          }
          //overwrite obj, put in cache
	  f3MonCache.set(requestKey, [retObj,ttl], ttl);
          if (!reply)
            callback(retObj);
          else
            sendResult();
        }); //oracle query callback

    });//connection

  }//query function

}//end exports

