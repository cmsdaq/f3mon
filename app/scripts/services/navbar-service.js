'use strict';

/**
 * @ngdoc service
 * @name f3monApp.navbar
 * @description
 * # core
 * Factory in the f3monApp.
 */

(function() {
angular.module('f3monApp')

//Service for the system selector
.factory('indexListService', function($resource,$rootScope,poller,config) {    
    var mypoller;
    var resource =  $resource('api/getIndices.php', {
            callback: 'JSON_CALLBACK',
        }, {
            jsonp_get: {
                method: 'JSONP',
            }
    });

    var mypoller = poller.get(resource, {
        action: 'jsonp_get',
        delay: config.fastPollingDelay,
        smart: true
    });

    mypoller.promise.then(null, null, function(data) {

        //console.log(data);
        if (data.list && data.list.length != 0) {
            indices.setList(data.list);
            mypoller.stop();
        } else {
            console.log('Empty Indices List');
        }
    })

    var indices ={}
        indices.selected = {};
        indices.selected.index = "";
        indices.selected.subSystem = "";
        indices.list = [];
        indices.setList = function(list){
            if (list.length === 0){console.log('Empty Indices List'); return; };            
            this.list = list;
            this.broadcast('list');
            this.select(config.defaultSubSystem)
        };
        indices.select = function(subSystem){
            var item = $.grep(this.list, function(e){ return e.subSystem == subSystem; })[0];
            if (!item){console.log("Invalid subSystem: "+subSystem); return;};
            this.selected.index = item.index;
            this.selected.subSystem = item.subSystem;
            this.broadcast('selected');
        };
        indices.broadcast = function(msg){
            $rootScope.$broadcast('indices.'+msg);
        }

    return indices;
})

//Service for the run ranger button
.factory('runRangerService', function($resource,$rootScope,config,poller,indexListService, runInfoService) {
    var mypoller;
    var resource = $resource('api/runList.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP'
        }
    });

    var runRanger = {};
    runRanger.isActive = true;

    runRanger.start = function(){
        if(!this.isActive){return};
        if (angular.isUndefined(mypoller)) {
            // Initialize poller and its callback
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true,
                argumentsArray:[{sysName:indexListService.selected.subSystem,size:1}]
            });
            mypoller.promise.then(null, null, function(data) {
                if (data.runlist.length != 0 && !data.runlist[0].endTime){
                    runInfoService.select(data.runlist[0].runNumber);
                };
            })
        } else{
            //Restart poller
            mypoller = poller.get(resource, {argumentsArray:[{sysName:indexListService.selected.subSystem,size:1}]});
        }
    };

    runRanger.toggle = function(){
        this.isActive = !this.isActive;
        if(this.isActive){runRanger.start()}
            else{mypoller.stop()}
        this.broadcast('status');
    };

    runRanger.shutdown = function(){
        mypoller.stop();
        this.isActive = false;
        this.broadcast('status');
    };

    runRanger.broadcast = function(msg) {
        $rootScope.$broadcast('runRanger.'+msg);
    };

    $rootScope.$on( 'indices.selected', function( event ) {
        runRanger.start();
    });

    return runRanger;
})


//Service for the river status button
.factory('riverStatusService', function($resource,$rootScope,config,poller,runInfoService,indexListService) {
    var mypoller;

    var resource = $resource('api/riverStatus.php', {
        callback: 'JSON_CALLBACK',
    }, {
        jsonp_get: {
            method: 'JSONP'
        }
    });
    
    var river = {};
    river.messages = [{msg:'Loading...',color:'orange'}];
    river.isWorking = false;
    river.main = false; //it need to be running at the beginning
    river.collector = true; //it doesn't need to be running at the beginning
    
    river.restart = function(){
        if (angular.isUndefined(mypoller)) {
            // Initialize poller and its callback
            mypoller = poller.get(resource, {
                action: 'jsonp_get',
                delay: config.fastPollingDelay,
                smart: true
            });
        
            mypoller.promise.then(null, null, function(data) {
                var item = $.grep(data.systems, function(e){ return e.subSystem == indexListService.selected.subSystem; })[0];
                if(item){river.main = item;} else {river.main = false;}
                if(runInfoService.runNumber && runInfoService.isRunning){
                    item = $.grep(data.runs, function(e){ return e.runNumber == runInfoService.runNumber; })[0];
                    if(item){river.collector = item;}
                    else {river.collector = false};
                } else {river.collector = true}       
                river.updateMessages();
            })
        }else {
            //Restart poller
            mypoller.restart();    
        }
    }

    river.updateMessages = function(){
        this.isWorking = (this.main && this.collector);
        if(this.main){this.messages[0] = {msg:"Main role running on server: "+this.main.host,isWorking:true}}
            else {this.messages[0] = {msg:"Main role running on server: "+this.main.host,isWorking:true}}

        if(this.collector){
            if(this.collector.status)
                {this.messages[1]={msg:"Collector for run "+runInfoService.runNumber+" is running on server: "+this.collector.host,isWorking:true}}
            else {if(this.messages.length >1){this.messages.splice(1,1);}}
        } else {this.messages[1]={msg:"Collector for run "+runInfoService.runNumber+" is not running" ,isWorking:false}}
        this.broadcast('updated');
    };

    river.broadcast = function(msg) {
        $rootScope.$broadcast('riverStatus.'+msg);
    };

    $rootScope.$on( 'runInfo.updated', function( event ) {
        river.restart();
    });
    $rootScope.$on( 'runInfo.selected', function( event ) {
        river.restart();
    });

    $rootScope.$on( 'indices.selected', function( event ) {
        river.restart();
    });

    return river;
})
})();