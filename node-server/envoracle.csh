#new dir hierarchy for oracle packages in CC7:
setenv OCI_INC_DIR `echo /usr/include/oracle/*/client64`
setenv OCI_LIB_DIR `echo /usr/lib/oracle/*/client64/lib`

#use for SLC6
#OCI_INC_DIR="/usr/include/oracle/*/client"
#OCI_LIB_DIR="/usr/lib64/oracle/*/client/lib64"
#export OCI_INC_DIR=`echo $OCI_INC_DIR`
#export OCI_LIB_DIR=`echo $OCI_LIB_DIR`

#set -f
#set +f
