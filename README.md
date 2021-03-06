F3 Monitor Web Interface
==========================
Web interface for F3 infrastructure based on Elasticsearch engine.

##Development notes

Requirements: node.js, bower, grunt, npm

This file describes setup and compilation of browser F3mon component. For Node.js based web server installation and full deployment, see node-server/Readme.md

##Run as sudo / root
```
yum install npm

npm install -g grunt-cli

npm install -g bower
```

##Run unpriviledged in source dir to install dev environment
```
npm install grunt grunt-connect-proxy load-grunt-tasks time-grunt jshint-stylish grunt-autoprefixer grunt-concurrent grunt-contrib-clean grunt-contrib-concat grunt-contrib-connect grunt-contrib-copy grunt-contrib-cssmin grunt-contrib-htmlmin grunt-contrib-imagemin grunt-contrib-jshint grunt-contrib-uglify grunt-contrib-watch grunt-filerev grunt-google-cdn grunt-karma grunt-newer grunt-ng-annotate grunt-php grunt-svgmin grunt-usemin grunt-wiredep grunt-php karma
```

##Run unpriviledged in source dir to install f3mon dependencies
```
bower install
```

#Notes:
```
- Overrides are present in bower.json to force loading highstock drilldown module and fix an issue between latest bootstrap and bower definition
```

#Run Dev server (optional):
#grunt serve (note: If it returns no errors but server doesnt start, try again and again )

#Build
```
grunt build (note: Disabled the uglify process due to some conflict with angular )
```

#Assembling server directory (if not updating individual directories/files)
```
cd node-server/web/sc
npm install
cd -
```
```
cp -RL node-server/* /tmp/prod
```
dbinfo.json should be taken from previous area.


##Optionals and tips:

#Install external library and keep it as part of future bower setups
```
bower install <libname> --save
```

#Install node.js components
```
sudo npm install -g <componen-name> #(this will install globally for usage in every project, need sudo priviledges)

npm install <componen-name> #(for installing locally)
```
