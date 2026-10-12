# sync.py diff  -> writes patch.json (merge-patch for run/state) and stages new thumbs in thumbs-new/
# sync.py assets '{"id":"blobid",...}' -> writes patch.json with thumbnail urls, marks them uploaded
import json, os, sys, glob, time
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from config import ART_DIR as A, WORK as P
LOC=os.path.join(P,'tracker-local.json'); TN=os.path.join(P,'thumbs-new')
loc=json.load(open(LOC)) if os.path.exists(LOC) else {'cards':{},'uploaded':[]}
lanes=json.load(open(os.path.join(P,'lanes.json')))
phase_extra=json.load(open(os.path.join(P,'phase.json'))) if os.path.exists(os.path.join(P,'phase.json')) else {}
now=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def lane_of(id):
    for n in ('L1','L2','L3','R1','R2','R3'):
        f=os.path.join(P,n+'.list')
        if os.path.exists(f) and any(l.startswith(id+':') for l in open(f)): return n
    return None
patch={'cards':{}}
if sys.argv[1]=='diff':
    os.makedirs(TN,exist_ok=True)
    for f in glob.glob(os.path.join(TN,'*')): os.remove(f)
    failed=set(open(A+'/logs/failed.txt').read().split()) if os.path.exists(A+'/logs/failed.txt') else set()
    gen={}
    lanepatch={}
    for n in lanes:
        st=open(f'{A}/logs/{n}.status').read().strip() if os.path.exists(f'{A}/logs/{n}.status') else 'idle'
        cur=st[4:] if st.startswith('gen ') else ''
        if cur: gen[cur]=n
        done=sum(1 for l in open(os.path.join(P,n+'.list')) if l.strip() and os.path.exists(f"{A}/out/{l.split(':')[0]}.webp")) if os.path.exists(os.path.join(P,n+'.list')) else 0
        lanepatch[n]={'current':cur,'done':done,'total':lanes[n]['total'],'group':lanes[n]['group'],'state':st.split()[0] if st else 'idle'}
    patch['lanes']=lanepatch
    for p in glob.glob(A+'/out/*.webp'):
        id=os.path.basename(p)[:-5]
        if not id.startswith('cs2-') or id.endswith('ab23'): continue
        mt=os.path.getmtime(p)
        if loc['cards'].get(id,{}).get('mt')==mt: continue
        try: d=json.load(open(f'{A}/logs/{id}.crop.json'))
        except Exception: d={}
        w=d.get('window') or {}
        h=round(w['top']*800) if 'top' in w else None
        c={'lane':lane_of(id) or loc['cards'].get(id,{}).get('lane')}
        if d.get('source')=='manual': c.update(st='done',h={'__delete__':True},note='Manual crop applied')
        elif h is None: c.update(st='done',h={'__delete__':True},note='No head detected (beast or effect-only frame)')
        elif h<179: c.update(st='flag',h=h,note=f'Head high (y {h}): re-roll queued')
        else: c.update(st='done',h=h,note='')
        if loc['cards'].get(id,{}).get('rolls'): c['note']=(c['note']+' ' if c['note'] else '')+f"(roll {loc['cards'][id]['rolls']+1})"
        patch['cards'][id]=c
        loc['cards'].setdefault(id,{}).update(mt=mt,st=c['st'],h=h)
        im=Image.open(p).convert('RGB'); im.save(os.path.join(TN,id+'.full.jpg'),quality=86)
        rp=f'{A}/raw/{id}.raw.png'
        if os.path.exists(rp) and not loc['cards'].get(id,{}).get('rawUp'):
            r=Image.open(rp).convert('RGB'); c['rw'],c['rh']=r.size
            if d.get('crop'): L,T,W,H=d['crop']; c['crop']={'x':round(L/r.size[0],5),'y':round(T/r.size[1],5),'w':round(W/r.size[0],5),'h':round(H/r.size[1],5)}
            r.thumbnail((640,960),Image.LANCZOS); r.save(os.path.join(TN,id+'.raw.jpg'),quality=82)
    for id,n in gen.items():
        if id not in patch['cards']: patch['cards'][id]={'st':'gen','lane':n}
    for id in failed:
        if not os.path.exists(f'{A}/out/{id}.webp') and id not in gen: patch['cards'][id]={'st':'fail','note':'Generation failed: see logs'}
    halted=os.path.exists(A+'/logs/HALT')
    running=any(v['state']=='gen' for v in lanepatch.values())
    patch.update(updatedAt=now,running=running,halted=halted)
    patch.update(phase_extra)
    if halted: patch['phase']='Halted: auth error, waiting for codex login'
    print(len(patch['cards']),'card changes;',len(os.listdir(TN)),'new thumbs')
elif sys.argv[1]=='assets':
    m=json.loads(sys.argv[2])
    for k,b in m.items():
        if k.endswith('.raw'): patch['cards'].setdefault(k[:-4],{})['r']='/_blob/'+b; loc['cards'].setdefault(k[:-4],{})['rawUp']=True; continue
        id=k[:-5] if k.endswith('.full') else k
        patch['cards'].setdefault(id,{}).update({'f':'/_blob/'+b,'t':'/_blob/'+b})
    patch['updatedAt']=now
    print(len(m),'thumb urls')
json.dump(loc,open(LOC,'w'))
json.dump(patch,open(os.path.join(P,'patch.json'),'w',encoding='utf8'),ensure_ascii=False)
