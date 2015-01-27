F3 Monitor Web Interface
==========================
Web interface for F3 infrastructure based on Elasticsearch engine.

##Development notes
Requirements: node.js, bower, grunt

#install DEV enviroment
npm install
bower install

Notes:
- At present time, highchart-ng lib need to be updated manually:
    cd bower_components/highchart-ng/dist
    wget https://rawgithub.com/pablojim/highcharts-ng/master/src/highcharts-ng.js
    mv highcharts-ng.js highcharts-ng.js.old
    mv highcharts-ng.js.1 highcharts-ng.js

- The Highstock library doesnt load the drilldown module as default, so add the "modules/drilldown.js", in bower_components/highstock-release/bower.json 

#Run Dev server:
grunt serve (note: If it returns no errors but server doesnt start, try again and again )

#Build
grunt build (note: Disabled the uglify process due to some conflict with angular )


##Optionals:

#Install external library
bower install <libname> --save

#Install node.js component
sudo node install -g <componen-name> (this will install globally for usage in every project, need sudo priviledges)
node install <componen-name> (for install locally)

#highchart installation
bower install highstock-release --save

