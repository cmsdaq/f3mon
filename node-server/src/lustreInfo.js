'use strict';
/*
var rq = require('request')

var Common = require('./esCommon');
module.exports = new Common()

module.exports.setupAuth = function(dbinfo) {
    this.auth_username = dbinfo['lustre_info'][0];
    this.auth_password = dbinfo['lustre_info'][1];
}

module.exports.query = function (req, res) {

    var took = 0;
    var qname = 'lustreInfo';
 
    //console.log('['+(new Date().toISOString())+'] (src:'+req.connection.remoteAddress+') '+"getIndices request");
    var eTime = this.gethrms();
    var cb = req.query.callback;

    var requestKey = 'lustreInfo';
    var ttl = global.ttls.lustreInfo; //cached ES response ttl (in seconds) 
    var _this = this;

    if (this.respondFromCache(req,res,cb,eTime,requestKey,qname,ttl) === false) {
      console.log(new Date() + ' - running Lustre occupancy query');
 
      var reply = {}
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

      const options = {
        //url:'https://cms-icinga2.cms:5665/v1/objects/services?service=mrg-c2f12-25-01%21Lustre%20occupancy',
        url:'https://srv-c2f44-34-01.cms:5665/v1/objects/services?service=mrg-c2f12-25-01%21Lustre%20occupancy',
        method:'GET',
      }

      rq(options, function (error,response,body) {
        if (error) {
          //console.log(error)
          reply["ERROR"]="HTTP error: "+JSON.stringify(error);
        }
        else if (response.statusCode==200 || response.statusCode==201) {
        //console.log(response.statusCode)
        var jsbody = JSON.parse(body);
        var output_string = jsbody["results"][0]["attrs"]["last_check_result"]["output"]
        //console.log(output_string.match("/free space: \/store\/lustre .+ GB \\(([0-9\\.]+)% inode=/"));
        var matched = output_string.match("free space: \/store\/lustre .+ GB \\(([0-9\\.]+)% inode=")
        if (matched && matched.length>=2) {
          var free = matched[1]
          if (isNaN(free))
	    reply["ERROR"]="No valid occupancy information";
          else
            reply["occupancy"]=(1.-free/100.);
          //console.log(free);
        }
        else {
          reply["ERROR"]="No matching information in server response";
        }
      }
      else {
        reply["ERROR"]="No information available. Server returned code: "+ response.statusCode;
      }
      reply["responseTime"]= new Date();
      //console.log(reply)

      _this.sendResult(req,res,requestKey,cb,false,reply,qname,eTime,ttl,took);
    })
    .auth(this.auth_username,this.auth_password)
  }
}
*/
