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
Version: 0.90
Release: 0
Summary: hlt daemon
License: gpl
Group: DAQ
Packager: smorovic
Source: none
%define _topdir $TOPDIR
BuildArch: $BUILD_ARCH
AutoReqProv: no
Requires: npm 

Provides:/opt/node/prod/
Provides:/etc/init.d/fff-node-server
Provides:/opt/node/prod/node-service
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
%__install -d "%{buildroot}/var/log/node"

mkdir -p %{buildroot}/opt/node/prod
mkdir -p %{buildroot}/etc/init.d
mkdir -p %{buildroot}/etc/logrotate.d
cp $BASEDIR/fff-node-server %{buildroot}/etc/init.d/fff-node-server
cp $BASEDIR/node-service.sh %{buildroot}/opt/node/prod/node-service.sh
cp $BASEDIR/logrotate-node %{buildroot}/etc/logrotate.d/fff-node-server

%files
%defattr(-, root, root, -)
#/opt/fff
#%attr( 755 ,root, root) /etc/
#%attr( 755 ,root, root) /opt/
#%attr( 700 ,root, root) /opt/node/
%attr( 700 ,root, root) /var/log/node
%attr( 700 ,root, root) /opt/node/prod
%attr( 755 ,root, root) /etc/init.d/fff-node-server
%attr( 755 ,root, root) /opt/node/prod/node-service.sh
%attr( 755 ,root, root) /etc/logrotate.d/fff-node-server

%post
#echo "post install trigger"
/etc/init.d/fff-node-server stop
unlink /cmsnfses-web/es-web/prod/app.js
unlink /cmsnfses-web/es-web/prod/node_modules
unlink /cmsnfses-web/es-web/prod/web

ln -s /cmsnfses-web/es-web/prod/app.js app.js
ln -s /cmsnfses-web/es-web/prod/node_modules node_modules
ln -s /cmsnfses-web/es-web/prod/web web
#set user ownership
/usr/sbin/useradd es-cdaq-runtime -g es-cdaq || true
#chown es-cdaq-runtime:es-cdaq -R /opt/node/*.log || true
#chown es-cdaq-runtime:es-cdaq -R /var/log/node/*.log || true
 
chown es-cdaq-runtime:es-cdaq -R /var/run/
/etc/init.d/fff-node-server start
chkconfig --add fff-node-start

%preun
#echo "pre uninstall trigger"
if [ \$1 == 0 ]; then 
  /etc/init.d/fff-node-server stop
  chkconfig --del fff-node-server
  rm -rf /var/run/fff-node-server.pid
  rm -rf /var/lock/subsys/fff-node-server
  /usr/sbin/userdel es-cdaq-runtime || true
fi



#%verifyscript

EOF

rpmbuild --target noarch --define "_topdir `pwd`/RPMBUILD" -bb fff-node-scripts.spec

