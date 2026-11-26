// イメージリンクモード: 出題・採点ロジックと、全データのスモークテスト
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { review } from '../src/core/srs.ts';
import type { ItemState } from '../src/core/srs.ts';
import { createRng } from '../src/core/rng.ts';
import {
  IL_SRS,
  normOrder,
  checkOrder,
  normShort,
  checkShort,
  pickDistractors,
  buildQuestion,
  normalizeIlSettings,
  ilCandidates,
  ilPick,
  allowedTypes,
  neededParts,
  keyOf,
  parseKey,
  kindOf,
  chapterStats,
  sessionCount,
  isWeak,
} from '../src/modes/imagelink/quiz.ts';
import type { IlRaw, IlIndexFile } from '../src/modes/imagelink/types.ts';

const ROOT = join(__dirname, '..', 'public', 'data', 'imagelink');
const index: IlIndexFile = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));
const ALL: IlRaw[] = index.parts.flatMap((p) => JSON.parse(readFileSync(join(ROOT, p.file), 'utf8')));
const byType = (t: string) => ALL.filter((q) => q.type === t);

const raw = (o: Partial<IlRaw>): IlRaw => ({
  id: 'q_test',
  type: 'en2ja',
  part: 1,
  chapter: 1,
  chapter_title: 't',
  ref_page_a5: 1,
  difficulty: 'normal',
  tags: [],
  question: 'q',
  ...o,
});

describe('並べ替えの照合', () => {
  it('大文字小文字と文末の .?! は無視する', () => {
    expect(checkOrder(['the', 'heat', 'makes', 'me', 'tired'], 'The heat makes me tired.')).toBe(true);
    expect(checkOrder(['Is', 'she', 'a', 'teacher'], 'Is she a teacher?')).toBe(true);
    expect(checkOrder(['Wow', 'it', 'works!'], 'Wow it works!')).toBe(true);
  });
  it('語順が違えば不正解', () => {
    expect(checkOrder(['me', 'The', 'heat', 'makes', 'tired'], 'The heat makes me tired.')).toBe(false);
    expect(checkOrder(['The', 'heat', 'makes', 'me'], 'The heat makes me tired.')).toBe(false);
  });
  it('文中のカンマなどはそのまま比べる', () => {
    expect(normOrder('Yes,  I do.')).toBe('yes, i do');
    expect(checkOrder(['Yes', 'I', 'do'], 'Yes, I do.')).toBe(false);
  });
  it('データの並べ替えは、正しい順に並べると全部正解になる', () => {
    for (const q of byType('order')) {
      const words = q.answer!.replace(/[.?!]+$/, '').split(/\s+/);
      expect(checkOrder(words, q.answer!), q.id).toBe(true);
      expect([...q.tokens!].sort(), q.id).toEqual([...words].sort());
    }
  });
});

describe('練習問題（short）の照合', () => {
  it('空白・大文字小文字・句読点を無視する', () => {
    expect(checkShort(' Are ', 'are')).toBe(true);
    expect(checkShort('ARE.', 'are')).toBe(true);
    expect(checkShort('a r e', 'are')).toBe(true);
    expect(checkShort('is', 'are')).toBe(false);
  });
  it('答えの（ ）の補足は比べない', () => {
    expect(checkShort('likes', 'likes（3人称単数なので -s）')).toBe(true);
    expect(checkShort('an', 'an（English は母音の音で始まる）')).toBe(true);
    expect(checkShort('a', 'an（English は母音の音で始まる）')).toBe(false);
  });
  it('空の入力は不正解', () => {
    expect(checkShort('', 'are')).toBe(false);
    expect(normShort('  ')).toBe('');
  });
});

describe('誤答の選び方', () => {
  it('重複なく3つ、正解は入れない', () => {
    for (let seed = 1; seed < 200; seed++) {
      const ds = pickDistractors('A', ['A', 'B', 'B', 'C', 'D', 'E', ' C '], createRng(seed));
      expect(ds).toHaveLength(3);
      expect(new Set(ds).size).toBe(3);
      expect(ds).not.toContain('A');
    }
  });
  it('4択は正解を1つだけ含み、毎回並びが変わる', () => {
    const q = raw({ answer: '正解', distractors: ['a', 'b', 'c', 'd', 'e'] });
    const orders = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const x = buildQuestion(q, createRng(seed))!;
      expect(x.choices).toHaveLength(4);
      expect(x.choices.filter((c) => c.text === '正解')).toHaveLength(1);
      expect(x.choices[x.answer].text).toBe('正解');
      expect(new Set(x.choices.map((c) => c.text)).size).toBe(4);
      orders.add(x.choices.map((c) => c.text).join('|'));
    }
    expect(orders.size).toBeGreaterThan(10);
  });
  it('図を選ぶ問題は 2×2 の画像', () => {
    const q = byType('fig_choose')[0];
    const x = buildQuestion(q, createRng(3))!;
    expect(x.choices).toHaveLength(4);
    expect(x.choices.every((c) => c.image)).toBe(true);
    expect(x.choices[x.answer].image).toBe(`./data/imagelink/${q.answer_figure}`);
  });
});

describe('Leitner（5箱・1/3/7/14/30日）', () => {
  const T = 1000;
  it('初めての問題は箱1。正解で次の箱、間隔は 3/7/14/30 日', () => {
    let s: ItemState | undefined;
    const due: number[] = [];
    const box: number[] = [];
    let day = T;
    for (let k = 0; k < 6; k++) {
      s = review(s, true, day, day, IL_SRS);
      box.push(s.box);
      due.push(s.due - day);
      day = s.due;
    }
    expect(box).toEqual([2, 3, 4, 5, 5, 5]);
    expect(due).toEqual([3, 7, 14, 30, 30, 30]);
  });
  it('まちがえると箱1（翌日）に戻る', () => {
    let s = review(undefined, true, T, T, IL_SRS);
    s = review(s, true, T + 3, T + 3, IL_SRS);
    s = review(s, false, T + 10, T + 10, IL_SRS);
    expect(s.box).toBe(1);
    expect(s.due).toBe(T + 11);
    expect(s.wrong).toBe(1);
    expect(s.seen).toBe(3);
  });
  it('初めてでまちがえても箱1・翌日', () => {
    const s = review(undefined, false, T, T, IL_SRS);
    expect(s.box).toBe(1);
    expect(s.due).toBe(T + 1);
  });
  it('自信は保存し、次に申告がなければ消える', () => {
    let s = review(undefined, true, T, T, IL_SRS, 'low');
    expect(s.conf).toBe('low');
    expect(isWeak(s)).toBe(true);
    s = review(s, true, T, T, IL_SRS, 'high');
    expect(isWeak(s)).toBe(false);
    s = review(s, true, T, T, IL_SRS);
    expect(s.conf).toBeUndefined();
  });
  it('既存モードの箱（0〜5・0/1/3/7/16/35日）は変わらない', () => {
    const s = review(undefined, true, T, T);
    expect(s.box).toBe(1);
    expect(s.due).toBe(T + 1);
    expect(review(s, false, T, T).box).toBe(0);
  });
});

describe('設定と出題範囲', () => {
  it('初期値と正規化', () => {
    const s = normalizeIlSettings(undefined);
    expect(s.method).toBe('srs');
    expect(s.totalCount).toBe(10);
    expect(normalizeIlSettings({ method: 'x', totalCount: 7, parts: [1, 9, 1], types: ['order', 'nope'] })).toMatchObject({ method: 'srs', totalCount: 10, parts: [1], types: ['order'] });
  });
  it('出題方法ごとの type', () => {
    const s = normalizeIlSettings({ method: 'figure' });
    expect([...allowedTypes(s)].sort()).toEqual(['core_image', 'fig_caption', 'fig_choose', 'prep_icon']);
    expect([...allowedTypes({ ...s, method: 'flash' })]).toEqual(['flashcard']);
    expect([...allowedTypes({ ...s, method: 'compose' })].sort()).toEqual(['ja2en', 'order', 'translate']);
    expect(allowedTypes({ ...s, method: 'total' }).has('flashcard')).toBe(false);
    // 絞り込みと出題方法は掛け合わせ
    expect([...allowedTypes({ ...s, method: 'compose', types: ['order', 'en2ja'] })]).toEqual(['order']);
  });
  it('部・章・難易度・タグで絞り込める', () => {
    const s = normalizeIlSettings({ method: 'total', parts: [3], diffs: ['easy'], tags: ['例文'] });
    const c = ilCandidates(ALL, s);
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) {
      const q = ALL.find((y) => keyOf(y) === x.key)!;
      expect(q.part).toBe(3);
      expect(q.difficulty).toBe('easy');
      expect(q.tags).toContain('例文');
    }
    expect(neededParts(s, index.chapters)).toEqual([3]);
    expect(neededParts(normalizeIlSettings({ method: 'chapter', chapter: 100 }), index.chapters)).toEqual([2]);
    expect(neededParts(normalizeIlSettings({ chapters: [1, 160] }), index.chapters)).toEqual([1, 4]);
  });
  it('章別ミニテストは10問、総合テストは選んだ問題数', () => {
    expect(sessionCount(normalizeIlSettings({ method: 'chapter' }))).toBe(10);
    expect(sessionCount(normalizeIlSettings({ method: 'total', totalCount: 50 }))).toBe(50);
    expect(sessionCount(normalizeIlSettings({ method: 'srs' }))).toBeNull();
  });
  it('キーに章が入る（記録だけで章ごとの達成度を数えられる）', () => {
    expect(keyOf({ chapter: 27, id: 'q_a' })).toBe('c27:q_a');
    expect(parseKey('c27:q_a')).toEqual({ chapter: 27, id: 'q_a' });
    expect(parseKey('x')).toBeNull();
    const st = chapterStats({
      'c1:a': { box: 4, due: 0, seen: 3, correct: 3, wrong: 0, last: 0, lastOk: true },
      'c1:b': { box: 1, due: 0, seen: 2, correct: 1, wrong: 1, last: 0, lastOk: false },
    });
    expect(st.get(1)).toEqual({ seen: 5, correct: 4, tried: 2, learned: 1 });
  });
});

describe('出題の選び方', () => {
  const s0 = normalizeIlSettings({ method: 'chapter', chapter: 2 });
  const cands = ilCandidates(ALL, s0);
  const st = (o: Partial<ItemState>): ItemState => ({ box: 1, due: 0, seen: 1, correct: 0, wrong: 1, last: 1, lastOk: false, ...o });
  const base = { count: 10, today: 100, rng: createRng(1), avoidFirst: null };

  it('章別ミニテスト: その章から10問、重複なし', () => {
    const p = ilPick({ ...base, cands, items: {} }, s0);
    expect(p).toHaveLength(10);
    expect(new Set(p.map((c) => c.base)).size).toBe(10);
    expect(p.every((c) => c.key.startsWith('c2:'))).toBe(true);
  });
  it('復習: 今日が期限の問題を優先し、足りなければ新しい問題', () => {
    const s = { ...s0, method: 'srs' as const };
    const items = {
      [cands[5].key]: st({ due: 100, lastOk: true }),
      [cands[6].key]: st({ due: 99, lastOk: false }),
      [cands[7].key]: st({ due: 150, lastOk: true }), // 期限前は出さない
    };
    const p = ilPick({ ...base, cands, items, count: 5 }, s);
    const keys = p.map((c) => c.key);
    expect(keys).toContain(cands[5].key);
    expect(keys).toContain(cands[6].key);
    expect(keys).not.toContain(cands[7].key);
    expect(p).toHaveLength(5);
  });
  it('苦手克服: まちがえた・自信なしの問題だけ', () => {
    const s = { ...s0, method: 'weak' as const };
    const items = {
      [cands[0].key]: st({ lastOk: false }),
      [cands[1].key]: st({ lastOk: true, conf: 'low' }),
      [cands[2].key]: st({ lastOk: true, conf: 'high' }),
      [cands[3].key]: st({ lastOk: true }),
    };
    const p = ilPick({ ...base, cands, items }, s);
    expect(p.map((c) => c.key).sort()).toEqual([cands[0].key, cands[1].key].sort());
  });
  it('総合テスト: ランダム（毎回違う）', () => {
    const s = normalizeIlSettings({ method: 'total', totalCount: 20 });
    const all = ilCandidates(ALL, s);
    const a = ilPick({ ...base, cands: all, items: {}, count: 20, rng: createRng(1) }, s).map((c) => c.key);
    const b = ilPick({ ...base, cands: all, items: {}, count: 20, rng: createRng(2) }, s).map((c) => c.key);
    expect(a).toHaveLength(20);
    expect(a).not.toEqual(b);
  });
});

describe('スモークテスト（全データ）', () => {
  it(`全 ${ALL.length} 問`, () => {
    expect(ALL.length).toBe(10695);
    expect(new Set(ALL.map((q) => q.id)).size).toBe(ALL.length);
  });
  it('章の一覧と問題数が合う', () => {
    const n = new Map<number, number>();
    for (const q of ALL) n.set(q.chapter, (n.get(q.chapter) ?? 0) + 1);
    for (const c of index.chapters) expect(n.get(c.no) ?? 0, `第${c.no}章`).toBe(c.question_count);
  });
  it('全問題が表示できる（どの seed でも問題が作れる）', () => {
    const rng = createRng(42);
    const bad: string[] = [];
    for (const q of ALL) {
      for (let k = 0; k < 2; k++) {
        const x = buildQuestion(q, rng);
        if (!x) {
          bad.push(q.id);
          break;
        }
        if (x.interactive) continue;
        if (x.choices.length !== 4 || new Set(x.choices.map((c) => c.image ?? c.text)).size !== 4 || x.answer < 0) bad.push(q.id);
      }
    }
    expect(bad).toEqual([]);
  });
  it('4択の問題は誤答の候補が3つ以上（正解と別の文字列で）', () => {
    for (const q of ALL) {
      if (kindOf(q) !== 'choice') continue;
      const ds = new Set((q.distractors ?? []).map((d) => d.trim()));
      ds.delete(q.answer!.trim());
      expect(ds.size, q.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('図のファイルがすべてある', () => {
    const missing: string[] = [];
    for (const q of ALL) for (const f of [q.figure, q.answer_figure, ...(q.distractor_figures ?? [])]) if (f && !existsSync(join(ROOT, f))) missing.push(f);
    expect(missing).toEqual([]);
  });
  it('validate.py が通る', () => {
    const py = spawnSync('python3', ['--version']);
    if (py.status !== 0) return; // python3 がない環境では飛ばす
    const out = execFileSync('python3', [join(ROOT, 'validate.py')], { encoding: 'utf8' });
    expect(out).toContain('problems 0');
  });
});
