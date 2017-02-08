#!/bin/sh
SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SCRIPTDIR
#bigdesk
unzip bigdesk-505b32e-mod2.zip
mkdir bigdesk
mv bigdesk-505b32e-mod2/_site/* bigdesk/
rm -rf bigdesk-505b32e-mod2
rm -rf ../node-server/web_priv/site/bigdesk
mv bigdesk ../node-server/web_priv/site/

tar xzf elasticsearch-head.tar.gz
mv elasticsearch-head head
rm -rf ../node-server/web_priv/site/head
mv head ../node-server/web_priv/site/
