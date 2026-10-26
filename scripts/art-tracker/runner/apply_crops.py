# apply_crops.py <dir with crops/*.json from ArtifactData list out_dir>  -> re-cuts out/<id>.webp from raw, writes crop-patch.json
import json, os, sys, glob, subprocess, time
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from config import ART_DIR as A, WORK as P, TSX, smartcrop_cmd
POST=os.path.join(os.path.dirname(os.path.abspath(__file__)),'post.ts')
LOC=os.path.join(P,'crops-applied.json'); done=json.load(open(LOC)) if os.path.exists(LOC) else {}
patch={'cards':{}}
for f in glob.glob(os.path.join(sys.argv[1],'**','*.json'),recursive=True):
    d=json.load(open(f,encoding='utf8')); d=d.get('data',d)
    id=os.path.basename(f)[:-5]
    if not id.startswith('cs2-') or done.get(id)==d.get('savedAt'): continue
    rp=f'{A}/raw/{id}.raw.png'
    if not os.path.exists(rp): print('no raw',id); continue
    im=Image.open(rp).convert('RGB'); W,H=im.size
    x,y,w,h=[float(d[k]) for k in ('x','y','w','h')]
    box=(round(x*W),round(y*H),round((x+w)*W),round((y+h)*H))
    box=(max(0,box[0]),max(0,box[1]),min(W,box[2]),min(H,box[3]))
    tmp=f'{A}/out/{id}.tmp.png'
    im.crop(box).resize((640,800),Image.LANCZOS).save(tmp)
    r=subprocess.run([TSX,POST,tmp,f'{A}/out/{id}.webp'],capture_output=True,text=True)
    os.remove(tmp)
    if r.returncode: print('encode fail',id,r.stderr[-200:]); continue
    # record the box so later syncs report the manual crop, not smartcrop's
    json.dump({'source':'manual','crop':[box[0],box[1],box[2]-box[0],box[3]-box[1]],'savedAt':d.get('savedAt')},open(f'{A}/logs/{id}.crop.json','w'))
    done[id]=d.get('savedAt')
    patch['cards'][id]={'cropApplied':d.get('savedAt'),'st':'done','note':'Manual crop applied','h':{'__delete__':True}}
    print('applied',id,box)
# A crop doc that disappeared (Reset on the page) restores smartcrop's own cut from the raw.
present={os.path.basename(f)[:-5] for f in glob.glob(os.path.join(sys.argv[1],'**','*.json'),recursive=True)}
meta=json.load(open(os.path.join(P,'meta2.json')))
for id in ([k for k in done if k not in present] if '--full' in sys.argv else []):
    m=meta.get(id,{'mode':'character','fig':True}); tmp=f'{A}/out/{id}.tmp.png'
    args=smartcrop_cmd(f'{A}/raw/{id}.raw.png',tmp,m['mode'],m['fig'])
    r=subprocess.run(args,capture_output=True,text=True)
    if r.returncode: print('restore fail',id); continue
    open(f'{A}/logs/{id}.crop.json','w').write(r.stdout.strip().splitlines()[-1])
    subprocess.run([TSX,POST,tmp,f'{A}/out/{id}.webp']); os.remove(tmp)
    del done[id]; patch['cards'][id]={'cropApplied':{'__delete__':True}}
    print('restored smartcrop',id)
json.dump(done,open(LOC,'w')); json.dump(patch,open(os.path.join(P,'crop-patch.json'),'w'))
