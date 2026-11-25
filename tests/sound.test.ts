import { describe, it, expect } from 'vitest';
import data from '../src/generated/sound.json';
import type { SoundData } from '../src/modes/sound/types.ts';
import {
  buildSoundIndex,
  soundQuestion,
  soundCandidates,
  soundPick,
  normalizeSoundSettings,
  wrongOrders,
  allocate,
  PATTERNS,
  COMPOUND_UNLOCK,
} from '../src/modes/sound/quiz.ts';
import type { SoundQuestion } from '../src/modes/sound/quiz.ts';
import { moraCount } from '../src/modes/sound/mora.ts';
import { createRng } from '../src/core/rng.ts';

const ix = buildSoundIndex(data as unknown as SoundData);
const all = normalizeSoundSettings(undefined);
const cands = soundCandidates(ix, all);

/** 4択の基本: 4つ・同じ文字列なし・正解が含まれる */
function check(q: SoundQuestion | null, key: string) {
  expect(q, key).not.toBeNull();
  expect(q!.choices, key).toHaveLength(4);
  expect(new Set(q!.choices.map((c) => c.text)).size, key).toBe(4);
  expect(q!.answer, key).toBeGreaterThanOrEqual(0);
  expect(q!.answer, key).toBeLessThan(4);
  return q!;
}

describe('moraCount', () => {
  it('小さいャュョと空白は数えず、ッとーは数える', () => {
    expect(moraCount('シュダイ ゲッリドヴィッ')).toBe(9); // シ・ダ・イ・ゲ・ッ・リ・ド・ヴ・ッ
    expect(moraCount('アバラー')).toBe(4);
  });
});

describe('①〜⑨ の問題生成（実データ全件・シードを変えて5回）', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`すべての候補で4択が作れ、選択肢が重複せず、正解が含まれる（seed ${seed}）`, () => {
      for (const c of cands) {
        const q = check(soundQuestion(ix, c.key, createRng(seed)), c.key);
        const s = q.data;
        const ans = q.choices[q.answer].text;
        switch (s.kind) {
          case 'item':
            expect(ans).toBe(s.pattern === 's1' ? s.item.kana : s.item.text);
            break;
          case 'cause':
            expect(ans).toBe(ix.rule.get(s.change.rule)!.name);
            break;
          case 'symptom':
            expect(ans).toBe(ix.rule.get(s.symptom.rule)!.name);
            break;
          case 'contraction':
            expect(ans).toBe(s.c.original[0]);
            break;
          case 'assim':
            expect(ans).toBe(s.a.result);
            break;
          case 'tfate':
            expect(ans).toBe(ix.d.fateLabels[s.t.fate]);
            break;
          case 'compound':
            // 正解の文字列は「手順の本来の順」に並べた文字
            expect(ans).toBe(s.c.steps.map((_, i) => s.letters[i]).join(' → '));
            break;
          case 'concept':
            expect(ans).toBe(s.c.answer);
            break;
        }
      }
    });
  }
  it('① の誤答は学校読み（plain）と decoys', () => {
    const it0 = ix.d.items[0];
    const q = soundQuestion(ix, `s1:${it0.id}`, createRng(1))!;
    expect(q.choices.map((c) => c.text).sort()).toEqual([it0.kana, it0.plain, ...it0.decoys].sort());
  });
  it('② の誤答は同じルールの項目から、モーラ数が近いものを選ぶ', () => {
    for (const it of ix.d.items.filter((x) => x.quiz)) {
      const q = soundQuestion(ix, `s2:${it.id}`, createRng(7))!;
      const wrong = q.choices.filter((_, k) => k !== q.answer).map((c) => ix.d.items.find((x) => x.text === c.text)!);
      const same = ix.d.items.filter((x) => x.quiz && x.id !== it.id && x.rules.some((r) => it.rules.includes(r)));
      if (same.length >= 3) {
        for (const w of wrong) expect(w.rules.some((r) => it.rules.includes(r)), it.id).toBe(true);
        // 選ばれなかった同じルールの項目より、モーラ数の差が大きい誤答はない
        const maxDiff = Math.max(...wrong.map((w) => Math.abs(w.mora - it.mora)));
        const notChosen = same.filter((x) => !wrong.includes(x));
        const minOther = Math.min(...notChosen.map((x) => Math.abs(x.mora - it.mora)));
        expect(maxDiff, it.id).toBeLessThanOrEqual(minOther);
      }
    }
  });
  it('③ は同じ箇所で起きている別のルールを誤答にしない（gotta: flap と contraction）', () => {
    const it = ix.d.items.find((x) => x.changes.filter((c) => c.span === 'gotta').length > 1)!;
    const n = it.changes.findIndex((c) => c.span === 'gotta');
    const rules = new Set(it.changes.filter((c) => c.span === 'gotta').map((c) => ix.rule.get(c.rule)!.name));
    for (let seed = 0; seed < 20; seed++) {
      const q = soundQuestion(ix, `s3:${it.id}#${n}`, createRng(seed))!;
      const wrong = q.choices.filter((_, k) => k !== q.answer).map((c) => c.text);
      for (const w of wrong) expect(rules.has(w)).toBe(false);
    }
  });
  it('③ は ask があればそれを問題文にする', () => {
    const it = ix.d.items.find((x) => x.changes.some((c) => c.ask))!;
    const n = it.changes.findIndex((c) => c.ask);
    const q = soundQuestion(ix, `s3:${it.id}#${n}`, createRng(1))!;
    expect(q.data.kind === 'cause' && q.data.ask).toBe(it.changes[n].ask);
  });
  it('⑥ の選択肢は ch / j / sh / zh の4つ', () => {
    const q = soundQuestion(ix, `s6:${ix.d.assimilations[0].id}`, createRng(1))!;
    expect(q.choices.map((c) => c.text).sort()).toEqual(['ch', 'j', 'sh', 'zh']);
  });
});

describe('⑧ の誤答の並び', () => {
  it('手順が4つなら、隣り合う2つを入れ替えた3通り', () => {
    const w = wrongOrders(4, createRng(1)).map((o) => o.join(''));
    expect(w.sort()).toEqual(['0132', '0213', '1023']);
  });
  it('手順が3つなら、入れ替え2通り＋別の並び1通り（正しい順は含まない）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const w = wrongOrders(3, createRng(seed)).map((o) => o.join(''));
      expect(w).toHaveLength(3);
      expect(new Set(w).size).toBe(3);
      expect(w).not.toContain('012');
      expect(w).toContain('102');
      expect(w).toContain('021');
    }
  });
});

describe('出題範囲の絞り込み', () => {
  it('quiz: false の項目は出さない', () => {
    const off = ix.d.items.filter((x) => !x.quiz).map((x) => x.id);
    expect(off.length).toBeGreaterThan(0);
    for (const c of cands) for (const id of off) expect(c.key.includes(id)).toBe(false);
  });
  it('補足例を含めない設定では supplement の項目を出さない', () => {
    const sup = new Set(ix.d.items.filter((x) => x.source === 'supplement').map((x) => x.id));
    const cs = soundCandidates(ix, { ...all, supplement: false });
    expect(cs.some((c) => [...sup].some((id) => c.key.includes(id + '#') || c.key.endsWith(':' + id)))).toBe(false);
    expect(cs.length).toBeLessThan(cands.length);
  });
  it('難易度の上限より高い項目と、⑧（level 3）を出さない', () => {
    const cs = soundCandidates(ix, { ...all, level: 1 });
    for (const c of cs) {
      const id = c.key.slice(3).split('#')[0];
      const it = ix.item.get(id);
      if (it) expect(it.level).toBe(1);
      expect(c.key.startsWith('s8:')).toBe(false);
    }
  });
  it('講・ルール・パターンで絞れる', () => {
    const cs = soundCandidates(ix, { ...all, lectures: [7], rules: ['flap'], patterns: ['s1', 's7'] });
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(['s1', 's7']).toContain(c.key.slice(0, 2));
      const id = c.key.slice(3);
      const it = ix.item.get(id);
      if (it) expect(it.lecture).toBe(7);
    }
  });
  it('設定が壊れていても全部に戻す', () => {
    const s = normalizeSoundSettings({ patterns: ['zz'], lectures: 'x', level: 9 });
    expect(s.patterns).toHaveLength(9);
    expect(s.lectures).toHaveLength(11);
    expect(s.level).toBe(3);
    expect(s.supplement).toBe(true);
  });
});

describe('出題の選び方（比率・⑧の解禁・苦手なルール）', () => {
  const pick = (count: number, answered = 0, tags = {}, seed = 1) =>
    soundPick(ix, { cands, items: {}, tags, answered, count, today: 100, rng: createRng(seed) });
  it('指定数を、同じ項目の重なりなしで選ぶ', () => {
    for (const seed of [1, 2, 3]) {
      const p = pick(10, 0, {}, seed);
      expect(p).toHaveLength(10);
      expect(new Set(p.map((c) => c.base)).size).toBe(10);
    }
  });
  it('①③⑦ を多めに割り振る（10問なら各2問）', () => {
    const w = Object.fromEntries(PATTERNS.map((p) => [p.id, p.weight]));
    const a = allocate(10, w, Object.fromEntries(PATTERNS.map((p) => [p.id, 99])));
    expect(a.s1).toBe(2);
    expect(a.s3).toBe(2);
    expect(a.s7).toBe(2);
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(10);
  });
  it('候補が足りないパターンの分は他に回す', () => {
    const a = allocate(10, { s1: 20, s6: 80 }, { s1: 99, s6: 4 });
    expect(a.s6).toBe(4);
    expect(a.s1).toBe(6);
  });
  it(`⑧ は ${COMPOUND_UNLOCK} 問答えるまで出さない`, () => {
    const only8 = cands.filter((c) => c.key.startsWith('s8:'));
    const p0 = soundPick(ix, { cands: only8, items: {}, tags: {}, answered: 0, count: 4, today: 1, rng: createRng(1) });
    expect(p0).toHaveLength(0);
    const p1 = soundPick(ix, { cands: only8, items: {}, tags: {}, answered: COMPOUND_UNLOCK, count: 4, today: 1, rng: createRng(1) });
    expect(p1.length).toBeGreaterThan(0);
  });
  it('苦手なルール（正答率が低い）の問題を先に出す', () => {
    const tags = { hdrop: { seen: 10, correct: 0 }, link: { seen: 10, correct: 10 }, elide: { seen: 10, correct: 10 }, assim: { seen: 10, correct: 10 }, flap: { seen: 10, correct: 10 }, contraction: { seen: 10, correct: 10 } };
    const only1 = cands.filter((c) => c.key.startsWith('s1:'));
    const p = soundPick(ix, { cands: only1, items: {}, tags, answered: 50, count: 3, today: 1, rng: createRng(1) });
    for (const c of p) expect(ix.item.get(c.key.slice(3))!.rules).toContain('hdrop');
  });
});
