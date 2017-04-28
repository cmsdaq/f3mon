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

Provides:/opt/f3mon/
Provides:/opt/f3mon/prod/
Provides:/opt/f3mon/priv/
Provides:/opt/f3mon/test/
Provides:/usr/lib/systemd/system/f3mon.service
Provides:/usr/lib/systemd/system/f3mon.priv.service
Provides:/usr/lib/systemd/system/f3mon.test.service
Provides:/etc/logrotate.d/f3mon

%description
init scripts for F3Mon Node.js server

%prep
%build

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT
%__install -d "%{buildroot}/opt/f3mon"
%__install -d "%{buildroot}/opt/f3mon/prod"
%__install -d "%{buildroot}/opt/f3mon/priv"
%__install -d "%{buildroot}/opt/f3mon/test"
%__install -d "%{buildroot}/var/log/f3mon"
%__install -d "%{buildroot}/var/log/f3mon/prod"
%__install -d "%{buildroot}/var/log/f3mon/priv"
%__install -d "%{buildroot}/var/log/f3mon/test"
%__install -d "%{buildroot}/usr/lib/systemd/system"
mkdir -p %{buildroot}/opt/f3mon/prod
mkdir -p %{buildroot}/opt/f3mon/priv
mkdir -p %{buildroot}/opt/f3mon/test
mkdir -p %{buildroot}/etc/logrotate.d
mkdir -p %{buildroot}/usr/lib/systemd/system
cp $BASEDIR/f3mon.service %{buildroot}/usr/lib/systemd/system/
cp $BASEDIR/f3mon.priv.service %{buildroot}/usr/lib/systemd/system/
cp $BASEDIR/f3mon.test.service %{buildroot}/usr/lib/systemd/system/
cp $BASEDIR/logrotate-node %{buildroot}/etc/logrotate.d/f3mon

%files
%defattr(-, root, root, -)
#/opt/fff
%attr( 755 ,root, root) /var/log/f3mon
%attr( 755 ,root, root) /var/log/f3mon/prod
%attr( 755 ,root, root) /var/log/f3mon/priv
%attr( 755 ,root, root) /var/log/f3mon/test
%attr( 755 ,root, root) /opt/f3mon/
%attr( 755 ,root, root) /opt/f3mon/prod
%attr( 755 ,root, root) /opt/f3mon/priv
%attr( 755 ,root, root) /opt/f3mon/test
%attr( 644 ,root, root) /usr/lib/systemd/system/f3mon.service
%attr( 644 ,root, root) /usr/lib/systemd/system/f3mon.priv.service
%attr( 644 ,root, root) /usr/lib/systemd/system/f3mon.test.service
%attr( 644 ,root, root) /etc/logrotate.d/f3mon

%post
#echo "post install trigger"

#stop sysV services:
/sbin/service fff-node-server stop || true
/sbin/service priv-fff-node-server stop || true
/sbin/service test-fff-node-server stop || true
chkconfig --del fff-node-server || true
chkconfig --del priv-fff-node-server || true
chkconfig --del test-fff-node-server || true

#main service stop:
systemctl stop f3mon f3mon.priv f3mon.test || true

#get rid of pid files
rm -rf /var/run/*fff-node-server.pid

#set symlinks to NFS
unlink /opt/f3mon/prod/app.js >& /dev/null || true
unlink /opt/f3mon/prod/node_modules >& /dev/null || true
unlink /opt/f3mon/prod/web >& /dev/null || true
unlink /opt/f3mon/prod/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/prod/app.js /opt/f3mon/prod/app.js
ln -s /cmsnfses-web/es-web/prod/node_modules /opt/f3mon/prod/node_modules
ln -s /cmsnfses-web/es-web/prod/web /opt/f3mon/prod/web
ln -s /cmsnfses-web/es-web/prod/src /opt/f3mon/prod/src

unlink /opt/f3mon/priv/app.js >& /dev/null || true
unlink /opt/f3mon/priv/node_modules >& /dev/null || true
unlink /opt/f3mon/priv/web >& /dev/null || true
unlink /opt/f3mon/priv/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/priv/app.js /opt/f3mon/priv/app.js
ln -s /cmsnfses-web/es-web/priv/node_modules /opt/f3mon/priv/node_modules
ln -s /cmsnfses-web/es-web/priv/web /opt/f3mon/priv/web
ln -s /cmsnfses-web/es-web/priv/src /opt/f3mon/priv/src

unlink /opt/f3mon/test/app.js >& /dev/null || true
unlink /opt/f3mon/test/node_modules >& /dev/null || true
unlink /opt/f3mon/test/web >& /dev/null || true
unlink /opt/f3mon/test/src >& /dev/null || true
ln -s /cmsnfses-web/es-web/test/app.js /opt/f3mon/test/app.js
ln -s /cmsnfses-web/es-web/test/node_modules /opt/f3mon/test/node_modules
ln -s /cmsnfses-web/es-web/test/web /opt/f3mon/test/web
ln -s /cmsnfses-web/es-web/test/src /opt/f3mon/test/src

#set user ownership
/usr/sbin/useradd es-cdaq-runtime -g es-cdaq -s /sbin/nologin || true
/usr/sbin/useradd es-cdaq-priv -g es-cdaq -s /sbin/nologin || true

chown es-cdaq-runtime:es-cdaq -R /var/log/f3mon/prod/*.log >& /dev/null || true
chown es-cdaq-priv:es-cdaq -R /var/log/f3mon/f3mon/*.log >& /dev/null || true
chown es-cdaq-runtime:es-cdaq -R /var/log/f3mon/f3mon/*.log >& /dev/null || true

systemctl daemon-reload
systemctl reenable f3mon f3mon.priv f3mon.test
systemctl restart f3mon f3mon.priv f3mon.test

%preun
#echo "pre uninstall trigger"
if [ \$1 == 0 ]; then 

  systemctl stop f3mon f3mon.priv f3mon.test
  systemctl disable f3mon f3mon.priv f3mon.test

  /usr/sbin/userdel es-cdaq-runtime || true
  /usr/sbin/userdel es-cdaq-priv || true

  unlink /opt/f3mon/prod/app.js >& /dev/null || true
  unlink /opt/f3mon/prod/node_modules >& /dev/null || true
  unlink /opt/f3mon/prod/web >& /dev/null || true

  unlink /opt/f3mon/priv/app.js >& /dev/null || true
  unlink /opt/f3mon/priv/node_modules >& /dev/null || true
  unlink /opt/f3mon/priv/web >& /dev/null || true

  unlink /opt/f3mon/test/app.js >& /dev/null || true
  unlink /opt/f3mon/test/node_modules >& /dev/null || true
  unlink /opt/f3mon/test/web >& /dev/null || true

fi



#%verifyscript

EOF

rpmbuild --target noarch --define "_topdir `pwd`/RPMBUILD" -bb fff-node-scripts.spec

