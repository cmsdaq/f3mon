F3 Monitor Web Interface
==========================
Web interface for F3 infrastructure based on Elasticsearch engine.

##Development notes

Requirements: node.js, bower, grunt, npm

##Run as sudo / root
```
yum install npm

npm install grunt-cli

npm install -g bower
```

##Run as local user in f3mon source directory to install dev environment
```
bower install

npm install grunt grunt-connect-proxy load-grunt-tasks time-grunt jshint-stylish grunt-autoprefixer grunt-concurrent grunt-contrib-clean grunt-contrib-concat grunt-contrib-connect grunt-contrib-copy grunt-contrib-cssmin grunt-contrib-htmlmin grunt-contrib-imagemin grunt-contrib-jshint grunt-contrib-uglify grunt-contrib-watch grunt-filerev grunt-google-cdn grunt-karma grunt-newer grunt-ng-annotate grunt-php grunt-svgmin grunt-usemin grunt-wiredep grunt-php
```

#Notes:
- At present time, highcharts-ng lib file need to be updated manually to the latest version:

    ```
    . update-highcharts-ng.sh 
    ```

- Overrides are present in bower.json to force loading highstock drilldown module and fix an issue between latest bootstrap and bower definition

#Run Dev server (optional):
grunt serve (note: If it returns no errors but server doesnt start, try again and again )

#Build
grunt build (note: Disabled the uglify process due to some conflict with angular )


##Optionals:

#Install external library and keep it as part of future bower setups
bower install <libname> --save

#Install node.js components
sudo node install -g <componen-name> #(this will install globally for usage in every project, need sudo priviledges)

node install <componen-name> #(for installing locally)

#highchart installation
bower install highstock-release --save

