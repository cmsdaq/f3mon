#installation:

#required for oracle compilation:
```
sudo yum install oracle-instantclient-devel #build libraries
source envoracle.sh #oracle environment

#fetch and build dependencies
```
npm install
```
#deployment to custom directory:
```
1. Compile f3mon, copy "dist" directory to node-server web/ and rename it to 'f3mon'.
If needed, remove symbolic link previously there (if later "scp -r" is used, it will dereference links)
2. in node-server directory, get npm dependencies (including oracle) as described previously
2. Copy whole node-server to a target location and rename it e.g. it can be names /cmsnfses-web/es-web/devel
3. Copy dbinfo.json from /cmsnfses-web/es-web/prod to devel area
4. From prod area, copy "web/sc/js", "web/sc/images", "web/sc/css", "web/sc/favicon" to web/sc
```

#deployment to existing prod or test directory:
```
1. copy app.js, src and node_modules to a target directory (e.g./cmsnfses-web/es-web/prod, /cmsnfses-web/es-web/test).
If needed, get dbinfo.js from prod, test or from backup (this file should not be uploaded to GitHub).
2. After building f3mon, copy "dist" directory to installation area "web/" and rename it to f3mon. If there are changes, you can copy individual files from web/sc.
```

