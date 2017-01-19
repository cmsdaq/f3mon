#installation:

#required for oracle compilation:
```
sudo yum install oracle-instantclient-devel #build libraries
source envoracle.sh #oracle environment
```

#fetch and build dependencies
```
npm install
```
Try applying node-php and node-cache patches:
```
### patch -p0 < node-cache.patch #fixed in node-cache 4.1.1
patch -p0 < node-php.patch
```

#deployment to custom directory:
```
1. Compile f3mon, copy "dist" directory to node-server web/ and rename it to 'f3mon'.
2. If needed, remove symbolic link previously there (if later "scp -r" is used, it will dereference links)
3. in node-server directory, get npm dependencies (including oracle) as described previously
4. Copy whole node-server to a target location and rename it e.g. it can be named /cmsnfses-web/es-web/scratch/devel-username
5. Copy dbinfo.json from /cmsnfses-web/es-web/prod to devel area
6. From prod area, copy "web/sc/js", "web/sc/images", "web/sc/css", "web/sc/favicon" to web/sc (in case some files are not present)
```

#deployment to existing prod or test directory:
```
1. copy app.js, src and node_modules to a target directory (e.g./cmsnfses-web/es-web/prod, /cmsnfses-web/es-web/test).
2. If needed, get dbinfo.js from prod, test or from backup (this file should not be uploaded to GitHub).
3. After building f3mon, copy "dist" directory to installation area "web/" and rename it to f3mon. If there are changes, you can copy individual files from web/sc.
```

