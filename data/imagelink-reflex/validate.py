#!/usr/bin/env python3
"""整合性チェック。このフォルダで python3 validate.py"""
import json,os,sys
root=os.path.dirname(os.path.abspath(__file__))
idx=json.load(open(os.path.join(root,'index.json')))
Q=json.load(open(os.path.join(root,idx['question_file']))); bad=[]; ids=set()
for q in Q:
    if q['id'] in ids: bad.append(('dup',q['id']))
    ids.add(q['id'])
    if 'answer' in q:
        if len(q['distractors'])<3: bad.append(('few',q['id']))
        if q['answer'] in q['distractors']: bad.append(('ans in dis',q['id']))
        if len(set(q['distractors']))!=len(q['distractors']): bad.append(('dup dis',q['id']))
    if 'answer_figure' in q:
        if len(q['distractor_figures'])<3 or q['answer_figure'] in q['distractor_figures']: bad.append(('figs',q['id']))
    for f in [q.get(k) for k in('figure','answer_figure')]+q.get('distractor_figures',[]):
        if f and not os.path.exists(os.path.join(root,f)): bad.append(('missing',f))
    if not q.get('time_limit_sec'): bad.append(('time',q['id']))
print('questions',len(Q),'cards',len(json.load(open(os.path.join(root,idx['cards_file'])))),'problems',len(bad)); [print(b) for b in bad[:20]]
sys.exit(1 if bad else 0)
