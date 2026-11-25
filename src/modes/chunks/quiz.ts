// 会話チャンクモードの問題生成（①〜④）と出題の選び方。UI に依存しない（テストあり）。
//
// 記録（間隔反復）は表現の id 単位（例: ch-001）。出題パターンは出題のたびに決める:
//   - 通常の出題: pick() が表現を選んでからパターンを割り当て、`c1:ch-001` のようなキーで question() に渡す
//   - 復習リスト: question('ch-001') の形で呼ばれるので、その表現に使えるパターンをその場で選ぶ
// 使い分け（pairs）は組の片側ごと（例: pr-01#a）に記録する。
import type { Question, Choice, PickInput } from '../../core/mode.ts';
import type { Candidate, ItemState } from '../../core/srs.ts';
import { isDue, arrange, LEARNED_BOX } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import type { ChunkData, Entry, Pair, Priority } from './types.ts';
import { PRIORITIES } from './types.ts';

export const MODE_ID = 'chunks';

export type PatternId = 'c1' | 'c2' | 'c3' | 'c4';
export const PATTERNS: { id: PatternId; label: string; desc: string; weight: number }[] = [
  { id: 'c1', label: '英 → 和', desc: 'チャンクを見て意味を選ぶ', weight: 25 },
  { id: 'c2', label: '和 → 英', desc: '意味を見てチャンクを選ぶ', weight: 25 },
  { id: 'c3', label: '穴埋め', desc: '例文の空所に入るチャンクを選ぶ', weight: 35 },
  { id: 'c4', label: '使い分け', desc: '間違えやすい2つの表現のどっち？', weight: 15 },
];
export const PATTERN_LABEL = Object.fromEntries(PATTERNS.map((p) => [p.id, p.label])) as Record<PatternId, string>;

/** 1セッションで新しく導入する表現の上限（10問あたり5件） */
export const NEW_PER_SESSION = 0.5;
/** 次の優先度を解放する習得率 */
export const UNLOCK_RATE = 0.7;
export const ALL_SECTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export interface ChunkSettings {
  patterns: PatternId[];
  /** 習得に合わせて A → B → C を自動で解放する */
  autoUnlock: boolean;
  /** 自動で解放しないときに出す優先度 */
  priorities: Priority[];
  sections: number[];
  /** NZ・英（region に nz / uk）の表現を含める */
  regional: boolean;
}

export function normalizeChunkSettings(raw: any): ChunkSettings {
  const pick = <T>(v: unknown, all: T[]): T[] => {
    if (!Array.isArray(v)) return [...all];
    const out = all.filter((x) => v.includes(x));
    return out.length ? out : [...all];
  };
  return {
    patterns: pick(raw?.patterns, PATTERNS.map((p) => p.id)),
    autoUnlock: typeof raw?.autoUnlock === 'boolean' ? raw.autoUnlock : true,
    priorities: pick(raw?.priorities, PRIORITIES),
    sections: pick(raw?.sections, ALL_SECTIONS),
    regional: typeof raw?.regional === 'boolean' ? raw.regional : true,
  };
}

export type Subject =
  | { kind: 'entry'; pattern: 'c1' | 'c2' | 'c3'; entry: Entry; fill?: string }
  | { kind: 'pair'; pair: Pair; side: 'a' | 'b' };

export type ChunkQuestion = Question<Subject>;

export interface ChunkIndex {
  d: ChunkData;
  byNum: Map<number, Entry>;
  byId: Map<string, Entry>;
  pair: Map<string, Pair>;
  section: Map<number, ChunkData['sections'][number]>;
}

export function buildChunkIndex(d: ChunkData): ChunkIndex {
  return {
    d,
    byNum: new Map(d.entries.map((e) => [e.num, e])),
    byId: new Map(d.entries.map((e) => [e.id, e])),
    pair: new Map(d.pairs.map((p) => [p.id, p])),
    section: new Map(d.sections.map((s) => [s.no, s])),
  };
}

// ---------- 習得と解放 ----------

/** 習得済み: 間隔反復の箱が 3 以上（＝連続3回正解し、次の間隔が7日以上） */
export const isMastered = (s: ItemState | undefined) => !!s && s.box >= LEARNED_BOX;

export function masteredCount(ix: ChunkIndex, items: Record<string, ItemState>, p: Priority): { done: number; total: number } {
  let done = 0, total = 0;
  for (const e of ix.d.entries)
    if (e.priority === p) {
      total++;
      if (isMastered(items[e.id])) done++;
    }
  return { done, total };
}

/** 出題する優先度。自動なら A から始め、前の段階の習得が7割を超えたら次を解放する */
export function unlockedPriorities(ix: ChunkIndex, items: Record<string, ItemState>, s: ChunkSettings): Priority[] {
  if (!s.autoUnlock) return s.priorities;
  const out: Priority[] = ['A'];
  for (const [prev, next] of [['A', 'B'], ['B', 'C']] as const) {
    const m = masteredCount(ix, items, prev);
    if (m.total && m.done / m.total >= UNLOCK_RATE && out.includes(prev)) out.push(next);
  }
  return out;
}

// ---------- 選択肢 ----------

/** その表現に使える出題パターン */
export function eligible(e: Entry, patterns: PatternId[]): ('c1' | 'c2' | 'c3')[] {
  const out: ('c1' | 'c2' | 'c3')[] = [];
  if (patterns.includes('c1')) out.push('c1');
  if (patterns.includes('c2') && !e.ambiguous) out.push('c2');
  if (patterns.includes('c3') && e.blank) out.push('c3');
  return out;
}

/** a と b は意味が重なる（どちら側に書かれていても） */
function overlapping(a: Entry, b: Entry): boolean {
  return a.sameMeaning.includes(b.num) || a.similarMeaning.includes(b.num) || b.sameMeaning.includes(a.num) || b.similarMeaning.includes(a.num);
}

/** 穴埋めに入れる形。blank があればその答え、なければ bare から「...」と文末の記号を除いた形 */
export function fillOf(e: Entry): string {
  if (e.blank) return e.blank.answer;
  return e.bare.replace(/\.\.\.|…/g, ' ').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
}

/** 穴の位置に合わせて、先頭の大文字・小文字をそろえる（形の違いで答えが分からないように） */
function caseFor(text: string, sentenceStart: boolean): string {
  if (!text) return text;
  if (sentenceStart) return text[0].toUpperCase() + text.slice(1);
  // 文中: I / I'm など以外は小文字で始める
  if (/^I\b/.test(text)) return text;
  return text[0].toLowerCase() + text.slice(1);
}

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * 誤答の候補を並べる: near（形が近い順）→ 同じ章 → 全体。
 * 意味が重なる表現（sameMeaning / similarMeaning）と、文字列が同じものは除く。
 */
function distractors(ix: ChunkIndex, e: Entry, text: (x: Entry) => string, rng: Rng, n = 3, prefer?: (x: Entry) => number): string[] {
  const near = e.near.map((k) => ix.byNum.get(k)!).filter(Boolean);
  const sameSec = shuffle(ix.d.entries.filter((x) => x.section === e.section), rng);
  const rest = shuffle(ix.d.entries, rng);
  let pool = [...near, ...sameSec, ...rest].filter((x) => x.num !== e.num && !overlapping(e, x));
  // 「自然に成り立ちやすい」候補などを後回しに（安定ソート）
  if (prefer) pool = pool.map((x, i) => ({ x, i, p: prefer(x) })).sort((a, b) => a.p - b.p || a.i - b.i).map((o) => o.x);
  const used = new Set([text(e)]);
  const out: string[] = [];
  for (const x of pool) {
    if (out.length >= n) break;
    const t = text(x);
    if (!t || used.has(t)) continue;
    used.add(t);
    out.push(t);
  }
  return out;
}

function make(pattern: PatternId, key: string, base: string, group: string, data: Subject, correct: Choice, wrong: Choice[], rng: Rng, tags: string[]): ChunkQuestion {
  const choices = shuffle([correct, ...wrong], rng);
  return { modeId: MODE_ID, key, base, group, pattern, patternLabel: PATTERN_LABEL[pattern], choices, answer: choices.indexOf(correct), tags, data };
}

const entryTags = (e: Entry) => [`sec:${e.section}`, `pri:${e.priority}`];

function entryQuestion(ix: ChunkIndex, e: Entry, p: 'c1' | 'c2' | 'c3', rng: Rng): ChunkQuestion | null {
  const group = `sec:${e.section}`;
  if (p === 'c1') {
    const wrong = distractors(ix, e, (x) => x.meaning, rng);
    if (wrong.length < 3) return null;
    return make('c1', e.id, e.id, group, { kind: 'entry', pattern: 'c1', entry: e }, { text: e.meaning }, wrong.map((t) => ({ text: t })), rng, entryTags(e));
  }
  if (p === 'c2') {
    if (e.ambiguous) return null;
    const wrong = distractors(ix, e, (x) => x.bare, rng);
    if (wrong.length < 3) return null;
    return make('c2', e.id, e.id, group, { kind: 'entry', pattern: 'c2', entry: e }, { text: e.bare, latin: true }, wrong.map((t) => ({ text: t, latin: true })), rng, entryTags(e));
  }
  // c3 穴埋め
  if (!e.blank) return null;
  const start = e.blank.text.trimStart().startsWith('＿＿＿＿');
  const answer = caseFor(e.blank.answer, start);
  const aw = words(answer);
  // 頭の単語と語数が正解と同じもの（How often に対する How long など）は文に当てはめても成り立ちやすいので後回し。
  // 穴埋めの文が同じになる表現も避ける
  const fits = (x: Entry) => {
    const w = words(fillOf(x));
    return (w[0] === aw[0] && w.length === aw.length ? 1 : 0) + (x.blank?.text === e.blank!.text ? 2 : 0);
  };
  const wrong = distractors(ix, e, (x) => caseFor(fillOf(x), start), rng, 3, fits).filter((t) => t.toLowerCase() !== answer.toLowerCase());
  if (wrong.length < 3) return null;
  return make('c3', e.id, e.id, group, { kind: 'entry', pattern: 'c3', entry: e, fill: answer }, { text: answer, latin: true }, wrong.map((t) => ({ text: t, latin: true })), rng, entryTags(e));
}

function pairQuestion(ix: ChunkIndex, pair: Pair, side: 'a' | 'b', rng: Rng): ChunkQuestion | null {
  const me = pair[side];
  const other = pair[side === 'a' ? 'b' : 'a'];
  const used = new Set([me.en, other.en]);
  const others: string[] = [];
  for (const p of shuffle(ix.d.pairs.filter((x) => x.id !== pair.id), rng)) {
    if (others.length >= 2) break;
    const t = p[rng() < 0.5 ? 'a' : 'b'].en;
    if (used.has(t)) continue;
    used.add(t);
    others.push(t);
  }
  if (others.length < 2 || me.en === other.en) return null;
  const key = `${pair.id}#${side}`;
  return make('c4', key, pair.id, 'pairs', { kind: 'pair', pair, side }, { text: me.en, latin: true }, [other.en, ...others].map((t) => ({ text: t, latin: true })), rng, ['pairs']);
}

/** 重みつきで1つ選ぶ */
function weighted<T extends string>(xs: T[], w: (x: T) => number, rng: Rng): T {
  const sum = xs.reduce((a, x) => a + w(x), 0);
  let r = rng() * sum;
  for (const x of xs) {
    r -= w(x);
    if (r <= 0) return x;
  }
  return xs[xs.length - 1];
}

/** キー → 問題。`c1:ch-001`（パターン指定）/ `ch-001`（復習: パターンはその場で）/ `pr-01#a`・`c4:pr-01#a`（使い分け） */
export function chunkQuestion(ix: ChunkIndex, key: string, rng: Rng, patterns: PatternId[] = ['c1', 'c2', 'c3', 'c4']): ChunkQuestion | null {
  let p: PatternId | null = null;
  let id = key;
  const m = key.match(/^(c[1-4]):(.+)$/);
  if (m) {
    p = m[1] as PatternId;
    id = m[2];
  }
  if (id.includes('#')) {
    const [pid, side] = id.split('#');
    const pair = ix.pair.get(pid);
    return pair && (side === 'a' || side === 'b') ? pairQuestion(ix, pair, side, rng) : null;
  }
  const e = ix.byId.get(id);
  if (!e) return null;
  if (p && p !== 'c4') {
    const q = entryQuestion(ix, e, p, rng);
    if (q) return q;
  }
  // パターン未指定（復習）・使えないパターン: 使えるものから重みつきで選ぶ
  let el = eligible(e, patterns);
  if (!el.length) el = eligible(e, ['c1', 'c2', 'c3']);
  const tried = new Set<string>();
  while (tried.size < el.length) {
    const choice = weighted(el.filter((x) => !tried.has(x)), (x) => PATTERNS.find((pp) => pp.id === x)!.weight, rng);
    tried.add(choice);
    const q = entryQuestion(ix, e, choice, rng);
    if (q) return q;
  }
  return null;
}

// ---------- 出題範囲と選び方 ----------

const isRegional = (e: Entry) => e.region.includes('nz') || e.region.includes('uk');

/** 出題範囲の候補（優先度の解放は pick で絞る） */
export function chunkCandidates(ix: ChunkIndex, s: ChunkSettings): Candidate[] {
  const S = new Set(s.sections);
  const out: Candidate[] = [];
  for (const e of ix.d.entries) {
    if (!S.has(e.section) || (!s.regional && isRegional(e))) continue;
    if (!eligible(e, s.patterns).length) continue;
    out.push({ key: e.id, base: e.id, group: `sec:${e.section}`, newOrder: e.section * 1000 + e.num });
  }
  if (s.patterns.includes('c4'))
    ix.d.pairs.forEach((p, i) => {
      for (const side of ['a', 'b'] as const) out.push({ key: `${p.id}#${side}`, base: p.id, group: 'pairs', newOrder: 100000 + i * 2 + (side === 'b' ? 1 : 0) });
    });
  return out;
}

/** パターンの重みから n 問を割り振る（最大剰余法） */
export function allocate(n: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  const out: Record<string, number> = {};
  if (!sum) return out;
  const raw = keys.map((k) => ({ k, v: (n * weights[k]) / sum }));
  let given = 0;
  for (const r of raw) {
    out[r.k] = Math.floor(r.v);
    given += out[r.k];
  }
  for (const r of raw.sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (given >= n) break;
    out[r.k]++;
    given++;
  }
  return out;
}

/**
 * 間隔反復の段で並べる: 期限切れ×前回まちがい → 期限切れ → （新しい表現）→ 期限前。
 * 新しい表現は上限 newCap まで。それでも足りないときだけ、新しい表現でさらに埋める。
 */
function pickByTier(cands: Candidate[], items: Record<string, ItemState>, count: number, newCap: number, today: number, rng: Rng): Candidate[] {
  const j = new Map(cands.map((c) => [c.key, rng()]));
  const st = (c: Candidate) => items[c.key];
  const wrong: Candidate[] = [], due: Candidate[] = [], fresh: Candidate[] = [], later: Candidate[] = [];
  for (const c of cands) {
    const s = st(c);
    if (!s) fresh.push(c);
    else if (!isDue(s, today)) later.push(c);
    else if (!s.lastOk) wrong.push(c);
    else due.push(c);
  }
  wrong.sort((a, b) => st(a).due - st(b).due || j.get(a.key)! - j.get(b.key)!);
  due.sort((a, b) => st(a).due - st(b).due || j.get(a.key)! - j.get(b.key)!);
  fresh.sort((a, b) => a.newOrder - b.newOrder);
  later.sort((a, b) => st(a).due - st(b).due || j.get(a.key)! - j.get(b.key)!);
  const out: Candidate[] = [];
  const bases = new Set<string>();
  const take = (list: Candidate[], limit: number) => {
    let n = 0;
    for (const c of list) {
      if (out.length >= count || n >= limit) break;
      if (bases.has(c.base)) continue;
      bases.add(c.base);
      out.push(c);
      n++;
    }
  };
  take(wrong, Infinity);
  take(due, Infinity);
  take(fresh, newCap);
  take(later, Infinity);
  take(fresh, Infinity); // 復習するものが足りないときだけ、新しい表現で埋める
  return out;
}


/**
 * 出題の選び方:
 *   1. 優先度の解放（自動なら A → B → C）で表現を絞る
 *   2. 使い分け（④）に比率の分（15%）を割り当て、残りを表現に
 *   3. 表現は「まちがえた・期限切れ → 新しい表現（1回最大5件・章の順）→ 期限前」
 *   4. 選んだ表現に ①②③ を比率（25:25:35）で割り当てる（使えないパターンは避ける）
 */
export function chunkPick(ix: ChunkIndex, input: PickInput, s: ChunkSettings): Candidate[] {
  const allowed = new Set(unlockedPriorities(ix, input.items, s));
  const entryCands = input.cands.filter((c) => !c.key.includes('#') && allowed.has(ix.byId.get(c.key)!.priority));
  const pairCands = input.cands.filter((c) => c.key.includes('#'));
  const weights = Object.fromEntries(PATTERNS.filter((p) => s.patterns.includes(p.id)).map((p) => [p.id, p.weight]));
  const quota = allocate(input.count, weights);
  const pairCount = Math.min(quota.c4 ?? 0, new Set(pairCands.map((c) => c.base)).size);
  const newCap = Math.max(1, Math.floor(input.count * NEW_PER_SESSION));

  const pairs = pickByTier(pairCands, input.items, pairCount, pairCount, input.today, input.rng);
  let entries = pickByTier(entryCands, input.items, input.count - pairs.length, newCap, input.today, input.rng);
  // 表現が足りなければ使い分けで補う（その逆も）
  const short = input.count - pairs.length - entries.length;
  const morePairs = short > 0 ? pickByTier(pairCands.filter((c) => !pairs.some((p) => p.base === c.base)), input.items, short, short, input.today, input.rng) : [];

  // ①②③ の割り当て: 使えるパターンが少ない表現から順に、残り枠の多いパターンへ
  const ep = (['c1', 'c2', 'c3'] as const).filter((p) => s.patterns.includes(p));
  const left = allocate(entries.length, Object.fromEntries(ep.map((p) => [p, weights[p]])));
  const withEl = entries.map((c) => ({ c, el: eligible(ix.byId.get(c.key)!, s.patterns) }));
  withEl.sort((a, b) => a.el.length - b.el.length);
  const assigned: Candidate[] = [];
  for (const { c, el } of withEl) {
    if (!el.length) continue;
    const best = shuffle(el, input.rng).sort((a, b) => (left[b] ?? 0) - (left[a] ?? 0))[0];
    left[best] = (left[best] ?? 0) - 1;
    assigned.push({ ...c, key: `${best}:${c.key}` });
  }
  entries = assigned;
  const all = [...entries, ...pairs, ...morePairs].map((c) => (c.key.includes('#') && !c.key.startsWith('c4:') ? { ...c, key: `c4:${c.key}` } : c));
  return arrange(all, input.rng, input.avoidFirst ?? null);
}
