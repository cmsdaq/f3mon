'use strict';

var Common = require('./esCommon');
module.exports = new Common()

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'getIndices';
 
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"getIndices request");
    var eTime = this.gethrms();
    var cb = req.query.callback;

    var requestKey = 'getIndices';
    var ttl = global.ttls.getIndices; //cached ES response ttl (in seconds) 

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
      var _this = this

      global.client.cat.aliases({
       name: 'runindex*read'}
      ).then(function (body) {
        try {
        took+=body.took
        //console.log('received response from ES :\n'+body+'\nend-response');
        var aliasList = [];

        var alias_infos = body.split('\n');
        //console.log(alias_infos);
        for(var alias_info in alias_infos) {
          if (!alias_infos[alias_info].length) continue;
          //console.log(alias_infos[alias_info]);
          var info = alias_infos[alias_info].replace(/\s+/g,' ').trim().split(' ');
          var mySubsys = info[0].split("_")[1];
          var myAlias = info[0];
          var myIndexType = info[1].split("_")[0];
          if (myAlias.indexOf(myIndexType)!==0) continue;//skip if not starting with runindex
          //this should be done by makig aliasList a set (list(set()) python equivalent
          var alreadyListed=false;
          aliasList.forEach(function(item){if (item.subSystem===mySubsys) alreadyListed=true;});
          if (!alreadyListed)
            aliasList.push({"subSystem":mySubsys,"index":myAlias})
        }
        aliasList.sort(function(a,b){if (a.subSystem>b.subSystem) return true; else return false;});
        var retObj = {'list':aliasList};
        _this.sendResult(req,res,requestKey,cb,false,retObj,qname,eTime,ttl,took);
        } catch (e) {_this.exCb(res,e,requestKey)}
      },
      function(error) {
	_this.excpEscES(res,error,requestKey);
        console.trace(error)
    });
  }
}

