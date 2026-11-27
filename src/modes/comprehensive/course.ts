// 総合英語モードの学習計画（UI に依存しない。tests/comprehensive.test.ts）
//   - 索引（ID → 問題・項目・図解・会話・読解）
//   - 問題の段階（route: 復習 → 単語 → 熟語 → チャンク → 文法 → 英作文 → 言い換え → 音声 → 会話 → 読解 → 混合 → 再挑戦）
//   - 記録の単位（itemIds があれば項目ごと、なければ問題ID）と習熟度（未学習・認識・想起・活用・定着）
//   - 日程の進み方（学習した日ごとに1日進む。休んでも一度にまとめて進めない）
//   - 今日のキュー（learning_policy の予算。全候補を必須にしない・必須の未出題は繰り越し・復習がたまれば新規を減らす）
import type { ItemState, SrsConfig } from '../../core/srs.ts';
import { isDue } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import { isOpenKind, choicesFromPrompt } from './grade.ts';
import type { CompData, CQuestion, Item, Visual, Scenario, ReadingDoc, GrammarGroup, PronGroup, Profile, Priority, Day } from './types.ts';

export const MODE_ID = 'comprehensive';

/** 0/1/3/7/14/30 日。0 は当日の再挑戦。ヒント・あやしいの正解では箱を進めない */
export const COMP_SRS: SrsConfig = { intervals: [0, 1, 3, 7, 14, 30], startBox: 0, resetBox: 0, holdOnLow: true };
/** この箱以上で、遅れて正解できた（7日以上あけて正解）＝ 定着の条件 */
export const RETENTION_BOX = 4;

export type Stage =
  | 'review'
  | 'vocabulary'
  | 'idiom'
  | 'chunk'
  | 'grammar'
  | 'translation'
  | 'paraphrase'
  | 'listening'
  | 'scenario'
  | 'reading'
  | 'mixed'
  | 'retry';
export const STAGES: Stage[] = ['review', 'vocabulary', 'idiom', 'chunk', 'grammar', 'translation', 'paraphrase', 'listening', 'scenario', 'reading', 'mixed', 'retry'];
export const STAGE_LABEL: Record<Stage, string> = {
  review: '復習',
  vocabulary: '英単語',
  idiom: '熟語・コロケーション',
  chunk: 'チャンク',
  grammar: '英文法',
  translation: '瞬間英作文',
  paraphrase: '言い換え',
  listening: '発音・リスニング',
  scenario: '会話',
  reading: '実践読解',
  mixed: '混合演習',
  retry: '間違い直し',
};

export interface CompIndex {
  d: CompData;
  q: Map<string, CQuestion>;
  item: Map<string, Item>;
  day: Map<number, Day>;
  /** 項目 → その項目を使う問題 */
  itemQs: Map<string, string[]>;
  /** 問題 → 関連する図解 */
  qVisual: Map<string, Visual[]>;
  /** 項目 → 関連する図解 */
  itemVisual: Map<string, Visual[]>;
  grammar: Map<string, GrammarGroup>;
  pron: Map<string, PronGroup>;
  scenario: Map<string, Scenario>;
  reading: Map<string, ReadingDoc>;
  /** 別名と正の問題をまとめるキー（同じセッションで重ねない） */
  dupKey: Map<string, string>;
  /** 同じ英語表記の項目どうし（同じセッションで重ねない） */
  sameEn: Map<string, string>;
}

export function buildIndex(d: CompData): CompIndex {
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
    const a = m.get(k);
    if (a) {
      if (!a.includes(v)) a.push(v);
    } else m.set(k, [v]);
  };
  const itemQs = new Map<string, string[]>();
  for (const q of d.questions) for (const i of q.itemIds) push(itemQs, i, q.id);
  const qVisual = new Map<string, Visual[]>();
  const itemVisual = new Map<string, Visual[]>();
  for (const v of d.visuals) {
    for (const id of v.questionIds) push(qVisual, id, v);
    for (const id of v.itemIds) push(itemVisual, id, v);
    for (const n of v.nodes) if (typeof n.itemId === 'string') push(itemVisual, n.itemId, v);
  }
  const dupKey = new Map<string, string>();
  for (const [a, c] of Object.entries(d.aliases)) {
    dupKey.set(a, c);
    dupKey.set(c, c);
  }
  const sameEn = new Map<string, string>();
  for (const g of d.sameEnglish) for (const id of g) sameEn.set(id, g[0]);
  return {
    d,
    q: new Map(d.questions.map((q) => [q.id, q])),
    item: new Map(d.items.map((i) => [i.id, i])),
    day: new Map(d.days.map((x) => [x.day, x])),
    itemQs,
    qVisual,
    itemVisual,
    grammar: new Map(d.grammar.map((g) => [g.id, g])),
    pron: new Map(d.pronunciation.map((g) => [g.id, g])),
    scenario: new Map(d.scenarios.map((s) => [s.id, s])),
    reading: new Map(d.readings.map((r) => [r.id, r])),
    dupKey,
    sameEn,
  };
}

/** 問題の段階 */
export function stageOf(ix: CompIndex, q: CQuestion): Stage {
  if (q.conversationId) return 'scenario';
  if (q.readingId || q.kind === 'reading') return 'reading';
  if (q.kind === 'listening' || q.kind === 'dictation') return 'listening';
  if (q.kind === 'paraphrase') return 'paraphrase';
  if (q.kind === 'correction' || q.grammarId || q.subtype === 'grammar_fill') return 'grammar';
  if (q.kind === 'translation') return 'translation';
  const it = q.itemIds.map((i) => ix.item.get(i)).find(Boolean);
  return it ? it.kind : 'vocabulary';
}

/** 音声が要る問題（聞き取り・書き取り） */
export const needsAudio = (q: CQuestion) => q.kind === 'listening' || q.kind === 'dictation';
/** 文字の入力が要る問題（自由回答・選ぶ問題は入力なしでも進められる） */
export const needsTyping = (q: CQuestion) => !isOpenKind(q.kind, q.subtype) && !choicesFromPrompt(q.prompt, q.acceptedAnswers);
/** 最初から自己採点の問題（言い換え・会話の返答） */
export const needsSelf = (q: CQuestion) => isOpenKind(q.kind, q.subtype);
/** 今の状況（設定）で出してよい問題か */
export interface Situation {
  audio: boolean;
  typing: 'on' | 'self' | 'skip';
  /** false: 自己採点の問題を出さない（省略時は出す） */
  selfGrade?: boolean;
}
export const allowedBy = (q: CQuestion, sit?: Situation) =>
  !sit || ((sit.audio || !needsAudio(q)) && (sit.typing !== 'skip' || !needsTyping(q)) && (sit.selfGrade !== false || !needsSelf(q)));

/** 記録の単位（itemIds が空なら問題ID） */
export const keysOf = (q: CQuestion) => (q.itemIds.length ? q.itemIds : [q.id]);

// ---- 習熟度 ----
export type Mastery = 'unlearned' | 'recognition' | 'recall' | 'use' | 'retention';
export const MASTERY_LABEL: Record<Mastery, string> = { unlearned: '未学習', recognition: '認識', recall: '想起', use: '活用', retention: '定着' };
export const MASTERIES: Mastery[] = ['unlearned', 'recognition', 'recall', 'use', 'retention'];

/** 記録の単位ごとの証拠（Progress.extra.ev）。数値は学習日（dayNumber） */
export interface Evidence {
  /** 学習カードを見た（認識） */
  r?: number;
  /** 想起の問題（単語を思い出す・書き取り）に正解した日 */
  rc?: number;
  /** 活用の問題（英作文・言い換え・訂正・会話）に正解した日 */
  u?: number;
  /** ヒントを使った回数・自己採点の回数・誤答の回数 */
  h?: number;
  s?: number;
  w?: number;
}

/** 想起の種類 / 活用の種類 */
const USE_KINDS = new Set(['translation', 'paraphrase', 'correction']);
/** 使う問題（英作文・言い換え・訂正・会話の返答）か、思い出す問題（単語・書き取り・聞き取り・読解）か */
export const evidenceKind = (q: CQuestion): 'recall' | 'use' => (USE_KINDS.has(q.kind) || q.conversationId ? 'use' : 'recall');

/**
 * 習熟度。1回正解しただけでは定着にしない:
 *   認識 = 学習カードを見た / 想起 = 思い出す問題に正解 / 活用 = 使う問題に正解 /
 *   定着 = 想起か活用の証拠があり、間隔反復で7日以上あけても正解して箱4以上
 */
export function masteryOf(st: ItemState | undefined, ev: Evidence | undefined): Mastery {
  const recalled = !!ev?.rc, used = !!ev?.u;
  if ((recalled || used) && st && st.box >= RETENTION_BOX && st.lastOk) return 'retention';
  if (used) return 'use';
  if (recalled) return 'recall';
  if (ev?.r || st) return 'recognition';
  return 'unlearned';
}

// ---- 日程 ----
export interface CourseDayState {
  /** 今の日程（1〜60。61 = 60日を終えた後） */
  day: number;
  /** 最後に学習した学習日（dayNumber。-1 = まだ） */
  last: number;
  /** その日に新しい内容を進めたか */
  progressed: boolean;
}
export const INITIAL_DAY: CourseDayState = { day: 1, last: -1, progressed: false };
export const AFTER_COURSE = 61;

/**
 * 今日の日程。前に学習した日に内容を進めていれば、別の日になったら1日だけ進む
 * （休んだ日数ぶん一度に進めない。同じ日に何回始めても進まない）
 */
export function courseDayFor(st: CourseDayState, today: number): CourseDayState {
  if (st.last < 0) return { ...st, last: today };
  if (today > st.last && st.progressed) return { day: Math.min(st.day + 1, AFTER_COURSE), last: today, progressed: false };
  if (today > st.last) return { ...st, last: today };
  return st;
}

// ---- 学習時間の設定 ----
export function profileFor(d: CompData, minutes: number): Profile {
  return [...d.profiles].sort((a, b) => Math.abs(a.minutes - minutes) - Math.abs(b.minutes - minutes))[0];
}

// ---- キュー ----
export type TaskType = 'learn' | 'question' | 'conversation';
export interface Task {
  /** セッションの中で一意（再挑戦は #r を付ける） */
  id: string;
  type: TaskType;
  stage: Stage;
  qid?: string;
  itemId?: string;
  scenarioId?: string;
  /** なぜ出すか（due: 期限の復習 / prev: 前日 / new: 新規 / carry: 繰り越し / practice / mixed / retry） */
  reason: 'due' | 'prev' | 'new' | 'carry' | 'practice' | 'mixed' | 'retry';
}

/** 問題ごとの記録（Progress.extra.qs）。n = 出題回数・c = 正解 */
export interface QRec {
  n: number;
  c: number;
  /** 最後に答えた学習日 */
  l: number;
  /** 最後の正誤（1 / 0） */
  ok: number;
}

export interface PlanInput {
  ix: CompIndex;
  minutes: number;
  day: number;
  today: number;
  rng: Rng;
  items: Record<string, ItemState>;
  ev: Record<string, Evidence>;
  qs: Record<string, QRec>;
  /** 会話を最後まで進めた場面 */
  convDone: Record<string, number>;
  /** 苦手な段階（診断・正答率から）。復習で先に出す */
  weak?: Set<Stage>;
  /** 今の状況（音声を使わない・文字を入力しない）。合わない問題は出さない（記録もしない） */
  situation?: Situation;
}

export interface Plan {
  tasks: Task[];
  /** 復習がたまっていて新規を減らした */
  backlog: boolean;
  dueTotal: number;
  /** 今日の日程の内容 */
  dayInfo: Day | null;
}

const PRI_ORDER: Record<Priority, number> = { core: 0, recommended: 1, extra: 2 };

/** 項目の復習に使う問題を選ぶ（前回と違う種類をなるべく選ぶ） */
function questionForKey(ix: CompIndex, key: string, qs: Record<string, QRec>, rng: Rng, sit?: Situation): string | null {
  if (ix.q.has(key)) return key;
  const list = ix.itemQs.get(key) ?? [];
  if (!list.length) return null;
  const sorted = shuffle(list, rng).sort((a, b) => (qs[a]?.l ?? -1) - (qs[b]?.l ?? -1));
  return (sit ? sorted.find((id) => allowedBy(ix.q.get(id)!, sit)) : sorted[0]) ?? sorted[0];
}

/** 段階を交互に（同じ種類が続かないように） */
function interleave<T>(list: T[], keyOf: (t: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const t of list) {
    const k = keyOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const out: T[] = [];
  const gs = [...groups.values()];
  for (let i = 0; out.length < list.length; i++) for (const g of gs) if (g[i] !== undefined) out.push(g[i]);
  return out;
}

/** 今日のキューを組み立てる（通常の学習） */
export function planSession(input: PlanInput): Plan {
  const { ix, today, rng, items, ev, qs } = input;
  const profile = profileFor(ix.d, input.minutes);
  const allowed = new Set<Priority>(['core', ...profile.optionalPriorities]);
  const day = Math.min(input.day, AFTER_COURSE);
  const dayInfo = ix.day.get(day) ?? null;
  const isReviewDay = !dayInfo || dayInfo.kind === 'review' || day >= AFTER_COURSE;
  const used = new Set<string>();
  const usedDup = new Set<string>();
  const tasks: Task[] = [];
  let seq = 0;
  const tid = (s: string) => `${s}~${seq++}`;
  /** 同じ問題・別名・同じ英語表記の項目を同じセッションで重ねない */
  const take = (qid: string) => {
    const q = ix.q.get(qid);
    if (!q || used.has(qid) || !allowedBy(q, input.situation)) return false;
    const dk = ix.dupKey.get(qid);
    if (dk && usedDup.has(dk)) return false;
    const se = q.itemIds.map((i) => ix.sameEn.get(i)).filter(Boolean) as string[];
    if (se.some((k) => usedDup.has('en:' + k))) return false;
    used.add(qid);
    if (dk) usedDup.add(dk);
    for (const k of se) usedDup.add('en:' + k);
    return true;
  };
  const addQ = (qid: string, stage: Stage, reason: Task['reason']) => take(qid) && tasks.push({ id: tid(qid), type: 'question', stage, qid, reason });

  // 1. 復習（期限の来た記録の単位）。前日 → まちがえた → 苦手な段階 → 期限を過ぎた割合
  const dueKeys = Object.entries(items).filter(([, st]) => isDue(st, today));
  const keyDay = (k: string) => ix.item.get(k)?.day ?? ix.q.get(k)?.day ?? 0;
  const jit = new Map(dueKeys.map(([k]) => [k, rng()]));
  const weak = input.weak ?? new Set<Stage>();
  const keyQ = new Map(dueKeys.map(([k]) => [k, questionForKey(ix, k, qs, rng, input.situation)]));
  const isWeakKey = (k: string) => {
    const q = ix.q.get(keyQ.get(k) ?? '');
    return q && weak.has(stageOf(ix, q)) ? 0 : 1;
  };
  dueKeys.sort(([a, sa], [b, sb]) => {
    const pa = keyDay(a) === day - 1 ? 0 : 1, pb = keyDay(b) === day - 1 ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (sa.lastOk !== sb.lastOk) return Number(sa.lastOk) - Number(sb.lastOk);
    const wa = isWeakKey(a), wb = isWeakKey(b);
    if (wa !== wb) return wa - wb;
    return sa.due - sb.due || jit.get(a)! - jit.get(b)!;
  });
  const reviewBudget = isReviewDay ? profile.budget.review + profile.budget.new + profile.budget.practice : profile.budget.review;
  const backlog = !isReviewDay && dueKeys.length > profile.budget.review;
  for (const [k] of dueKeys) {
    if (tasks.length >= reviewBudget) break;
    const qid = keyQ.get(k);
    if (qid) addQ(qid, 'review', keyDay(k) === day - 1 ? 'prev' : 'due');
  }

  if (isReviewDay) {
    // 総合復習の日: 新規なし。対象の日々から、答えたことのある問題を技能を混ぜて（足りなければ必須の問題も）
    const days = dayInfo?.reviewDays.length ? dayInfo.reviewDays : [...ix.day.keys()].filter((x) => x < day);
    const pool = days.flatMap((x) => ix.day.get(x)?.questionIds ?? []).filter((id) => !used.has(id));
    const seen = shuffle(pool.filter((id) => qs[id]), rng).sort((a, b) => (qs[a].ok - qs[b].ok));
    const fresh = shuffle(pool.filter((id) => !qs[id] && ix.q.get(id)!.priority === 'core'), rng);
    const mixed = interleave([...seen, ...fresh].map((id) => ix.q.get(id)!), (q) => stageOf(ix, q));
    for (const q of mixed) {
      if (tasks.length >= reviewBudget) break;
      addQ(q.id, 'mixed', 'mixed');
    }
    return { tasks: order(tasks), backlog: false, dueTotal: dueKeys.length, dayInfo };
  }

  // 2. 新しい項目（学習カード → 思い出す問題）。繰り越し（前の日の必須）→ 今日（優先度順）
  const learned = (id: string) => !!items[id] || !!ev[id]?.r;
  let newCap = Math.min(profile.newItemCap, profile.budget.new);
  if (backlog) newCap = Math.floor(newCap / 2);
  const carryItems: Item[] = [];
  for (let x = 1; x < day; x++) for (const id of ix.day.get(x)?.itemIds ?? []) {
    const it = ix.item.get(id)!;
    if (it.priority === 'core' && !learned(id)) carryItems.push(it);
  }
  const todayItems = (dayInfo?.itemIds ?? []).map((id) => ix.item.get(id)!).filter((it) => allowed.has(it.priority) && !learned(it.id));
  todayItems.sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
  const newItems = [...carryItems.map((it) => ({ it, reason: 'carry' as const })), ...todayItems.map((it) => ({ it, reason: 'new' as const }))];
  let nNew = 0;
  for (const { it, reason } of newItems) {
    if (nNew >= newCap) break;
    const se = ix.sameEn.get(it.id);
    if (se && usedDup.has('en:' + se)) continue;
    if (se) usedDup.add('en:' + se);
    nNew++;
    tasks.push({ id: tid('learn:' + it.id), type: 'learn', stage: it.kind, itemId: it.id, reason });
    // 思い出す問題（その項目の recall）をすぐあとに
    const rq = (ix.itemQs.get(it.id) ?? []).map((id) => ix.q.get(id)!).find((q) => q.kind === 'recall' && !qs[q.id]);
    if (rq) addQ(rq.id, it.kind, reason);
  }

  // 3. 演習（今日の問題・繰り越しの必須）。必須 → 任意（学習時間で決まる優先度）、技能を交互に
  const carryQs: CQuestion[] = [];
  for (let x = 1; x < day; x++)
    for (const id of ix.day.get(x)?.questionIds ?? []) {
      const q = ix.q.get(id)!;
      if (q.priority === 'core' && !qs[id] && q.itemIds.every((i) => learned(i))) carryQs.push(q);
    }
  const notReady = (q: CQuestion) => q.itemIds.some((i) => !learned(i) && !tasks.some((t) => t.itemId === i));
  const todayQs = (dayInfo?.questionIds ?? []).map((id) => ix.q.get(id)!).filter((q) => allowed.has(q.priority) && !qs[q.id] && !notReady(q));
  todayQs.sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
  const core = interleave([...carryQs, ...todayQs.filter((q) => q.priority === 'core')], (q) => stageOf(ix, q));
  const optional = interleave(todayQs.filter((q) => q.priority !== 'core'), (q) => stageOf(ix, q));
  let nPractice = 0;
  for (const q of [...core, ...optional]) {
    if (nPractice >= profile.budget.practice) break;
    const before = tasks.length;
    addQ(q.id, stageOf(ix, q), carryQs.includes(q) ? 'carry' : 'practice');
    if (tasks.length > before) nPractice++;
  }

  // 4. 会話（今日の問題に場面があれば、問題の前に通しで練習。記録はしない補助練習）
  const scenes = new Set(tasks.map((t) => (t.qid ? ix.q.get(t.qid)?.conversationId : undefined)).filter(Boolean) as string[]);
  for (const s of scenes) if (!input.convDone[s]) tasks.push({ id: tid('conv:' + s), type: 'conversation', stage: 'scenario', scenarioId: s, reason: 'practice' });

  // 5. 混合（前の日々の答えたことのある問題から。苦手な段階・まちがえたものを先に）
  const past = Object.keys(qs)
    .filter((id) => ix.q.has(id) && !used.has(id) && ix.q.get(id)!.day < day)
    .map((id) => ix.q.get(id)!);
  const pastSorted = shuffle(past, rng).sort((a, b) => qs[a.id].ok - qs[b.id].ok || (weak.has(stageOf(ix, a)) ? 0 : 1) - (weak.has(stageOf(ix, b)) ? 0 : 1));
  let nMix = 0;
  for (const q of pastSorted) {
    if (nMix >= profile.budget.finish) break;
    const before = tasks.length;
    addQ(q.id, 'mixed', 'mixed');
    if (tasks.length > before) nMix++;
  }
  return { tasks: order(tasks), backlog, dueTotal: dueKeys.length, dayInfo };
}

/** 段階の順に並べる（同じ段階の中は加えた順。学習カードはその項目の問題の前） */
function order(tasks: Task[]): Task[] {
  const rank = (t: Task) => STAGES.indexOf(t.stage) * 2 + (t.type === 'conversation' ? 0 : 1);
  return tasks.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map((x) => x.t);
}

/** 復習リストだけのキュー（ホームの「復習する」） */
export function planReview(ix: CompIndex, keys: string[], qs: Record<string, QRec>, rng: Rng, limit: number, sit?: Situation): Task[] {
  const out: Task[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (out.length >= limit) break;
    const qid = questionForKey(ix, k, qs, rng, sit);
    if (!qid || seen.has(qid) || !allowedBy(ix.q.get(qid)!, sit)) continue;
    seen.add(qid);
    out.push({ id: `${qid}~${out.length}`, type: 'question', stage: 'review', qid, reason: 'due' });
  }
  return out;
}

/** 目安の時間（秒）。自分の記録が十分あれば中央値、なければ目安 */
export const DEFAULT_SEC: Record<string, number> = { learn: 20, recall: 25, listening: 30, dictation: 45, translation: 60, paraphrase: 60, reading: 60, correction: 45, conversation: 120 };
export function estimateSec(ix: CompIndex, tasks: Task[], medians: Record<string, number> = {}): number {
  return tasks.reduce((n, t) => {
    const k = t.type === 'question' ? ix.q.get(t.qid!)!.kind : t.type;
    return n + (medians[k] ?? DEFAULT_SEC[k] ?? 40);
  }, 0);
}
