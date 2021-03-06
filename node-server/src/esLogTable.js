'use strict';

var Common = require('./esCommon');
module.exports = new Common()

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}


//for text fields
var searchParse = function(qstring) {
  if (qstring != ''){
    //if (qstring.indexOf("*") === -1 && qstring.indexOf("?")){
      //  return '*'+qstring+'*';
      //} else {
	if (qstring.indexOf("*") === -1 && qstring.indexOf("?")===-1 && qstring.indexOf("\\")==-1 &&  qstring.indexOf("OR")==-1 &&  qstring.indexOf("AND")==-1)
	  return "("+qstring + ") OR (" + searchParseW(qstring)+")";
	else
	  return qstring;
	//}
  }
  return '*';
}

//combine with
var searchParseW = function(qstring) {
  if (qstring != ''){
    if (qstring.indexOf("*") === -1 && qstring.indexOf("?")===-1){
      return '*'+qstring+'*';
    } else {
      return qstring;
    }
  }
  return '*';
}



module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'logtable';

    //if (verbose) console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'logtable request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_run = this.checkDefault(req.query.run,0);
    qparam_run = parseInt(qparam_run);
    var qparam_from = this.checkDefault(req.query.from,0);
    var qparam_size = this.checkDefault(req.query.size,100);
    var qparam_sortBy = this.checkDefault(req.query.sortBy,'');
    var qparam_sortOrder = this.checkDefault(req.query.sortOrder,'');
    var qparam_search = this.checkDefault(req.query.search,'*');
    var qparam_searchMode = this.checkDefault(req.query.searchMode,'0');
    var qparam_startTime = this.checkDefault(req.query.startTime,'now');
    if (qparam_startTime==='NaN') qparam_startTime = 'now';
    var qparam_endTime = this.checkDefault(req.query.endTime,'now');
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');
    var qparam_truncateAt = parseInt(this.checkDefault(req.query.truncateAt,16184));
    var qparam_docType = this.checkDefault(req.query.docType,"hltdlog,cmsswlog");
    var htmlFormat=true;

    //show last 5 min if no run is selected / active
    if (qparam_startTime=='now' && qparam_endTime=='now') qparam_endTime='now-5m';

    if (parseInt(qparam_size)+parseInt(qparam_from)>=10000) if (parseInt(qparam_from)<10000) qparam_size=10000-parseInt(qparam_from); else {qparam_size=1000;qparam_from=0};

    var requestKey = qname+'?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy
                     +'&sortOrder='+qparam_sortOrder+'&search='+qparam_search+'&startTime='
                     +qparam_startTime+'&endTime='+qparam_endTime+'&sysName='+qparam_sysName;

    var ttl = global.ttls.logtable; //cached ES response ttl (in seconds)

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {

      //parameterize query
      this.queryJSON1.size = qparam_size;
      this.queryJSON1.from = qparam_from;
      this.queryJSON1.query.bool.should[1].bool.must[0].range.date.from = qparam_startTime;
      this.queryJSON1.query.bool.should[1].bool.must[0].range.date.to = qparam_endTime;
      this.queryJSON1.query.bool.should[0].term.run = qparam_run;
      this.queryJSON1.query.bool.must_not=[];
      this.queryJSON1.query.bool.must.length=1;

      qparam_search=qparam_search.replace(":","\\:");

      var conditions = qparam_search.split(';');
      var _this = this;
      if (qparam_searchMode=='1') { //conditions which all must be exvcluded
        if (qparam_search!="" && qparam_search!="*")
          conditions.forEach(function (conditem) {
	      _this.queryJSON1.query.bool.must_not.push( {query_string: {query : searchParseW(conditem.trim())}});
	    });
      }
      else { //conditions where any match is include
	if (conditions.length===1) {//old
	    _this.queryJSON1.query.bool.must.push({query_string: {query : searchParse(qparam_search.trim())}});
        }
	else {
	    _this.queryJSON1.query.bool.must.push({ bool: {should :[]}}); 
	    conditions.forEach(function (conditem) {
	      _this.queryJSON1.query.bool.must[1].bool.should.push( {query_string: {query : searchParse(conditem.trim())}});
	    });
	}
      }

      var missing = '_last';
      if (qparam_sortOrder == 'desc'){
	missing = '_first';
      }

      this.queryJSON1.sort = { "date": {  "order": "asc" }}

      if (qparam_sortBy != '' && qparam_sortOrder != ''){
	var inner = {
	  "order" : qparam_sortOrder,
	  "missing" : missing
	};
	var temp = {};
	temp[qparam_sortBy] = inner;
	var outer = temp;
	this.queryJSON1.sort = outer;
      }

      global.client.search({
        index: 'hltdlogs_'+qparam_sysName+'_read',
        type: qparam_docType,
        body: JSON.stringify(_this.queryJSON1)
      }).then (function(body){
        try {
        took+=body.took
        var results = body.hits.hits; //hits for query
        if (body.hits.length==0){
          //send empty response if hits list is empty
          res.send();
          return;
        }else{
          var total = body.hits.total;
          var ret = [];
	  for (var index = 0 ; index < results.length; index++) {
            if (results[index]._source.hasOwnProperty('message')) {
              var msgtokens = results[index]._source.message.split('\n');
              var msgout = "";
              var msgoutlen = 0;
              var seenThreadTrace=false;
              var traceCount = 0
              var threadMode=false;
              var allThreads=false;
              var tcmax=5;
              for (var idx=0;idx<msgtokens.length;idx++) {
                var token = msgtokens[idx]
                var msglen = token.length;
                if (token.startsWith('Thread')) {
                  tcmax=5;
                  threadMode=true;
                  if (htmlFormat)
                  token = token.replace(/Thread/,'<b>Thread</b>')
                  seenThreadTrace=true;
                  traceCount=0
                  if (token.startsWith('Thread 1')) allThreads=true;
                }
                else {
                  if (seenThreadTrace)
                    traceCount++;
                  if (token.indexOf('stacktrace')!=-1 || token.indexOf('sig_dostack')!=-1) {traceCount=0;tcmax=10;}
                }
                if (traceCount<=tcmax) {//take only 5 lines from stack trace
                  if (htmlFormat) {
                    msgout+=token+'<br>';
                    msglen+=msglen+3;
                  } else {
                    msgout+=token+'\n';
                    msglen+=msglen+2;
                  }
                  msgoutlen+=msglen;
                }
                else if (traceCount==6){
                  if (htmlFormat) {
                    msgout+='[...]<br>';
                    msglen+=msglen+8;
                  } else {
                    msgout+='[...]\n';
                    msglen+=msglen+7;
                  }
                  msgoutlen+=msglen;
                }
                if (qparam_truncateAt>0 && msgoutlen>qparam_truncateAt && idx+1<msgtokens.length && (!threadMode || allThreads))  {
                  if (htmlFormat)
                    msgout+="<br> <b>[ message truncated ]</b> <br>";
                  else
                    msgout+="\n [ message truncated ] \n";
                  break;
                }
              }
              results[index]._source.message=msgout
            }
            /*try {
              if (qparam_truncateAt>0 && results[index]._source.message.length>qparam_truncateAt) {
                if (htmlFormat) {
                  results[index]._source.message = results[index]._source.message.substr(0,qparam_truncateAt).replace(/\n/g,'<br>');
                  results[index]._source.message+="<br> <b>[ message truncated ]</b> <br>"
                }
                else {
                  results[index]._source.message = results[index]._source.message.substr(0,qparam_truncateAt);
                  results[index]._source.message+="\n [ message truncated ] \n"
                }
              }
              else {
                if (htmlFormat)
                  results[index]._source.message = results[index]._source.message.replace(/\n/g,'<br>');
              }
            } catch (e) {}*/
              
	    ret[index] = results[index]._source;
	  }
	  var retObj = {
	    "iTotalRecords" : total,
	    "iTotalDisplayRecords" : total,
	    "aaData" : ret,
	    "lastTime" : body.aggregations.lastTime.value,
            "docType" : qparam_docType
	  };

          var q3=function() {
            //gt count of CMSSW messages
            var queryJSON2 = JSON.parse(JSON.stringify(_this.queryJSON1));
            queryJSON2.size=0
            queryJSON2.from=0
            delete queryJSON2.aggs;
            qparam_docType='hltdlog'

            global.client.search({
              index: 'hltdlogs_'+qparam_sysName+'_read',
              type: qparam_docType,
              body: JSON.stringify(queryJSON2)
            }).then (function(body) {
                try {
                took+=body.took
                retObj.hltdTotal = parseInt(body.hits.total); //hits for query
                _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
                } catch (e) {_this.exCb(res,e,requestKey)}
              }
              ,function (error){
                _this.excpEscES(res,error,requestKey);
                console.trace(error.message);
            });
          }

          var q2=function() {
            //gt count of CMSSW messages
            var queryJSON2 = JSON.parse(JSON.stringify(_this.queryJSON1));
            queryJSON2.size=0
            queryJSON2.from=0
            delete queryJSON2.aggs;
            qparam_docType='cmsswlog'

            global.client.search({
              index: 'hltdlogs_'+qparam_sysName+'_read',
              type: qparam_docType,
              body: JSON.stringify(queryJSON2)
            }).then (function(body) {
                try {
                took+=body.took
                retObj.hltTotal = parseInt(body.hits.total); //hits for query
                retObj.hltdTotal = parseInt(retObj.iTotalRecords) - retObj.hltTotal
                if (qparam_docType!=='hltdlog' && qparam_docType!=='cmsswlog')
                  //both types searched commonly
                  _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
                else {
                  //need another query to find out hltdlog doc count
                  q3()
                }
                } catch (e) {_this.exCb(res,e,requestKey)}
              }
              ,function (error){
                _this.excpEscES(res,error,requestKey);
                console.trace(error.message);
            });
          }

          q2();
          //_this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        }                  
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error);
        console.trace(error.message);
      });

    }
  }

module.exports.findLog = function (req, res) {

    try {
      var qparam_setup = checkDefault(req.query.setup,"cdaq");
      var qparam_run = parseInt(req.query.run);
      var qparam_fu = checkDefault(req.query.fu,null);
      var qparam_pid = parseInt(req.query.pid);
      if (qparam_fu===null) throw "No FU parameter";
    } catch (e) {
      res.set('Content-Type', 'text/javascript');
      res.header("Cache-Control", "no-cache, no-store");
      res.send(JSON.stringify({error:"Malformed request parameters: "+e.message}));
    }

    var queryJSON = {"query":{"bool":{"must":[ {"term":{"run":qparam_run}},{"term":{"host":qparam_fu}},{"term":{"pid":qparam_pid}}]}}};

    var _this = this
 
    global.client.search({
        index: 'hltdlogs_'+qparam_setup+'_read',
        type: 'cmsswlog',
        body: JSON.stringify(queryJSON)
      }).then (function(body){
        try {
        var results = body.hits.hits; //hits for query

        retObj = {"results":[]}

        if (results.length==0)
          retObj["error"]="No log message document found";
        else
          for (var i=0;i<results.length;i++) {
            retObj["results"].push(results[i]['_source']);
          }
	res.set('Content-Type', 'text/javascript');
        res.header("Cache-Control", "no-cache, no-store");
        res.send(JSON.stringify(retObj)); //non-cached

        } catch (e) {_this.exCb(res,e,requestKey)}
 
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });
  }




module.exports.dump = function (req, res) {

    var took = 0;
    var qname = 'logdump';

    //if (verbose) console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'logtable request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_run = this.checkDefault(req.query.run,0);
    qparam_run = parseInt(qparam_run);
    var qparam_size = this.checkDefault(req.query.size,100);
    var qparam_search = this.checkDefault(req.query.search,'*');
    var qparam_searchMode = this.checkDefault(req.query.searchMode,'0');
    var qparam_startTime = this.checkDefault(req.query.startTime,'now');
    if (qparam_startTime==='NaN') qparam_startTime = 'now';
    var qparam_endTime = this.checkDefault(req.query.endTime,'now');
    var qparam_sysName = this.checkDefault(req.query.sysName,'cdaq');
    var qparam_docType = this.checkDefault(req.query.docType,"hltdlog,cmsswlog");
    var qparam_key = this.checkDefault(req.query.key,"");
    var htmlFormat=true;//todo:JSON

    //show last 5 min if no run is selected / active
    if (qparam_startTime=='now' && qparam_endTime=='now') qparam_endTime='now-5m';

    var requestKey = qname+'?size='+qparam_size+'&search='+qparam_search+'&startTime='
                     +qparam_startTime+'&endTime='+qparam_endTime+'&sysName='+qparam_sysName;

      //parameterize query
    this.queryJSON1.size = qparam_size;
    this.queryJSON1.query.bool.should[1].bool.must[0].range.date.from = qparam_startTime;
    this.queryJSON1.query.bool.should[1].bool.must[0].range.date.to = qparam_endTime;
    this.queryJSON1.query.bool.should[0].term.run = qparam_run;
    this.queryJSON1.query.bool.must_not=[];
    this.queryJSON1.query.bool.must.length=1;

    //sorting
    //delete this.queryJSON1.sort;
    this.queryJSON1.size=10000;
    this.queryJSON1.sort = { "date": {  "order": "asc" }}

    qparam_search=qparam_search.replace(":","\\:");

    var conditions = qparam_search.split(';');
    var _this = this;

    if (qparam_searchMode=='1') { //conditions which all must be exvcluded
      if (qparam_search!="" && qparam_search!="*")
        conditions.forEach(function (conditem) {
          _this.queryJSON1.query.bool.must_not.push( {query_string: {query : searchParseW(conditem.trim())}});
	});
    }
    else { //conditions where any match is include
      if (conditions.length===1) {//old
        _this.queryJSON1.query.bool.must.push({query_string: {query : searchParse(qparam_search.trim())}});
      }
      else {
        this.queryJSON1.query.bool.must.push({ bool: {should :[]}}); 
	conditions.forEach(function (conditem) {
	  _this.queryJSON1.query.bool.must[1].bool.should.push( {query_string: {query : searchParse(conditem.trim())}});
	});
      }
    }

    var retObj = {
      "iTotalRecords" : 0,
      "aaData" : [],
      "docType" : qparam_docType,
      "key":qparam_key
    } ;
    //console.log( JSON.stringify(_this.queryJSON1))

    global.client.search({
        index: 'hltdlogs_'+qparam_sysName+'_read',
        type: qparam_docType,
        body: JSON.stringify(_this.queryJSON1),
	scroll: '2m'
      }, function repeat(error,body){
        if (error) {
          _this.excpEscES(res,error,requestKey);
          console.trace(error.message);
	  return;
	}
        try {
	  console.log((retObj.aaData.length+body.hits.hits.length) + " / " + body.hits.total);
          took+=body.took
          var total = body.hits.total;
          var results = body.hits.hits; //hits for query
	  body.hits.hits.forEach(function(hit) {
	    //formatting
            if (hit._source.hasOwnProperty('message')) {
	      if (htmlFormat)
                hit._source.message=hit._source.message.replace(/\n/g,"<br>");
            }
            if (hit._source.hasOwnProperty('date')) {
	        hit._source.date = new Date(hit._source.date).toISOString();
	    }
	    //console.log(hit._source.message)
	    retObj.aaData.push(hit._source);
	  });
	  retObj.iTotalRecords=total;
	  if (total>retObj.aaData.length) {
	    client.scroll({
	      scrollId: body._scroll_id,
	      scroll: '30s'
	    }, repeat);
	  }
	  else
            _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,-1,took);
        }                  
        catch (e) {_this.exCb(res,e,requestKey)}
    });
  }



