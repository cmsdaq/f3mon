#!/bin/env python
import os,sys
import requests
import json
import socket
import math
import httplib

import time
import datetime

#from random import randint

doc_id=None
if len(sys.argv)>1:
  doc_id = sys.argv[1]

#not running on 3 hosts to avoid this script running at the same time on all 4 hosts
host =  os.uname()[1]
ipstr = socket.gethostbyname(host)
#threshold = 0.82

max_age_initial=400 #need < 720 (1 month) now
max_age=max_age_initial

#sleepPeriod = 3600 #1 hour check periods
sleepPeriod = 900 #1 hour check periods

res = requests.get('http://es-local.cms:9200/_cluster/health')
cluster_name=json.loads(res.content)["cluster_name"]

if cluster_name!='es-local':
  print "script not running on",cluster_name
  sys.exit(0)

#res = requests.get('http://es-local.cms:9200/_cat/master')
#ipstr_master = res.content.split()[2]

if doc_id:
  res = requests.post("http://es-cdaq.cms:9200/river/instance/"+str(doc_id)+'/_update',json.dumps({'doc':{'node':{'status':'running'}}}))

while True:

  #find out free space
  current_time = datetime.datetime.now()
  print "\n",current_time.isoformat()
  res = requests.get('http://es-local.cms:9200/_cluster/stats')
  jsres = json.loads(res.content)
  d_frac = 1. - (1.*jsres['nodes']['fs']['free_in_bytes'])/jsres['nodes']['fs']['total_in_bytes']
  #if occupancy_fraction is too high, reduce
  if d_frac>0.9:
    print "fraction",d_frac,":","new max_age:",max_age*0.95
    max_age=int(max_age*0.95)
  elif max_age!=max_age_initial:
    print "fraction",d_frac,": resetting to max age ",max_age_initial
    max_age=max_age_initial

  closed_indices={}
  res = requests.get('http://es-local.cms:9200/_cat/indices')
  rlines = res.content.split('\n')

  for r in rlines:
    rts = r.strip().split()
    if len(rts) and rts[0]=='close':
      if rts[1].startswith('run'):
        runparts = rts[1].split('_')
        system = runparts[1]
        rn = int(runparts[0][3:])
        if system in closed_indices:
          closed_indices[system].append(rn)
        else: closed_indices[system]=[rn]

  print d_frac
  for syst in closed_indices:
    print syst,len(sorted(closed_indices[syst]))
    mylen = len(closed_indices[syst])
    #if d_frac > threshold:
    delete_count = 0 
    for r in closed_indices[syst]:
      index = 'run'+str(r)+'_'+syst
      res = requests.post('http://es-cdaq.cms:9200/runindex_'+syst+'*/run/_search','{"query":{"term":{"runNumber":'+str(r)+'}},"sort":{"endTime":"asc"}}')
      resj = json.loads(res.content)['hits']['hits']
      #print resj
      if not len(resj):
        pass
        #print "nothing to delete"
      else:
        age = int(round((time.time() - resj[0]['sort'][0]/1000.)/3600.))
        if age>max_age or (syst=='dv' and age>72): #1 month!
	  print "run"+str(r)+"_"+syst,age,"hours: deleting index!"
          res = requests.delete('http://es-local.cms:9200/'+index,timeout=30)
	  print "result:",res.content
          time.sleep((1+int(math.sqrt(delete_count)))/4.)
          delete_count+=1
    print "deleted",syst,":",delete_count
      

  sys.stdout.flush()
  if not doc_id:break
  else:time.sleep(sleepPeriod)
    
    #print 'threshold:',threshold*100,'% used:',d_frac*100,'%','triggering: -XDELETE http://localhost:9200/'+','.join(run_names)


