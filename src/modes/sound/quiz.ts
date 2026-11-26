// 音声変化モードの問題生成（①〜⑨）と出題の選び方。UI に依存しない（テストあり）。
import type { Question, Choice, PickInput } from '../../core/mode.ts';
import type { Candidate } from '../../core/srs.ts';
import { selectItems, arrange } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import type { SoundData, Item, RuleId, Rule, Fate, Change, Contraction, Assimilation, TFate, Compound, Symptom, Concept } from './types.ts';
import { RULE_IDS } from './types.ts';

export const MODE_ID = 'sound';

/** 出題パターン */
export type PatternId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9';
export const PATTERNS: { id: PatternId; label: string; desc: string; weight: number }[] = [
  { id: 's1', label: '聞こえ方当て', desc: '英文が実際にどう聞こえるかを選ぶ', weight: 20 },
  { id: 's2', label: '元の英文当て', desc: '聞こえ方（カタカナ）から元の英文を選ぶ', weight: 40 / 6 },
  { id: 's3', label: '原因ルール当て', desc: '英文のある箇所で起きている変化を選ぶ', weight: 20 },
  { id: 's4', label: '症状診断', desc: '聞こえ方の症状から、まず疑うルールを選ぶ', weight: 40 / 6 },
  { id: 's5', label: '元の形当て', desc: '短縮形のもとの形を選ぶ', weight: 40 / 6 },
  { id: 's6', label: '同化の対応', desc: 't・d・s・z＋y が融合するとどうなるか', weight: 40 / 6 },
  { id: 's7', label: 't の行方', desc: '黄色の t がどうなるかを選ぶ', weight: 20 },
  { id: 's8', label: '複合変化の順序', desc: '変化が起きる順を選ぶ（上級。30問答えると出題）', weight: 40 / 6 },
  { id: 's9', label: '知識問題', desc: '音声変化の考え方を問う', weight: 40 / 6 },
];
export const PATTERN_LABEL = Object.fromEntries(PATTERNS.map((p) => [p.id, p.label])) as Record<PatternId, string>;
/** ⑧ を出し始めるまでに答える問題数 */
export const COMPOUND_UNLOCK = 30;

/** t の行方 → 関係するルール（記録用） */
export const FATE_RULE: Record<Fate, RuleId> = { flap: 'flap', elide: 'elide', absorb: 'assim', clear: 'flap' };

export interface SoundSettings {
  patterns: PatternId[];
  lectures: number[];
  rules: RuleId[];
  /** 出題する最大の難易度（1〜3） */
  level: number;
  /** 補足例（source: supplement）を含める */
  supplement: boolean;
}

export const ALL_LECTURES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function normalizeSoundSettings(raw: any): SoundSettings {
  const pick = <T>(v: unknown, all: T[]): T[] => {
    if (!Array.isArray(v)) return [...all];
    const out = all.filter((x) => v.includes(x));
    return out.length ? out : [...all];
  };
  const level = typeof raw?.level === 'number' ? Math.min(3, Math.max(1, Math.round(raw.level))) : 3;
  return {
    patterns: pick(raw?.patterns, PATTERNS.map((p) => p.id)),
    lectures: pick(raw?.lectures, ALL_LECTURES),
    rules: pick(raw?.rules, RULE_IDS),
    level,
    supplement: typeof raw?.supplement === 'boolean' ? raw.supplement : true,
  };
}

/** 問題の中身（Prompt / Explain が使う） */
export type Subject =
  | { kind: 'item'; pattern: 's1' | 's2'; item: Item }
  | { kind: 'cause'; item: Item; change: Change; index: number; ask: string }
  | { kind: 'symptom'; symptom: Symptom }
  | { kind: 'contraction'; c: Contraction }
  | { kind: 'assim'; a: Assimilation }
  | { kind: 'tfate'; t: TFate }
  | { kind: 'compound'; c: Compound; letters: string[]; order: number[] }
  | { kind: 'concept'; c: Concept };

export type SoundQuestion = Question<Subject>;

/** 検索しやすい形にしたデータ */
export interface SoundIndex {
  d: SoundData;
  rule: Map<RuleId, Rule>;
  item: Map<string, Item>;
  byId: Map<string, Contraction | Assimilation | TFate | Compound | Symptom | Concept>;
  lecture: Map<number, SoundData['lectures'][number]>;
}

export function buildSoundIndex(d: SoundData): SoundIndex {
  const byId = new Map<string, any>();
  for (const k of ['contractions', 'assimilations', 'tFate', 'compounds', 'symptoms', 'concepts'] as const) for (const x of d[k]) byId.set(x.id, x);
  return {
    d,
    rule: new Map(d.rules.map((r) => [r.id, r])),
    item: new Map(d.items.map((i) => [i.id, i])),
    byId,
    lecture: new Map(d.lectures.map((l) => [l.no, l])),
  };
}

const ruleName = (ix: SoundIndex, r: RuleId) => ix.rule.get(r)?.name ?? r;
const ruleChoice = (ix: SoundIndex, r: RuleId): Choice => ({ text: ruleName(ix, r), color: ix.rule.get(r)?.color });

function make(
  pattern: PatternId,
  key: string,
  base: string,
  group: string,
  data: Subject,
  correct: Choice,
  wrong: Choice[],
  rng: Rng,
  tags: string[],
): SoundQuestion {
  const choices = shuffle([correct, ...wrong], rng);
  return {
    modeId: MODE_ID,
    key,
    base,
    group,
    pattern,
    patternLabel: PATTERN_LABEL[pattern],
    choices,
    answer: choices.indexOf(correct),
    tags,
    data,
  };
}

/** 異なる文字列を n 個まで、候補の順に取る（正解や既出と同じ文字列は飛ばす） */
function takeDistinct(cands: string[], used: Set<string>, n: number): string[] {
  const out: string[] = [];
  for (const c of cands) {
    if (out.length >= n) break;
    if (used.has(c)) continue;
    used.add(c);
    out.push(c);
  }
  return out;
}

// ---- ① 聞こえ方当て: 英文 → kana。誤答は plain と decoys ----
function q1(ix: SoundIndex, it: Item, rng: Rng): SoundQuestion | null {
  const used = new Set([it.kana]);
  const wrong = takeDistinct([it.plain, ...it.decoys], used, 3);
  if (wrong.length < 3) return null;
  return make('s1', `s1:${it.id}`, `i:${it.id}`, it.rules[0] ?? 'x', { kind: 'item', pattern: 's1', item: it }, { text: it.kana }, wrong.map((t) => ({ text: t })), rng, it.rules);
}

// ---- ② 元の英文当て: kana → text。誤答は同じルールの別項目から、モーラ数が近い順 ----
function q2(ix: SoundIndex, it: Item, rng: Rng): SoundQuestion | null {
  const others = ix.d.items.filter((x) => x.id !== it.id && x.quiz && x.text !== it.text);
  const near = (xs: Item[]) =>
    shuffle(xs, rng)
      .sort((a, b) => Math.abs(a.mora - it.mora) - Math.abs(b.mora - it.mora))
      .map((x) => x.text);
  const same = others.filter((x) => x.rules.some((r) => it.rules.includes(r)));
  const used = new Set([it.text]);
  const wrong = takeDistinct([...near(same), ...near(others)], used, 3);
  if (wrong.length < 3) return null;
  return make('s2', `s2:${it.id}`, `i:${it.id}`, it.rules[0] ?? 'x', { kind: 'item', pattern: 's2', item: it }, { text: it.text, latin: true }, wrong.map((t) => ({ text: t, latin: true })), rng, it.rules);
}

// ---- ③ 原因ルール当て: 英文の span で起きている変化 → rule。誤答は他のルール（同じ span の別ルールは除く） ----
function q3(ix: SoundIndex, it: Item, index: number, rng: Rng): SoundQuestion | null {
  const change = it.changes[index];
  if (!change) return null;
  const sameSpan = new Set(it.changes.filter((c) => c.span === change.span).map((c) => c.rule));
  const others = shuffle(RULE_IDS.filter((r) => !sameSpan.has(r)), rng).slice(0, 3);
  if (others.length < 3) return null;
  const ask = change.ask ?? `「${change.span}」で起きている変化は？`;
  return make('s3', `s3:${it.id}#${index}`, `i:${it.id}`, change.rule, { kind: 'cause', item: it, change, index, ask }, ruleChoice(ix, change.rule), others.map((r) => ruleChoice(ix, r)), rng, [change.rule]);
}

// ---- ④ 症状診断: symptom → rule ----
function q4(ix: SoundIndex, s: Symptom, rng: Rng): SoundQuestion {
  const others = shuffle(RULE_IDS.filter((r) => r !== s.rule), rng).slice(0, 3);
  return make('s4', `s4:${s.id}`, s.id, s.rule, { kind: 'symptom', symptom: s }, ruleChoice(ix, s.rule), others.map((r) => ruleChoice(ix, r)), rng, [s.rule]);
}

// ---- ⑤ 元の形当て: form → original（代表 = 先頭）。誤答は他の項目の original ----
function q5(ix: SoundIndex, c: Contraction, rng: Rng): SoundQuestion | null {
  const used = new Set(c.original);
  const wrong = takeDistinct(shuffle(ix.d.contractions.filter((x) => x.id !== c.id).map((x) => x.original[0]), rng), used, 3);
  if (wrong.length < 3) return null;
  return make('s5', `s5:${c.id}`, c.id, 'contraction', { kind: 'contraction', c }, { text: c.original[0], latin: true }, wrong.map((t) => ({ text: t, latin: true })), rng, ['contraction']);
}

// ---- ⑥ 同化の対応: combo → result（ch / j / sh / zh） ----
function q6(ix: SoundIndex, a: Assimilation, rng: Rng): SoundQuestion | null {
  const used = new Set([a.result]);
  const wrong = takeDistinct(shuffle(ix.d.assimilations.map((x) => x.result), rng), used, 3);
  if (wrong.length < 3) return null;
  return make('s6', `s6:${a.id}`, a.id, 'assim', { kind: 'assim', a }, { text: a.result, latin: true }, wrong.map((t) => ({ text: t, latin: true })), rng, ['assim']);
}

// ---- ⑦ t の行方: text（target を黄色で強調） → fate ----
function q7(ix: SoundIndex, t: TFate, rng: Rng): SoundQuestion | null {
  const labels = ix.d.fateLabels;
  const wrong = (Object.keys(labels) as Fate[]).filter((f) => f !== t.fate).map((f) => ({ text: labels[f] }));
  if (wrong.length < 3) return null;
  return make('s7', `s7:${t.id}`, t.id, FATE_RULE[t.fate], { kind: 'tfate', t }, { text: labels[t.fate] }, wrong.slice(0, 3), rng, [FATE_RULE[t.fate]]);
}

/** 手順の並びを「A → B → C」の文字列に */
const orderText = (order: number[], letters: string[]) => order.map((i) => letters[i]).join(' → ');

/**
 * ⑧ の誤答の並び: 正しい順の隣り合う2つを入れ替えたもの。足りなければ（手順が3つのときなど）別の並べ方で補う。
 * 返すのは手順の番号（steps の添字）の並び。
 */
export function wrongOrders(n: number, rng: Rng): number[][] {
  const correct = [...Array(n).keys()];
  const key = (o: number[]) => o.join(',');
  const seen = new Set([key(correct)]);
  const out: number[][] = [];
  for (let i = 0; i + 1 < n; i++) {
    const o = [...correct];
    [o[i], o[i + 1]] = [o[i + 1], o[i]];
    if (!seen.has(key(o))) {
      seen.add(key(o));
      out.push(o);
    }
  }
  const all = permutations(correct);
  for (const o of shuffle(all, rng)) {
    if (out.length >= 3) break;
    if (!seen.has(key(o))) {
      seen.add(key(o));
      out.push(o);
    }
  }
  return shuffle(out, rng).slice(0, 3);
}

function permutations(xs: number[]): number[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

// ---- ⑧ 複合変化の順序: 手順を A/B/C… として（表示順はシャッフル）並べ、正しい順の文字列を選ぶ ----
function q8(ix: SoundIndex, c: Compound, rng: Rng): SoundQuestion | null {
  const n = c.steps.length;
  if (n < 3) return null;
  // 表示する順番（steps の添字を並べ替えたもの）と、その位置に振る文字
  const display = shuffle([...Array(n).keys()], rng);
  const letterOf: string[] = [];
  display.forEach((stepIdx, pos) => (letterOf[stepIdx] = 'ABCDEFG'[pos]));
  const correctOrder = [...Array(n).keys()];
  const wrong = wrongOrders(n, rng);
  if (wrong.length < 3) return null;
  const rules = [...new Set(c.steps.map((s) => s.rule).filter((r): r is RuleId => !!r))];
  return make(
    's8',
    `s8:${c.id}`,
    c.id,
    rules[0] ?? 'x',
    { kind: 'compound', c, letters: letterOf, order: display },
    { text: orderText(correctOrder, letterOf), latin: true },
    wrong.map((o) => ({ text: orderText(o, letterOf), latin: true })),
    rng,
    rules,
  );
}

// ---- ⑨ 知識問題 ----
function q9(ix: SoundIndex, c: Concept, rng: Rng): SoundQuestion | null {
  const used = new Set([c.answer]);
  const wrong = takeDistinct(c.wrong, used, 3);
  if (wrong.length < 3) return null;
  return make('s9', `s9:${c.id}`, c.id, `l${c.lecture}`, { kind: 'concept', c }, { text: c.answer }, wrong.map((t) => ({ text: t })), rng, ix.lecture.get(c.lecture)?.rules ?? []);
}

/** 保存キー → 問題 */
export function soundQuestion(ix: SoundIndex, key: string, rng: Rng): SoundQuestion | null {
  const i = key.indexOf(':');
  const p = key.slice(0, i) as PatternId;
  const id = key.slice(i + 1);
  switch (p) {
    case 's1': {
      const it = ix.item.get(id);
      return it ? q1(ix, it, rng) : null;
    }
    case 's2': {
      const it = ix.item.get(id);
      return it ? q2(ix, it, rng) : null;
    }
    case 's3': {
      const [iid, n] = id.split('#');
      const it = ix.item.get(iid);
      return it ? q3(ix, it, Number(n), rng) : null;
    }
    case 's4': {
      const x = ix.byId.get(id) as Symptom | undefined;
      return x ? q4(ix, x, rng) : null;
    }
    case 's5': {
      const x = ix.byId.get(id) as Contraction | undefined;
      return x ? q5(ix, x, rng) : null;
    }
    case 's6': {
      const x = ix.byId.get(id) as Assimilation | undefined;
      return x ? q6(ix, x, rng) : null;
    }
    case 's7': {
      const x = ix.byId.get(id) as TFate | undefined;
      return x ? q7(ix, x, rng) : null;
    }
    case 's8': {
      const x = ix.byId.get(id) as Compound | undefined;
      return x ? q8(ix, x, rng) : null;
    }
    case 's9': {
      const x = ix.byId.get(id) as Concept | undefined;
      return x ? q9(ix, x, rng) : null;
    }
  }
  return null;
}

/** 候補がどのルールに関係するか（苦手なルールの優先に使う） */
export function candidateRules(ix: SoundIndex, key: string): RuleId[] {
  const q = soundQuestion(ix, key, () => 0.5);
  return (q?.tags ?? []) as RuleId[];
}

/** 出題範囲から候補を作る */
export function soundCandidates(ix: SoundIndex, s: SoundSettings): Candidate[] {
  const P = new Set(s.patterns);
  const L = new Set(s.lectures);
  const R = new Set(s.rules);
  const out: Candidate[] = [];
  const add = (key: string, base: string, group: string, order: number) => out.push({ key, base, group, newOrder: order });
  const okRules = (rules: RuleId[]) => rules.length === 0 || rules.some((r) => R.has(r));

  for (const it of ix.d.items) {
    if (!it.quiz || it.level > s.level || (!s.supplement && it.source === 'supplement') || !L.has(it.lecture)) continue;
    if (!okRules(it.rules)) continue;
    const order = it.lecture * 1000 + it.order;
    if (P.has('s1')) add(`s1:${it.id}`, `i:${it.id}`, it.rules[0] ?? 'x', order);
    if (P.has('s2')) add(`s2:${it.id}`, `i:${it.id}`, it.rules[0] ?? 'x', order + 0.5);
    if (P.has('s3'))
      it.changes.forEach((c, n) => {
        if (R.has(c.rule)) add(`s3:${it.id}#${n}`, `i:${it.id}`, c.rule, order + 0.1 * n);
      });
  }
  if (P.has('s4')) for (const x of ix.d.symptoms) if (L.has(x.lecture) && R.has(x.rule)) add(`s4:${x.id}`, x.id, x.rule, x.lecture * 1000);
  if (P.has('s5') && R.has('contraction')) for (const x of ix.d.contractions) if (L.has(x.lecture)) add(`s5:${x.id}`, x.id, 'contraction', x.lecture * 1000);
  if (P.has('s6') && R.has('assim')) for (const x of ix.d.assimilations) if (L.has(x.lecture)) add(`s6:${x.id}`, x.id, 'assim', x.lecture * 1000);
  if (P.has('s7')) for (const x of ix.d.tFate) if (L.has(x.lecture) && R.has(FATE_RULE[x.fate])) add(`s7:${x.id}`, x.id, FATE_RULE[x.fate], x.lecture * 1000);
  if (P.has('s8') && s.level >= 3)
    for (const x of ix.d.compounds) if (okRules(x.steps.map((st) => st.rule).filter((r): r is RuleId => !!r))) add(`s8:${x.id}`, x.id, x.id, 20000);
  if (P.has('s9')) for (const x of ix.d.concepts) if (L.has(x.lecture) && okRules(ix.lecture.get(x.lecture)?.rules ?? [])) add(`s9:${x.id}`, x.id, `l${x.lecture}`, x.lecture * 1000);
  return out;
}

/** ルールの苦手度（0〜1。高いほど苦手）。答えた数が少ないうちは 0.5 に寄せる */
export function weakness(tags: PickInput['tags'], rule: string): number {
  const t = tags[rule];
  return 1 - ((t?.correct ?? 0) + 1) / ((t?.seen ?? 0) + 2);
}

/** パターンの重みから、count 問をパターンごとに割り振る（最大剰余法。候補が足りない分は他へ回す） */
export function allocate(count: number, weights: Record<string, number>, available: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  let rest = count;
  let active = Object.keys(weights).filter((k) => (available[k] ?? 0) > 0);
  for (const k of Object.keys(weights)) out[k] = 0;
  while (rest > 0 && active.length) {
    const sum = active.reduce((a, k) => a + weights[k], 0);
    const raw = active.map((k) => ({ k, v: (rest * weights[k]) / sum }));
    let given = 0;
    for (const r of raw) {
      const n = Math.min(Math.floor(r.v), available[r.k] - out[r.k]);
      out[r.k] += n;
      given += n;
    }
    // 端数: 小数部分が大きい順に1つずつ
    for (const r of raw.sort((a, b) => (b.v % 1) - (a.v % 1))) {
      if (given >= rest) break;
      if (out[r.k] < available[r.k]) {
        out[r.k]++;
        given++;
      }
    }
    if (given === 0) break;
    rest -= given;
    active = active.filter((k) => out[k] < available[k]);
  }
  return out;
}

/**
 * 出題の選び方: パターンごとの比率（①③⑦ 多め）で割り振り、各パターンの中は間隔反復の優先順。
 * 未習の問題は、苦手なルールのものを先に出す。⑧ は COMPOUND_UNLOCK 問答えてから。
 */
export function soundPick(ix: SoundIndex, input: PickInput): Candidate[] {
  const byP = new Map<string, Candidate[]>();
  for (const c of input.cands) {
    const p = c.key.slice(0, c.key.indexOf(':'));
    if (p === 's8' && input.answered < COMPOUND_UNLOCK) continue;
    const rules = candidateRules(ix, c.key);
    const w = rules.length ? Math.max(...rules.map((r) => weakness(input.tags, r))) : 0.5;
    // 苦手度が高いほど newOrder を小さく（= 未習の中で先に出る）
    const adj = { ...c, newOrder: Math.round((1 - w) * 100) * 100000 + c.newOrder };
    if (!byP.has(p)) byP.set(p, []);
    byP.get(p)!.push(adj);
  }
  const weights: Record<string, number> = {};
  const available: Record<string, number> = {};
  for (const p of PATTERNS) {
    if (!byP.has(p.id)) continue;
    weights[p.id] = p.weight;
    available[p.id] = new Set(byP.get(p.id)!.map((c) => c.base)).size;
  }
  const quota = allocate(input.count, weights, available);
  const used = new Set<string>();
  const picked: Candidate[] = [];
  // 割り当ての多いパターンから選ぶ（同じ項目が別パターンで重ならないよう、使った base を除く）
  for (const p of Object.keys(quota).sort((a, b) => quota[b] - quota[a])) {
    const n = quota[p];
    if (!n) continue;
    const cands = byP.get(p)!.filter((c) => !used.has(c.base));
    const got = selectItems(cands, input.items, { count: n, today: input.today, rng: input.rng });
    for (const c of got) {
      used.add(c.base);
      picked.push(c);
    }
  }
  // 重なりで足りなくなった分は、残りの候補から補う
  if (picked.length < input.count) {
    const rest = [...byP.values()].flat().filter((c) => !used.has(c.base));
    for (const c of selectItems(rest, input.items, { count: input.count - picked.length, today: input.today, rng: input.rng })) {
      used.add(c.base);
      picked.push(c);
    }
  }
  return arrange(picked, input.rng, input.avoidFirst ?? null);
}
