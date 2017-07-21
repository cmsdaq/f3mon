#!/bin/sh
SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SCRIPTDIR;
ln -s ../../ecd/sctest sctest
ln -s ../../ecd/doc doc
