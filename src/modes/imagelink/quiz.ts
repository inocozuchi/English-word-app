// イメージリンクモードの出題・採点（UI に依存しない。tests/imagelink.test.ts）
//
// 保存キー: `c<章>:<問題ID>`（例: c27:q_86177bfe3c）。章が入っているので、部の JSON を読まなくても
// 章ごとの達成度を記録だけから数えられる。
// 出題方法（method）7種と絞り込み（部・章・type・難易度・タグ）を組み合わせて候補を作り、pick で選ぶ。
import type { Question, Choice, PickInput } from '../../core/mode.ts';
import type { Candidate, ItemState, SrsConfig } from '../../core/srs.ts';
import { selectItems, arrange, isDue } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import type { IlRaw, QType, Difficulty, IlChapter } from './types.ts';

export const MODE_ID = 'imagelink';

/** Leitner 5箱。箱1〜5、正解で次の箱、まちがいで箱1。間隔は 1/3/7/14/30 日（intervals[0] は使わない） */
export const IL_SRS: SrsConfig = { intervals: [1, 1, 3, 7, 14, 30], startBox: 1, resetBox: 1 };
/** この箱以上を「習得」とみなす（3回続けて正解 = 次は14日後） */
export const IL_LEARNED_BOX = 4;

export const PART_COLORS: Record<number, string> = { 1: '#2B5BA8', 2: '#23866B', 3: '#C9731E', 4: '#7A4FA0' };
export const PARTS = [1, 2, 3, 4] as const;

export const TYPE_LABELS: Record<QType, string> = {
  en2ja: '英→意味',
  ja2en: '日→英',
  translate: '英作文',
  order: '並べ替え',
  en2point: 'ポイント',
  table: '整理表',
  flashcard: 'カード',
  exercise: '練習問題',
  cloze: '穴埋め',
  fig_caption: '図→意味',
  fig_choose: '図を選ぶ',
  prep_icon: '前置詞の図',
  core_image: 'コアイメージ',
};
export const ALL_TYPES = Object.keys(TYPE_LABELS) as QType[];
export const DIFFS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'やさしい' },
  { id: 'normal', label: 'ふつう' },
  { id: 'hard', label: 'むずかしい' },
];
/** 絞り込みに出すタグ（データにあるもの。多い順） */
export const TAGS = ['例文', '英作', '読解', '記述', '語順', 'イメージ', '整理表', '比較', '練習問題', '要点', 'イメージ図', '章まとめ', '学習目標', 'コアイメージ', '穴埋め', '前置詞', '対談'];

/** 4択（distractors から3つ） */
const CHOICE_TYPES = new Set<QType>(['en2ja', 'ja2en', 'en2point', 'table', 'cloze', 'fig_caption', 'core_image', 'prep_icon']);
/** 選択肢が英語のもの */
const LATIN_ANSWER = new Set<QType>(['ja2en', 'cloze', 'prep_icon']);

export type Method = 'chapter' | 'total' | 'weak' | 'srs' | 'figure' | 'flash' | 'compose';
export const METHODS: { id: Method; label: string; desc: string; types?: QType[] }[] = [
  { id: 'srs', label: '復習（間隔反復）', desc: '今日が期限の問題から。足りなければ新しい問題' },
  { id: 'chapter', label: '章別ミニテスト', desc: '選んだ章から10問' },
  { id: 'total', label: '部別・総合テスト', desc: '絞り込んだ範囲からランダムに' },
  { id: 'weak', label: '苦手克服', desc: 'まちがえた問題・自信のない問題だけ' },
  { id: 'figure', label: 'イメージ図トレーニング', desc: '図の意味・図を選ぶ・前置詞・コアイメージ', types: ['fig_caption', 'fig_choose', 'prep_icon', 'core_image'] },
  { id: 'flash', label: 'フラッシュカード', desc: '要点・まとめのカード。覚えた／もう一度', types: ['flashcard'] },
  { id: 'compose', label: '英作・語順トレーニング', desc: '並べ替え・英作文・日→英', types: ['order', 'translate', 'ja2en'] },
];
/** type を絞り込んでいないとき、カード（flashcard）はフラッシュカードでだけ出す */
const DEFAULT_TYPES = ALL_TYPES.filter((t) => t !== 'flashcard');

export const TOTAL_COUNTS = [10, 20, 50] as const;
export const CHAPTER_TEST_COUNT = 10;

export interface IlSettings {
  method: Method;
  /** 章別ミニテストの章 */
  chapter: number;
  /** 部別・総合テストの問題数 */
  totalCount: number;
  /** 絞り込み（空 = すべて） */
  parts: number[];
  chapters: number[];
  types: QType[];
  diffs: Difficulty[];
  tags: string[];
  /** 答え合わせのあとに英文を読み上げる */
  autoSpeak: boolean;
}

const arr = <T>(v: unknown, ok: (x: any) => boolean): T[] => (Array.isArray(v) ? [...new Set(v.filter(ok))] : []);

export function normalizeIlSettings(raw: unknown): IlSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    method: METHODS.some((m) => m.id === r.method) ? r.method : 'srs',
    chapter: Number.isInteger(r.chapter) && r.chapter >= 1 && r.chapter <= 187 ? r.chapter : 1,
    totalCount: (TOTAL_COUNTS as readonly number[]).includes(r.totalCount) ? r.totalCount : 10,
    parts: arr<number>(r.parts, (x) => (PARTS as readonly number[]).includes(x)).sort(),
    chapters: arr<number>(r.chapters, (x) => Number.isInteger(x) && x >= 1 && x <= 187).sort((a, b) => a - b),
    types: arr<QType>(r.types, (x) => ALL_TYPES.includes(x)),
    diffs: arr<Difficulty>(r.diffs, (x) => DIFFS.some((d) => d.id === x)),
    tags: arr<string>(r.tags, (x) => typeof x === 'string'),
    autoSpeak: typeof r.autoSpeak === 'boolean' ? r.autoSpeak : false,
  };
}

// ---- キー ----
export const keyOf = (q: Pick<IlRaw, 'chapter' | 'id'>) => `c${q.chapter}:${q.id}`;
export function parseKey(key: string): { chapter: number; id: string } | null {
  const m = /^c(\d+):(.+)$/.exec(key);
  return m ? { chapter: +m[1], id: m[2] } : null;
}

// ---- 範囲 ----
/** 出題方法と絞り込みから、出してよい type */
export function allowedTypes(s: IlSettings): Set<QType> {
  const m = METHODS.find((x) => x.id === s.method)!;
  const base = s.types.length ? s.types : m.types ?? DEFAULT_TYPES;
  return new Set(m.types ? base.filter((t) => m.types!.includes(t)) : base);
}

/** 章の範囲（null = すべて） */
export function chapterScope(s: IlSettings): Set<number> | null {
  if (s.method === 'chapter') return new Set([s.chapter]);
  return s.chapters.length ? new Set(s.chapters) : null;
}

/** 読み込みが要る部 */
export function neededParts(s: IlSettings, chapters: readonly IlChapter[]): number[] {
  const scope = chapterScope(s);
  let parts: number[] = s.parts.length && s.method !== 'chapter' ? [...s.parts] : [...PARTS];
  if (scope) {
    const fromCh = new Set(chapters.filter((c) => scope.has(c.no)).map((c) => c.part));
    parts = parts.filter((p) => fromCh.has(p));
  }
  return parts;
}

/** 絞り込みに合うか（出題方法の type 制限も含む） */
export function matcher(s: IlSettings): (q: IlRaw) => boolean {
  const types = allowedTypes(s);
  const scope = chapterScope(s);
  const parts = s.parts.length && s.method !== 'chapter' ? new Set(s.parts) : null;
  const diffs = s.diffs.length ? new Set(s.diffs) : null;
  const tags = s.tags.length ? new Set(s.tags) : null;
  return (q) =>
    types.has(q.type) &&
    (!scope || scope.has(q.chapter)) &&
    (!parts || parts.has(q.part)) &&
    (!diffs || diffs.has(q.difficulty)) &&
    (!tags || q.tags.some((t) => tags.has(t)));
}

/** 候補。newOrder は教科書の順（章 → データの並び） */
export function ilCandidates(qs: readonly IlRaw[], s: IlSettings): Candidate[] {
  const ok = matcher(s);
  const out: Candidate[] = [];
  for (let n = 0; n < qs.length; n++) {
    const q = qs[n];
    if (ok(q)) out.push({ key: keyOf(q), base: q.id, group: `ch${q.chapter}`, newOrder: q.chapter * 100000 + n });
  }
  return out;
}

/** 苦手: 前回まちがえた、または自信なしと答えた */
export const isWeak = (st: ItemState | undefined) => !!st && (!st.lastOk || st.conf === 'low');

export function sessionCount(s: IlSettings): number | null {
  if (s.method === 'chapter') return CHAPTER_TEST_COUNT;
  if (s.method === 'total') return s.totalCount;
  return null;
}

/** 出題の選び方（出題方法ごと） */
export function ilPick(input: Pick<PickInput, 'cands' | 'items' | 'count' | 'today' | 'rng' | 'avoidFirst'>, s: IlSettings): Candidate[] {
  const { cands, items, count, today, rng } = input;
  const avoid = input.avoidFirst ?? null;
  const take = (list: Candidate[]) => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const c of list) {
      if (out.length >= count) break;
      if (seen.has(c.base)) continue;
      seen.add(c.base);
      out.push(c);
    }
    return arrange(out, rng, avoid);
  };
  const jit = new Map(cands.map((c) => [c.key, rng()]));
  const j = (c: Candidate) => jit.get(c.key)!;
  switch (s.method) {
    case 'total':
      return take(shuffle(cands, rng));
    case 'weak': {
      const w = cands.filter((c) => isWeak(items[c.key]));
      // まちがえたもの → 自信なし の順。それぞれ前に答えたのが古いものから（同じなら乱数）
      w.sort((a, b) => Number(items[a.key].lastOk) - Number(items[b.key].lastOk) || items[a.key].last - items[b.key].last || j(a) - j(b));
      return take(w);
    }
    case 'srs': {
      // 今日が期限の問題を優先（まちがえた → 期限の古い順）。足りなければ新しい問題を教科書の順に
      const due: Candidate[] = [], fresh: Candidate[] = [];
      for (const c of cands) {
        const st = items[c.key];
        if (!st) fresh.push(c);
        else if (isDue(st, today)) due.push(c);
      }
      due.sort((a, b) => Number(items[a.key].lastOk) - Number(items[b.key].lastOk) || items[a.key].due - items[b.key].due || j(a) - j(b));
      fresh.sort((a, b) => a.newOrder - b.newOrder);
      return take([...due, ...fresh]);
    }
    default:
      // 章別・図・カード・英作: 期限切れ → 未習（教科書の順）→ 期限前（core の優先順）
      return selectItems(cands, items, { count, today, rng, avoidFirst: avoid });
  }
}

// ---- 問題 ----
export type IlKind = 'choice' | 'figchoice' | 'order' | 'translate' | 'exercise' | 'flashcard';

export interface IlData {
  raw: IlRaw;
  kind: IlKind;
  /** 並べ替えの語句（毎回シャッフル） */
  tokens?: string[];
  /** 図の URL（data/imagelink/ からの相対） */
  figure?: string;
}

export type IlQuestion = Question<IlData>;

/** 図のパスを URL に（index.html からの相対） */
export const figureUrl = (path: string) => `./data/imagelink/${path}`;

/** 誤答の候補から重複なく n 個（正解と同じ文字列・空文字は除く） */
export function pickDistractors(answer: string, distractors: readonly string[], rng: Rng, n = 3): string[] {
  const pool = [...new Set(distractors.map((d) => d.trim()))].filter((d) => d && d !== answer.trim());
  return shuffle(pool, rng).slice(0, n);
}

export function kindOf(q: IlRaw): IlKind {
  if (q.type === 'fig_choose' || (q.type === 'prep_icon' && q.answer_figure)) return 'figchoice';
  if (q.type === 'order' || q.type === 'translate' || q.type === 'exercise' || q.type === 'flashcard') return q.type;
  return 'choice';
}

/** 自己採点のあと次へ進むまで（答えはもう読んでいるので短く） */
const SELF_ADVANCE_SEC = 1.6;

export function buildQuestion(q: IlRaw, rng: Rng): IlQuestion | null {
  const kind = kindOf(q);
  const base = {
    modeId: MODE_ID,
    key: keyOf(q),
    base: q.id,
    group: `ch${q.chapter}`,
    pattern: q.type,
    patternLabel: TYPE_LABELS[q.type] ?? q.type,
    tags: [`type:${q.type}`, `part:${q.part}`],
  };
  if (kind === 'choice') {
    if (!q.answer || !CHOICE_TYPES.has(q.type)) return null;
    const ds = pickDistractors(q.answer, q.distractors ?? [], rng);
    if (ds.length < 3) return null;
    const latin = LATIN_ANSWER.has(q.type);
    const texts = shuffle([q.answer, ...ds], rng);
    const choices: Choice[] = texts.map((text) => ({ text, latin }));
    return { ...base, choices, answer: texts.indexOf(q.answer), data: { raw: q, kind, figure: q.figure ? figureUrl(q.figure) : undefined } };
  }
  if (kind === 'figchoice') {
    if (!q.answer_figure) return null;
    const figs = shuffle([q.answer_figure, ...[...new Set(q.distractor_figures ?? [])].filter((f) => f !== q.answer_figure).slice(0, 3)], rng);
    if (figs.length < 2) return null;
    const choices: Choice[] = figs.map((f, k) => ({ text: `図${k + 1}`, image: figureUrl(f) }));
    return { ...base, choices, answer: figs.indexOf(q.answer_figure), data: { raw: q, kind } };
  }
  if (kind === 'order') {
    if (!q.tokens?.length || !q.answer) return null;
    // データの tokens はシャッフル済みだが、毎回並びを変える（正解の並びになったら崩す）
    let tokens = shuffle(q.tokens, rng);
    for (let t = 0; t < 5 && tokens.length > 1 && checkOrder(tokens, q.answer); t++) tokens = shuffle(q.tokens, rng);
    return { ...base, choices: [], answer: 0, interactive: true, untimed: true, data: { raw: q, kind, tokens } };
  }
  if (!q.answer) return null;
  const self = kind === 'translate' || kind === 'flashcard' || (kind === 'exercise' && q.answer_mode !== 'short');
  return { ...base, choices: [], answer: 0, interactive: true, untimed: true, advanceSec: self ? SELF_ADVANCE_SEC : undefined, data: { raw: q, kind } };
}

// ---- 採点 ----
/** 並べ替えの照合用: 大文字小文字と文末の .?! を無視、空白はまとめる */
export function normOrder(s: string): string {
  return s.trim().replace(/[.?!]+$/, '').trim().toLowerCase().split(/\s+/).join(' ');
}
export function checkOrder(tokens: readonly string[], answer: string): boolean {
  return normOrder(tokens.join(' ')) === normOrder(answer);
}

/** 短い答えの照合用: （ ）の補足を除き、空白・大文字小文字・句読点・記号を無視 */
export function normShort(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}
export function checkShort(input: string, answer: string): boolean {
  const a = normShort(answer);
  return !!a && normShort(input) === a;
}

/** 英文の読み上げに使う文（speak → prompt_en） */
export const speakText = (q: IlRaw) => q.speak ?? q.prompt_en ?? (q.type === 'ja2en' || q.type === 'order' || q.type === 'translate' ? q.answer : undefined);

// ---- 達成度 ----
export interface ChapterStat {
  seen: number;
  correct: number;
  /** 一度でも答えた問題 */
  tried: number;
  /** 習得（箱4以上） */
  learned: number;
}

/** 記録から章ごとの達成度を数える（部の JSON は要らない） */
export function chapterStats(items: Record<string, ItemState>): Map<number, ChapterStat> {
  const m = new Map<number, ChapterStat>();
  for (const [key, st] of Object.entries(items)) {
    const k = parseKey(key);
    if (!k) continue;
    const c = m.get(k.chapter) ?? { seen: 0, correct: 0, tried: 0, learned: 0 };
    c.seen += st.seen;
    c.correct += st.correct;
    c.tried++;
    if (st.box >= IL_LEARNED_BOX) c.learned++;
    m.set(k.chapter, c);
  }
  return m;
}
