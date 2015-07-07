F3 Monitor Web Interface
==========================
Web interface for F3 infrastructure based on Elasticsearch engine.

##Development notes

Requirements: node.js, bower, grunt, npm

##Run as sudo / root
```
yum install npm

npm install grunt-cli
```
##Run as local user in f3mon source directory to install dev environment
```
npm install bower

npm install grunt

./node_modules/bower/bin/bower install

#./node_modules/bower/bin/bower install highcharts-ng

npm install grunt-connect-proxy

npm install load-grunt-tasks

npm install time-grunt

npm install jshint-stylish

npm install grunt-autoprefixer grunt-concurrent grunt-contrib-clean grunt-contrib-concat grunt-contrib-connect grunt-contrib-copy grunt-contrib-cssmin grunt-contrib-htmlmin grunt-contrib-imagemin grunt-contrib-jshint grunt-contrib-uglify grunt-contrib-watch grunt-filerev grunt-google-cdn grunt-karma grunt-newer grunt-ng-annotate grunt-php grunt-svgmin grunt-usemin grunt-wiredep grunt-php
```
#install DEV enviroment (obsolete):

npm install

bower install

#Notes:
- At present time, highcharts-ng lib need to be updated manually:
    ```
    cd bower_components/highcharts-ng/dist;
    mv highcharts-ng.js highcharts-ng.js.old;
    wget https://rawgithub.com/pablojim/highcharts-ng/master/src/highcharts-ng.js;
    cd -;
    ```

- The Highstock library doesnt load the drilldown module as default, so add the "modules/drilldown.js", in bower_components/highstock-release/bower.json 

#Run Dev server (optional):
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

