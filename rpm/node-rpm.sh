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
Version: 2.0.0
Release: 0
Summary: node.js f3mon scripts
License: gpl
Group: DAQ
Packager: smorovic
Source: none
%define _topdir $TOPDIR
BuildArch: $BUILD_ARCH
AutoReqProv: no
Requires: npm,nodejs,gcc-c++,pam-devel,oracle-instantclient-devel

Provides:/opt/node/
Provides:/opt/node/prod/
Provides:/opt/node/priv/
Provides:/opt/node/test/
Provides:/usr/lib/systemd/system/fff-node-server.service
Provides:/usr/lib/systemd/system/fff-node-server-priv.service
Provides:/usr/lib/systemd/system/fff-node-server-test.service
Provides:/etc/logrotate.d/fff-node-server

%description
init scripts for F3Mon Node.js server

%prep
%build

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT
%__install -d "%{buildroot}/opt/node"
%__install -d "%{buildroot}/opt/node/prod"
%__install -d "%{buildroot}/opt/node/priv"
%__install -d "%{buildroot}/opt/node/test"
%__install -d "%{buildroot}/var/log/node"
%__install -d "%{buildroot}/var/log/node/prod"
%__install -d "%{buildroot}/var/log/node/priv"
%__install -d "%{buildroot}/var/log/node/test"
%__install -d "%{buildroot}/usr/lib/systemd/system"
mkdir -p %{buildroot}/opt/node/prod
mkdir -p %{buildroot}/opt/node/priv
mkdir -p %{buildroot}/opt/node/test
mkdir -p %{buildroot}/etc/logrotate.d
mkdir -p %{buildroot}/usr/lib/systemd/system
cp $BASEDIR/fff-node-server.service %{buildroot}/usr/lib/systemd/system/fff-node-server.service
cp $BASEDIR/fff-node-server.service %{buildroot}/usr/lib/systemd/system/fff-node-server-priv.service
cp $BASEDIR/fff-node-server.service %{buildroot}/usr/lib/systemd/system/fff-node-server-test.service
cp $BASEDIR/logrotate-node %{buildroot}/etc/logrotate.d/fff-node-server

%files
%defattr(-, root, root, -)
#/opt/fff
%attr( 755 ,root, root) /var/log/node
%attr( 755 ,root, root) /var/log/node/prod
%attr( 755 ,root, root) /var/log/node/priv
%attr( 755 ,root, root) /var/log/node/test
%attr( 755 ,root, root) /opt/node/
%attr( 755 ,root, root) /opt/node/prod
%attr( 755 ,root, root) /opt/node/priv
%attr( 755 ,root, root) /opt/node/test
%attr( 755 ,root, root) /usr/lib/systemd/system/fff-node-server.service
%attr( 755 ,root, root) /usr/lib/systemd/system/fff-node-server-priv.service
%attr( 755 ,root, root) /usr/lib/systemd/system/fff-node-server-test.service
%attr( 755 ,root, root) /etc/logrotate.d/fff-node-server

%post
#echo "post install trigger"

/sbin/service fff-node-server stop || true
/sbin/service fff-node-server-priv stop || true
/sbin/service fff-node-server-test stop || true

#old names:
/sbin/service test-fff-node-server-priv || true
/sbin/service test-fff-node-server-test || true

#get rid of pid files
rm -rf /var/run/*fff-node-server.pid

#set symlinks to NFS
unlink /opt/node/prod/app.js >& /dev/null || true
unlink /opt/node/prod/node_modules >& /dev/null || true
unlink /opt/node/prod/web >& /dev/null || true
unlink /opt/node/prod/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/prod/app.js /opt/node/prod/app.js
ln -s /cmsnfses-web/es-web/prod/node_modules /opt/node/prod/node_modules
ln -s /cmsnfses-web/es-web/prod/web /opt/node/prod/web
ln -s /cmsnfses-web/es-web/prod/src /opt/node/prod/src

unlink /opt/node/priv/app.js >& /dev/null || true
unlink /opt/node/priv/node_modules >& /dev/null || true
unlink /opt/node/priv/web >& /dev/null || true
unlink /opt/node/priv/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/priv/app.js /opt/node/priv/app.js
ln -s /cmsnfses-web/es-web/priv/node_modules /opt/node/priv/node_modules
ln -s /cmsnfses-web/es-web/priv/web /opt/node/priv/web
ln -s /cmsnfses-web/es-web/priv/src /opt/node/priv/src

unlink /opt/node/test/app.js >& /dev/null || true
unlink /opt/node/test/node_modules >& /dev/null || true
unlink /opt/node/test/web >& /dev/null || true
unlink /opt/node/test/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/test/app.js /opt/node/test/app.js
ln -s /cmsnfses-web/es-web/test/node_modules /opt/node/test/node_modules
ln -s /cmsnfses-web/es-web/test/web /opt/node/test/web
ln -s /cmsnfses-web/es-web/test/src /opt/node/test/src

#set user ownership
/usr/sbin/useradd es-cdaq-runtime -g es-cdaq -s /sbin/nologin || true
/usr/sbin/useradd es-cdaq-priv -g es-cdaq -s /sbin/nologin || true

chown es-cdaq-runtime:es-cdaq -R /var/log/node/prod/*.log || true
chown es-cdaq-priv:es-cdaq -R /var/log/node/priv/*.log || true
chown es-cdaq-runtime:es-cdaq -R /var/log/node/test/*.log || true

systemctl daemon-reload

systemctl enable fff-node-server
systemctl enable fff-node-server-priv
systemctl enable fff-node-server-test

systemctl restart fff-node-server
systemctl restart fff-node-server-priv
systemctl restart fff-node-server-test

%preun
#echo "pre uninstall trigger"
if [ \$1 == 0 ]; then 

  systemctl stop fff-node-server
  systemctl stop fff-node-server-priv
  systemctl stop fff-node-server-test

  systemctl disable fff-node-server
  systemctl disable fff-node-server-priv
  systemctl disable fff-node-server-test

  /usr/sbin/userdel es-cdaq-runtime || true
  /usr/sbin/userdel es-cdaq-priv || true

  unlink /opt/node/prod/app.js >& /dev/null || true
  unlink /opt/node/prod/node_modules >& /dev/null || true
  unlink /opt/node/prod/web >& /dev/null || true

  unlink /opt/node/priv/app.js >& /dev/null || true
  unlink /opt/node/priv/node_modules >& /dev/null || true
  unlink /opt/node/priv/web >& /dev/null || true

  unlink /opt/node/test/app.js >& /dev/null || true
  unlink /opt/node/test/node_modules >& /dev/null || true
  unlink /opt/node/test/web >& /dev/null || true

fi



#%verifyscript

EOF

rpmbuild --target noarch --define "_topdir `pwd`/RPMBUILD" -bb fff-node-scripts.spec

