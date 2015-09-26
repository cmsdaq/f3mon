#install:

npm install express -save
npm install elasticsearch -save
npm install node-php -save
npm install node-cache -save
npm install daemonize2 -save #needed for init script

#installing oracle package:
#sudo yum install oracle-instantclient-devel
export OCI_LIB_DIR=/usr/lib64/oracle/*/client/lib64
export OCI_INC_DIR=/usr/include/oracle/*/client

#npm install oracledb -save

#Note:compilation of oracledb 1.2.0 is broken, so do this:
cd node_modules
rm -rf oracledb
npm pack oracledb
tar xzf oracledb*.tgz
rm -rf oracledb*.tgz
rm -rf package/binding.gyp
cp ../binding.gyp package/
mv package oracledb
cd oracledb
npm install nan
node-gyp rebuild
cd ../../



This is base web server directory.
copy F3Mon (browser page) "dist" directory to web (in installation target directory) and rename it to node-f3mon

In web/index.html :
change link URLs to point to the server machine if needed
