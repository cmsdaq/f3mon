#!/bin/sh

LOGFILE=/var/log/node/node-prod-service.log
ERRFILE=/var/log/node/node-prod-service.err

while [ 1 ]; do
	echo "Restarting"
	sleep 2
	ulimit -n 32767
	/usr/bin/node $(dirname $0)/app.js "$@" >>$LOGFILE 2>>$ERRFILE </dev/null &
	CHILD="$!"
	# avoid the node process to stay running after this script is terminated
	trap "kill $CHILD; exit" exit INT TERM
	wait
done
