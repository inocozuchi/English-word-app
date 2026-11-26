// イメージリンク反射版: タイマー・時間切れの採点・再出題キュー・反射率の判定・出題方法と、全データのスモークテスト
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRng } from '../src/core/rng.ts';
import { review } from '../src/core/srs.ts';
import type { ItemState } from '../src/core/srs.ts';
import {
  QuestionTimer,
  ReflexRun,
  grade,
  isReflexive,
  isWeak,
  buildChoices,
  reflexCandidates,
  reflexPick,
  reflexRates,
  chapterReflex,
  better,
  normalizeReflexSettings,
  SLOW_RATIO,
  WARMUP_COUNT,
  RUSH_COUNT,
} from '../src/modes/reflex/engine.ts';
import { summarize } from '../src/modes/reflex/log.ts';
import { IL_SRS } from '../src/modes/imagelink/quiz.ts';
import type { RQuestion, RCard, RIndexFile } from '../src/modes/reflex/types.ts';

const ROOT = join(__dirname, '..', 'public', 'data', 'imagelink-reflex');
const index: RIndexFile = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));
const QS: RQuestion[] = JSON.parse(readFileSync(join(ROOT, index.question_file), 'utf8'));
const CARDS: RCard[] = JSON.parse(readFileSync(join(ROOT, index.cards_file), 'utf8'));
const pool = { questions: QS, cards: CARDS };

describe('タイマー（時刻は注入）', () => {
  it('経過・残り・時間切れ', () => {
    const t = new QuestionTimer(4000, 1000);
    expect(t.elapsed(1000)).toBe(0);
    expect(t.remaining(2500)).toBe(2500);
    expect(t.fraction(3000)).toBe(0.5);
    expect(t.expired(4999)).toBe(false);
    expect(t.expired(5000)).toBe(true);
    expect(t.remaining(9000)).toBe(0);
  });
  it('一時停止の間は数えない', () => {
    const t = new QuestionTimer(3000, 0);
    t.pause(1000);
    expect(t.elapsed(5000)).toBe(1000);
    expect(t.paused).toBe(true);
    t.resume(6000);
    expect(t.elapsed(6500)).toBe(1500);
    t.pause(7000);
    t.pause(8000); // 二重の一時停止は無視
    t.resume(9000);
    expect(t.elapsed(9000)).toBe(2000);
    expect(t.expired(9999)).toBe(false);
    expect(t.expired(10000)).toBe(true);
  });
});

describe('採点', () => {
  it('選んだ瞬間に採点し、反応時間を記録', () => {
    expect(grade(2, 2, 1234.4, 4000)).toEqual({ ok: true, timeout: false, ms: 1234, slow: false });
    expect(grade(1, 2, 900, 4000)).toMatchObject({ ok: false, timeout: false, slow: false });
  });
  it('時間切れは不正解（反応時間は制限時間）', () => {
    expect(grade(null, 2, 4000, 4000)).toEqual({ ok: false, timeout: true, ms: 4000, slow: false });
    // 制限時間を過ぎてからの回答も時間切れ
    expect(grade(2, 2, 4100, 4000)).toMatchObject({ ok: false, timeout: true });
  });
  it('正解でも制限時間の70%を超えたら「あやしい」', () => {
    expect(grade(0, 0, 4000 * SLOW_RATIO, 4000).slow).toBe(false);
    expect(grade(0, 0, 4000 * SLOW_RATIO + 1, 4000).slow).toBe(true);
  });
});

describe('再出題キュー', () => {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  it('まちがえた問題は 3〜6 問後にもう一度出る', () => {
    for (let seed = 1; seed < 100; seed++) {
      const run = new ReflexRun(keys, createRng(seed));
      expect(run.settle(false)).toBe(true); // a をまちがえる
      const at = run.items.findIndex((x, k) => k > 0 && x.key === 'a');
      expect(at - 0).toBeGreaterThanOrEqual(3);
      expect(at - 0).toBeLessThanOrEqual(6);
      expect(run.items[at].again).toBe(true);
    }
  });
  it('2回続けて正解したら終わる', () => {
    const run = new ReflexRun(keys, createRng(1));
    run.settle(false); // a ×
    const seen: string[] = [];
    while (!run.done) {
      const k = run.current!.key;
      seen.push(k);
      run.settle(true);
    }
    expect(seen.filter((k) => k === 'a')).toHaveLength(2); // 再出題で2回正解
    expect(run.pending).toBe(0);
    expect(run.items).toHaveLength(12);
  });
  it('再出題でまちがえたら、また2回続けて正解が必要', () => {
    const run = new ReflexRun(['a', 'b'], createRng(1));
    run.settle(false); // a × → 最後に足される（足りないとき）
    const order: string[] = [];
    const answers = { a: [true, false, true, true] as boolean[] };
    while (!run.done) {
      const k = run.current!.key;
      order.push(k);
      run.settle(k === 'a' ? answers.a.shift()! : true);
    }
    expect(order.filter((k) => k === 'a')).toHaveLength(4);
    expect(run.pending).toBe(0);
  });
  it('成績に記録するのは初めての回答だけ', () => {
    const run = new ReflexRun(['a', 'b', 'c', 'd'], createRng(2));
    const firsts: boolean[] = [];
    run.settle(false);
    while (!run.done) firsts.push(run.settle(true));
    expect(firsts.filter((x) => !x)).toHaveLength(2);
  });
  it('出し直しには上限がある（まちがえ続けても終わる）', () => {
    const run = new ReflexRun(['a'], createRng(3));
    let n = 0;
    while (!run.done && n < 100) {
      run.settle(false);
      n++;
    }
    expect(run.done).toBe(true);
    expect(n).toBeLessThanOrEqual(5);
  });
  it('タイムアタックは再出題しない', () => {
    const run = new ReflexRun(keys, createRng(1), { requeue: false });
    while (!run.done) run.settle(false);
    expect(run.items).toHaveLength(keys.length);
  });
});

describe('反射できるかの判定', () => {
  const T = 100;
  const after = (answers: [number, boolean][], limitMs = 4000) => {
    let st: ItemState | undefined;
    for (const [ms, ok] of answers) {
      st = review(st, ok, T, T, IL_SRS, ok && ms > limitMs * SLOW_RATIO ? 'low' : undefined);
      st.recent = [...(st.recent ?? []), { ms, ok }].slice(-5);
    }
    return st;
  };
  it('直近3回すべて正解かつ制限時間の50%以内', () => {
    expect(isReflexive(after([[1000, true], [1500, true], [2000, true]]), 4000)).toBe(true);
    expect(isReflexive(after([[1000, true], [1500, true], [2001, true]]), 4000)).toBe(false);
    expect(isReflexive(after([[1000, true], [1000, true]]), 4000)).toBe(false);
    expect(isReflexive(after([[1000, true], [900, false], [1000, true], [1000, true]]), 4000)).toBe(false);
    expect(isReflexive(after([[900, false], [1000, true], [1000, true], [1000, true]]), 4000)).toBe(true);
  });
  it('直近5回まで残す', () => {
    const st = after([[1, true], [2, true], [3, true], [4, true], [5, true], [6, true], [7, true]]);
    expect(st!.recent!.map((x) => x.ms)).toEqual([3, 4, 5, 6, 7]);
  });
  it('弱点: まちがえた・時間切れ・遅い正解', () => {
    expect(isWeak(after([[500, false]]))).toBe(true);
    expect(isWeak(after([[3500, true]]))).toBe(true);
    expect(isWeak(after([[800, true]]))).toBe(false);
    expect(isWeak(undefined)).toBe(false);
  });
  it('グループ別・章別の反射率', () => {
    const q = QS[0];
    const items = { [q.id]: { box: 3, due: 0, seen: 3, correct: 3, wrong: 0, last: 0, lastOk: true, recent: [{ ms: 100, ok: true }, { ms: 100, ok: true }, { ms: 100, ok: true }] } };
    const m = reflexRates(QS, items);
    expect(m.get(q.group)!.reflex).toBe(1);
    expect([...m.values()].reduce((n, x) => n + x.total, 0)).toBe(QS.length);
    expect(chapterReflex(QS, items).get(q.chapter)!.reflex).toBe(1);
  });
});

describe('出題方法', () => {
  const rng = () => createRng(7);
  it('ウォームアップは全グループから10問', () => {
    const s = normalizeReflexSettings({ method: 'warmup' });
    const keys = reflexPick(reflexCandidates(pool, s), {}, s, 100, rng());
    expect(keys).toHaveLength(WARMUP_COUNT);
    const groups = new Set(keys.map((k) => QS.find((q) => q.id === k)!.group));
    expect(groups.size).toBe(7);
  });
  it('グループ集中・図→語・語→イメージ', () => {
    const g = normalizeReflexSettings({ method: 'group', group: '助動詞' });
    const gk = reflexPick(reflexCandidates(pool, g), {}, g, 100, rng());
    expect(gk.every((k) => QS.find((q) => q.id === k)!.group === '助動詞')).toBe(true);
    const f = normalizeReflexSettings({ method: 'fig' });
    expect(new Set(reflexCandidates(pool, f).map((c) => QS.find((q) => q.id === c.key)!.type))).toEqual(new Set(['r_fig2word', 'r_prep_icon']));
    const w = normalizeReflexSettings({ method: 'word' });
    expect(new Set(reflexCandidates(pool, w).map((c) => QS.find((q) => q.id === c.key)!.type))).toEqual(new Set(['r_word2image', 'r_word2fig', 'r_prep_word2icon']));
    expect(reflexPick(reflexCandidates(pool, w), {}, w, 100, rng())).toHaveLength(RUSH_COUNT);
  });
  it('弱点: 弱点の問題だけ、多いときは新しい順に20問', () => {
    const s = normalizeReflexSettings({ method: 'weak' });
    const items: Record<string, ItemState> = {};
    QS.slice(0, 30).forEach((q, k) => (items[q.id] = { box: 1, due: 0, seen: 1, correct: 0, wrong: 1, last: k, lastOk: false }));
    items[QS[40].id] = { box: 2, due: 0, seen: 1, correct: 1, wrong: 0, last: 99, lastOk: true }; // 弱点でない
    const keys = reflexPick(reflexCandidates(pool, s), items, s, 100, rng());
    expect(keys).toHaveLength(20);
    expect(new Set(keys)).toEqual(new Set(QS.slice(10, 30).map((q) => q.id)));
  });
  it('暗記カードはカードの id、タイムアタックは全問', () => {
    const c = normalizeReflexSettings({ method: 'cards' });
    expect(reflexCandidates(pool, c).map((x) => x.key).every((k) => CARDS.some((cd) => cd.id === k))).toBe(true);
    const a = normalizeReflexSettings({ method: 'attack' });
    expect(reflexPick(reflexCandidates(pool, a), {}, a, 100, rng())).toHaveLength(QS.length);
  });
  it('タイムアタックのベスト: 正答率 → 平均反応時間', () => {
    const r = (correct: number, avgMs: number) => ({ correct, total: 10, avgMs, at: 0 });
    expect(better(r(9, 2000), r(8, 1000))).toBe(true);
    expect(better(r(8, 900), r(8, 1000))).toBe(true);
    expect(better(r(8, 1100), r(8, 1000))).toBe(false);
    expect(better(r(1, 1), null)).toBe(true);
  });
  it('結果の集計（初回の回答だけ）', () => {
    const s = summarize([
      { key: 'a', ok: true, timeout: false, slow: false, ms: 1000, first: true, again: false, card: false },
      { key: 'b', ok: false, timeout: true, slow: false, ms: 4000, first: true, again: false, card: false },
      { key: 'c', ok: true, timeout: false, slow: true, ms: 3000, first: true, again: false, card: false },
      { key: 'b', ok: true, timeout: false, slow: false, ms: 500, first: false, again: true, card: false },
    ]);
    expect(s).toEqual({ firstTotal: 3, firstCorrect: 2, avgMs: 2000, missed: ['b'], slow: ['c'] });
  });
});

describe('スモークテスト（全データ）', () => {
  it('238問・カード60枚、id は r_ で重ならない', () => {
    expect(QS).toHaveLength(238);
    expect(CARDS).toHaveLength(60);
    const ids = [...QS, ...CARDS].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('r_'))).toBe(true);
  });
  it('全問題で4択が成立する（重複なし・正解は1つ・制限時間3〜5秒）', () => {
    for (const q of QS) {
      for (let seed = 1; seed <= 5; seed++) {
        const b = buildChoices(q, createRng(seed));
        expect(b, q.id).not.toBeNull();
        expect(b!.choices).toHaveLength(4);
        expect(new Set(b!.choices.map((c) => c.image ?? c.text)).size).toBe(4);
        const right = b!.choices[b!.answer];
        expect(right.image ?? right.text).toBe(q.answer_figure ? `./data/imagelink-reflex/${q.answer_figure}` : q.answer);
      }
      expect(q.time_limit_sec).toBeGreaterThanOrEqual(3);
      expect(q.time_limit_sec).toBeLessThanOrEqual(5);
    }
  });
  it('図のファイルがすべてある', () => {
    const missing = QS.flatMap((q) => [q.figure, q.answer_figure, ...(q.distractor_figures ?? [])]).filter((f) => f && !existsSync(join(ROOT, f)));
    expect(missing).toEqual([]);
  });
  it('validate.py が通る', () => {
    if (spawnSync('python3', ['--version']).status !== 0) return;
    expect(execFileSync('python3', [join(ROOT, 'validate.py')], { encoding: 'utf8' })).toContain('problems 0');
  });
});

// ---- 図の中の答えを伏せる ----
import { figureTerms, hasTerm, maskSvg, figureLabels, svgAspect } from '../src/modes/reflex/figmask.ts';

describe('図の答えを伏せる', () => {
  it('語のラベルを伏せる単位に分ける', () => {
    expect(figureTerms('冠詞（無冠詞・a・the）')).toEqual(expect.arrayContaining(['冠詞', '無冠詞', 'a', 'the']));
    expect(figureTerms('some と any')).toEqual(['some', 'any']);
    expect(figureTerms('五文型')).toContain('文型');
    expect(figureTerms('to不定詞と動名詞')).toEqual(expect.arrayContaining(['to不定詞', '不定詞', '動名詞']));
  });
  it('英語は単語として、日本語は部分一致（空白は無視）', () => {
    expect(hasTerm('a fish（1匹）', ['a'])).toBe(true);
    expect(hasTerm('fish（魚肉）', ['a'])).toBe(false);
    expect(hasTerm('There is 〜', ['there'])).toBe(true);
    expect(hasTerm('to 不定詞：これから', ['to不定詞'])).toBe(true);
    expect(hasTerm('第一文型 SV', ['文型'])).toBe(true);
  });
  it('答えを含む <text> だけを「？」にする', () => {
    const svg = '<svg viewBox="0 0 300 100"><text x="1">無冠詞：中身だけ</text><text x="2"><tspan>the</tspan>：特定</text><text x="3">fish（魚肉）</text></svg>';
    const r = maskSvg(svg, figureTerms('冠詞（無冠詞・a・the）'));
    expect(r.masked).toBe(2);
    expect(r.svg).toContain('<text x="1">？</text>');
    expect(r.svg).toContain('<text x="2">？</text>');
    expect(r.svg).toContain('fish（魚肉）');
    expect(svgAspect(svg)).toBe(3);
  });
  it('全データ: 図→語・語→図で、答えの語が図に残らない', () => {
    const labels = figureLabels(QS);
    const leaks: string[] = [];
    for (const q of QS) {
      const f = q.type === 'r_fig2word' ? q.figure : q.type === 'r_word2fig' ? q.answer_figure : null;
      if (!f) continue;
      const raw = readFileSync(join(ROOT, f), 'utf8');
      const { svg } = maskSvg(raw, (labels.get(f) ?? []).flatMap(figureTerms));
      const label = q.type === 'r_fig2word' ? q.answer! : q.prompt_ja!;
      const texts = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
      if (texts.some((t) => hasTerm(t, figureTerms(label)))) leaks.push(`${q.id} ${label}`);
    }
    expect(leaks).toEqual([]);
  });
});
