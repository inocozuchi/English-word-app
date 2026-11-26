#!/usr/bin/env python3
"""問題データの整合性チェック。使い方: python3 validate.py (このファイルのあるフォルダで実行)"""
import json,os,sys,collections
root=os.path.dirname(os.path.abspath(__file__))
idx=json.load(open(os.path.join(root,'index.json')))
ids=set(); n=0; bad=[]
for p in idx['parts']:
    for q in json.load(open(os.path.join(root,p['file']))):
        n+=1
        if q['id'] in ids: bad.append(('dup id',q['id']))
        ids.add(q['id'])
        t=q['type']
        if t in('en2ja','ja2en','en2point','cloze','table','fig_caption','prep_icon','core_image') and 'answer' in q:
            if len(q.get('distractors',[]))<3: bad.append(('few distractors',q['id']))
            if q['answer'] in q.get('distractors',[]): bad.append(('answer in distractors',q['id']))
        for k in('figure','answer_figure'):
            if k in q and not os.path.exists(os.path.join(root,q[k])): bad.append(('missing file',q[k]))
        for f in q.get('distractor_figures',[]):
            if not os.path.exists(os.path.join(root,f)): bad.append(('missing file',f))
        if t=='order' and sorted(q['tokens'])!=sorted(q['answer'].rstrip('.?!').split()): bad.append(('order tokens',q['id']))
print('questions',n,'problems',len(bad)); [print(b) for b in bad[:20]]
sys.exit(1 if bad else 0)
