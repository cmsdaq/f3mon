#!/bin/bash -e
BUILD_ARCH=noarch
SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SCRIPTDIR
BASEDIR=$PWD

PACKAGENAME="fff-node-scripts"

rm -rf /tmp/fff-node-scripts-build-tmp
echo "creating new build area"
mkdir  /tmp/fff-node-scripts-build-tmp
ls
cd     /tmp/fff-node-scripts-build-tmp
mkdir BUILD
mkdir RPMS
TOPDIR=$PWD
echo "working in $PWD"
ls

cd $TOPDIR
# we are done here, write the specs and make the fu***** rpm
cat > fff-node-scripts.spec <<EOF
Name: $PACKAGENAME
Version: 1.0.0
Release: 0
Summary: node.js f3mon scripts
License: gpl
Group: DAQ
Packager: smorovic
Source: none
%define _topdir $TOPDIR
BuildArch: $BUILD_ARCH
AutoReqProv: no
Requires: npm 

Provides:/opt/node/
Provides:/opt/node/prod/
Provides:/opt/node/test/
Provides:/etc/init.d/fff-node-server
Provides:/etc/init.d/test-fff-node-server
Provides:/opt/node/node-daemon.js
Provides:/etc/logrotate.d/fff-node-server

%description
init scripts for Node.js FFF monitor package

%prep
%build

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT
%__install -d "%{buildroot}/opt/node"
%__install -d "%{buildroot}/opt/node/prod"
%__install -d "%{buildroot}/opt/node/test"
%__install -d "%{buildroot}/var/log/node"

mkdir -p %{buildroot}/opt/node/prod
mkdir -p %{buildroot}/opt/node/test
mkdir -p %{buildroot}/etc/init.d
mkdir -p %{buildroot}/etc/logrotate.d
cp $BASEDIR/fff-node-server %{buildroot}/etc/init.d/fff-node-server
cp $BASEDIR/test-fff-node-server %{buildroot}/etc/init.d/test-fff-node-server
cp $BASEDIR/node-daemon.js %{buildroot}/opt/node/node-daemon.js
cp $BASEDIR/logrotate-node %{buildroot}/etc/logrotate.d/fff-node-server

%files
%defattr(-, root, root, -)
#/opt/fff
#%attr( 755 ,root, root) /etc/
#%attr( 755 ,root, root) /opt/
#%attr( 755 ,root, root) /opt/node/
%attr( 755 ,root, root) /var/log/node
%attr( 755 ,root, root) /opt/node/prod
%attr( 755 ,root, root) /opt/node/test
%attr( 755 ,root, root) /etc/init.d/fff-node-server
%attr( 755 ,root, root) /etc/init.d/test-fff-node-server
%attr( 755 ,root, root) /opt/node/node-daemon.js
%attr( 755 ,root, root) /etc/logrotate.d/fff-node-server

%post
#echo "post install trigger"
unlink /opt/node/prod/app.js >& /dev/null || true
unlink /opt/node/prod/node_modules >& /dev/null || true
unlink /opt/node/prod/web >& /dev/null || true

ln -s /cmsnfses-web/es-web/prod/app.js /opt/node/prod/app.js
ln -s /cmsnfses-web/es-web/prod/node_modules /opt/node/prod/node_modules
ln -s /cmsnfses-web/es-web/prod/web /opt/node/prod/web

unlink /opt/node/node_modules >& /dev/null || true
ln -s /opt/node/prod/node_modules /opt/node/node_modules

/etc/init.d/fff-node-server stop || true
/etc/init.d/test-fff-node-server stop >& /dev/null || true

unlink /opt/node/test/app.js >& /dev/null || true
unlink /opt/node/test/node_modules >& /dev/null || true
unlink /opt/node/test/web >& /dev/null || true

ln -s /cmsnfses-web/es-web/test/app.js /opt/node/test/app.js
ln -s /cmsnfses-web/es-web/test/node_modules /opt/node/test/node_modules
ln -s /cmsnfses-web/es-web/test/web /opt/node/test/web


#set user ownership
/usr/sbin/useradd es-cdaq-runtime -g es-cdaq -s /sbin/nologin || true
#chown es-cdaq-runtime:es-cdaq -R /opt/node/*.log || true
#chown es-cdaq-runtime:es-cdaq -R /var/log/node/*.log || true
 
chown es-cdaq-runtime:es-cdaq -R /var/run/
/etc/init.d/fff-node-server start
chkconfig --add fff-node-server

%preun
#echo "pre uninstall trigger"
if [ \$1 == 0 ]; then 
  /etc/init.d/fff-node-server stop || true
  /etc/init.d/test-fff-node-server stop >& /dev/null || true
  chkconfig --del fff-node-server || true
  rm -rf /var/run/*fff-node-server.pid
  #rm -rf /var/lock/subsys/fff-node-server
  /usr/sbin/userdel es-cdaq-runtime || true

  unlink /opt/node/prod/app.js >& /dev/null || true
  unlink /opt/node/prod/node_modules >& /dev/null || true
  unlink /opt/node/prod/web >& /dev/null || true

  unlink /opt/node/test/app.js >& /dev/null || true
  unlink /opt/node/test/node_modules >& /dev/null || true
  unlink /opt/node/test/web >& /dev/null || true

  unlink /opt/node/node_modules >& /dev/null || true

  rm -rf /opt/node/prod/*.log
  rm -rf /opt/node/test/*.log

fi



#%verifyscript

EOF

rpmbuild --target noarch --define "_topdir `pwd`/RPMBUILD" -bb fff-node-scripts.spec

