'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'runListTable';
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+'runListTable request');
    var eTime = this.gethrms();
    var cb = req.query.callback;

    //GET query string params
    var qparam_from = req.query.from;
    var qparam_size = req.query.size;
    var qparam_sortBy = req.query.sortBy;
    var qparam_sortOrder = req.query.sortOrder;
    var qparam_search = req.query.search;
    var qparam_sysName = req.query.sysName;

    if (qparam_from == null){qparam_from = 0;}
    if (qparam_size == null){qparam_size = 100;}
    if (qparam_sortBy == null){qparam_sortBy = '';}
    if (qparam_sortOrder == null){qparam_sortOrder = '';}
    if (qparam_search == null){qparam_search = '';}
    if (qparam_sysName == null){qparam_sysName = 'cdaq';}

    var requestKey = qname+'?from='+qparam_from+'&size='+qparam_size+'&sortBy='+qparam_sortBy+'&sortOrder='+qparam_sortOrder+'&search='+qparam_search+'&sysName='+qparam_sysName;
    var ttl = global.ttls.runListTable; //cached ES response ttl (in seconds)

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
      //parameterize query fields
      this.queryJSON1.size =  qparam_size;
      this.queryJSON1.from = qparam_from;

      var missing = '_last';
      if (qparam_sortOrder == 'desc'){
	missing = '_first';
      }

      if (qparam_sortBy != '' && qparam_sortOrder != ''){
	var inner = {
	  "order" : qparam_sortOrder,
	  "missing" : missing
	};
	var temp = {};
	temp[qparam_sortBy] = inner;
	var outer = [temp]; //follows rltable.json format for sort
	this.queryJSON1.sort = outer;
      }

      var qsubmitted = this.queryJSON1;
      //only filter if more than 2 characters specified
      if (qparam_search != '' && qparam_search.length>2){
	var searchText = qparam_search;
        var doSearch = true;
	if (qparam_search.indexOf("*") === -1){
	  searchText = '*'+qparam_search+'*';
        }
        else if (qparam_search.length<=3)
          doSearch=false;
        if (doSearch) {
          var filterQ = searchText.replace(/\*/g,"");

	  if (searchText[0]=='*' && searchText[searchText.length-1]==='*')
	    qsubmitted["query"] = {"script":{"script":{"inline":"doc[\"runNumber\"].value.toString().contains(\""+filterQ+"\")"}}}
          else if (searchText[searchText.length-1]==='*')
	    qsubmitted["query"] = {"script":{"script":{"inline":"doc[\"runNumber\"].value.toString().startsWith(\""+filterQ.replace(/\*/g,"")+"\")"}}}
          else if (searchText[0]==='*')
	    qsubmitted["query"] = {"script":{"script":{"inline":"doc[\"runNumber\"].value.toString().endsWith(\""+filterQ.replace(/\*/g,"")+"\")"}}}
        }
        else {
	  delete qsubmitted["query"];
        }
      }else{
	delete qsubmitted["query"];
      }

      var _this = this
      //search ES
      global.client.search({
        index:'runindex_'+qparam_sysName+'_read',
        type: 'run',
        body: JSON.stringify(qsubmitted)
      }).then (function(body){
        try {
        took+=body.took
        var results = body.hits.hits; //hits for query

	//format response content here
	var total = body.aggregations.total.value;
	var filteredTotal = body.hits.total;

	var arr = [];
	for (var index = 0 ; index < results.length; index++){
	  arr[index] = results[index]._source;
	}
	var retObj = {
	  "iTotalRecords" : total,
	  "iTotalDisplayRecords" : filteredTotal,
	  "aaData" : arr
	};
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      }, function (error){
        _this.excpEscES(res,error,requestKey);
        console.trace(error.message);
      });

    }
  }

