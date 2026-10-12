# run from the work dir (ART_WORK): folds patch.json over pd.json
import json,sys
a=json.load(open('pd.json',encoding='utf8')); b=json.load(open('patch.json',encoding='utf8'))
def m(x,y):
    for k,v in y.items():
        if isinstance(v,dict) and isinstance(x.get(k),dict): m(x[k],v)
        else: x[k]=v
m(a,b); json.dump(a,open('patch.json','w',encoding='utf8'),ensure_ascii=False); print('merged',len(a['cards']),'cards')
