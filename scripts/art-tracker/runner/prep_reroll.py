# prep_reroll.py <reviews dir>  -> builds reroll-prompts/, R1..R3.list, archives old raw/out; prints the queue
import json, os, glob, sys, shutil
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from config import ART_DIR as A, WORK as P, TSX, smartcrop_cmd
REV=A+'/prompts-revised'
meta=json.load(open(P+'/meta2.json')); loc=json.load(open(P+'/tracker-local.json'))
reviews={}
for f in glob.glob(os.path.join(sys.argv[1],'**','*.json'),recursive=True):
    d=json.load(open(f,encoding='utf8')); reviews[os.path.basename(f)[:-5]]=d.get('data',d)
applied=json.load(open(P+'/crops-applied.json')) if os.path.exists(P+'/crops-applied.json') else {}
HEAD=(" Leave generous open space above her: the very top of her head, hair, ears, horns and headdress sit well below the top quarter of the canvas, and nothing of her rises into the top quarter of the canvas")
q={}
for id,r in reviews.items():
    if r.get('status')=='regen': q[id]=('regen',r.get('note',''))
failed=set(open(A+'/logs/failed.txt').read().split()) if os.path.exists(A+'/logs/failed.txt') else set()
for id in failed:
    if not os.path.exists(f'{A}/out/{id}.webp'): q.setdefault(id,('blocked',''))
for f in glob.glob(A+'/logs/cs2-*.crop.json'):
    id=os.path.basename(f)[:-10]
    if id.endswith('ab23') or id in q: continue
    try: d=json.load(open(f))
    except Exception: continue
    w=d.get('window') or {}
    if 'top' not in w or round(w['top']*800)>=179: continue
    st=reviews.get(id,{}).get('status')
    if st in ('approved','crop') or id in applied: continue
    q[id]=('head',f"head y {round(w['top']*800)}")
os.makedirs(P+'/reroll-prompts',exist_ok=True); os.makedirs(A+'/raw/rolls',exist_ok=True); os.makedirs(A+'/out/rolls',exist_ok=True)
for id,(kind,why) in q.items():
    base=open(f'{P}/prompts2/{id}.txt',encoding='utf8').read()
    if kind=='regen' and os.path.exists(f'{REV}/{id}.txt'): p=open(f'{REV}/{id}.txt',encoding='utf8').read()
    elif kind=='head':
        k=' — crisp cel-shaded gacha anime'
        p=base.replace(k,HEAD+k,1) if k in base else base
    else: p=base
    open(f'{P}/reroll-prompts/{id}.txt','w',encoding='utf8',newline='').write(p)
ids=sorted(q)
lanes={'R1':[], 'R2':[], 'R3':[]}
for i,id in enumerate(ids): lanes[f'R{i%3+1}'].append(id)
for n,L in lanes.items():
    open(f'{P}/{n}.list','w').write(''.join(f"{id}:{meta[id]['mode']}:{int(meta[id]['fig'])}\n" for id in L))
json.dump({id:{'kind':k,'why':w} for id,(k,w) in q.items()},open(P+'/reroll-queue.json','w'),indent=1)
for id,(k,w) in sorted(q.items()): print(f'{k:7} {id} {w}')
print(len(q),'queued')
