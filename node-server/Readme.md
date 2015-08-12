#install:

npm install express -save
npm install elasticsearch -save
npm install node-php -save

#installing oracle package:
#sudo yum install oracle-instantclient-devel
export OCI_LIB_DIR=/usr/lib64/oracle/*/client/lib64
export OCI_INC_DIR=/usr/include/oracle/*/client
npm install oracledb -save


This is base web server directory.
copy F3Mon (browser page) "dist" directory to web (in installation target directory) and rename it to node-f3mon

In web/index.html :
change link URLs to point to the server machine
