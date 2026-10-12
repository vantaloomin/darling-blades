import json,sys,subprocess,os
# run from the work dir (ART_WORK)
files=[l.strip() for l in open('upl-order.txt') if l.strip()]
blobs=sys.argv[1].split()
assert len(files)==len(blobs),(len(files),len(blobs))
m={f[:-4]:b for f,b in zip(files,blobs)}
r=subprocess.run([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),'sync.py'),'assets',json.dumps(m)]); sys.exit(r.returncode)
