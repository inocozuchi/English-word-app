// 反射版の仕組み（UI に依存しない。時刻は引数で渡すので、実時間に依存せずにテストできる）
//   - タイマー: 問題ごとの制限時間・一時停止・時間切れ
//   - 1セッションの進行と再出題キュー: まちがえた問題は 3〜6 問後にもう一度。2回続けて正解したら終わり
//   - 判定: 「正解でも遅い」（制限時間の70%超）＝あやしい / 「反射できる」（直近3回すべて正解かつ50%以内）
//   - 出題方法ごとの選び方・4択の組み立て
import type { ItemState, Candidate } from '../../core/srs.ts';
import { selectItems, isDue } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import type { RQuestion, RCard, RType } from './types.ts';

export const MODE_ID = 'imagelink-reflex';

/** 正解でも制限時間のこの割合を超えたら「あやしい」 */
export const SLOW_RATIO = 0.7;
/** 直近3回すべてこの割合以内で正解なら「反射できる」 */
export const REFLEX_RATIO = 0.5;
export const REFLEX_STREAK = 3;
/** 次へ進むまで（ms） */
export const ADVANCE_OK_MS = 400;
export const ADVANCE_NG_MS = 1500;
export const ADVANCE_TIMEOUT_MS = 1000;
/** 再出題: 何問後に出すか・何回続けて正解で終わるか・1つの問題を出し直す上限 */
export const REQUEUE_GAP: readonly [number, number] = [3, 6];
export const REQUEUE_NEED = 2;
export const REQUEUE_MAX = 4;

// ---- タイマー ----
/** 1問のタイマー。now は ms（performance.now など）。一時停止した時間は数えない */
export class QuestionTimer {
  private start: number;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  constructor(
    readonly limitMs: number,
    now: number,
  ) {
    this.start = now;
  }
  elapsed(now: number): number {
    const end = this.pausedAt ?? now;
    return Math.max(0, end - this.start - this.pausedTotal);
  }
  remaining(now: number): number {
    return Math.max(0, this.limitMs - this.elapsed(now));
  }
  /** 残りの割合（1 → 0） */
  fraction(now: number): number {
    return this.limitMs ? this.remaining(now) / this.limitMs : 0;
  }
  expired(now: number): boolean {
    return this.elapsed(now) >= this.limitMs;
  }
  get paused() {
    return this.pausedAt !== null;
  }
  pause(now: number) {
    if (this.pausedAt === null) this.pausedAt = now;
  }
  resume(now: number) {
    if (this.pausedAt === null) return;
    this.pausedTotal += now - this.pausedAt;
    this.pausedAt = null;
  }
}

// ---- 判定 ----
export interface Grade {
  ok: boolean;
  timeout: boolean;
  /** 回答までの時間（時間切れは制限時間） */
  ms: number;
  /** 正解だが遅い（あやしい） */
  slow: boolean;
}

/** 回答を採点する。choice が null なら時間切れ */
export function grade(choice: number | null, answer: number, elapsedMs: number, limitMs: number): Grade {
  const timeout = choice === null || elapsedMs >= limitMs;
  const ok = !timeout && choice === answer;
  const ms = timeout ? limitMs : Math.round(elapsedMs);
  return { ok, timeout, ms, slow: ok && ms > limitMs * SLOW_RATIO };
}

/** 直近3回すべて正解かつ制限時間の50%以内なら「反射できる」 */
export function isReflexive(st: Pick<ItemState, 'recent'> | undefined, limitMs: number): boolean {
  const r = st?.recent;
  if (!r || r.length < REFLEX_STREAK) return false;
  return r.slice(-REFLEX_STREAK).every((x) => x.ok && x.ms <= limitMs * REFLEX_RATIO);
}

/** 弱点: まちがえた・時間切れ・あやしい（遅い正解・自己判定で「あやしい」） */
export const isWeak = (st: ItemState | undefined) => !!st && (!st.lastOk || st.conf === 'low');

// ---- 1セッションの進行（再出題キュー） ----
export interface RunItem {
  key: string;
  /** 再出題（同じセッションで2回目以降） */
  again: boolean;
}

export class ReflexRun {
  readonly items: RunItem[];
  index = 0;
  /** 再出題中の問題: あと何回続けて正解すれば終わるか */
  private need = new Map<string, number>();
  private requeued = new Map<string, number>();
  private answered = new Set<string>();

  constructor(
    keys: readonly string[],
    private rng: Rng,
    private opts: { requeue: boolean } = { requeue: true },
  ) {
    this.items = keys.map((key) => ({ key, again: false }));
  }

  get current(): RunItem | undefined {
    return this.items[this.index];
  }
  get done(): boolean {
    return this.index >= this.items.length;
  }
  /** 残りの問題数（再出題を含む） */
  get left(): number {
    return Math.max(0, this.items.length - this.index);
  }
  /** まだ終わっていない再出題の数 */
  get pending(): number {
    return this.need.size;
  }

  /**
   * 今の問題の結果を記録して次へ進む。初めての回答なら true（成績はこのときだけ記録する）。
   * まちがえたら 3〜6 問後に出し直し、2回続けて正解したら終わり。
   */
  settle(ok: boolean): boolean {
    const cur = this.current;
    if (!cur) return false;
    const first = !this.answered.has(cur.key);
    this.answered.add(cur.key);
    if (this.opts.requeue) {
      const need = this.need.get(cur.key);
      if (!ok) {
        this.need.set(cur.key, REQUEUE_NEED);
        this.reinsert(cur.key);
      } else if (need !== undefined) {
        if (need - 1 > 0) {
          this.need.set(cur.key, need - 1);
          this.reinsert(cur.key);
        } else this.need.delete(cur.key);
      }
    }
    this.index++;
    return first;
  }

  private reinsert(key: string) {
    const n = (this.requeued.get(key) ?? 0) + 1;
    if (n > REQUEUE_MAX) {
      this.need.delete(key);
      return;
    }
    this.requeued.set(key, n);
    const [lo, hi] = REQUEUE_GAP;
    const gap = lo + Math.floor(this.rng() * (hi - lo + 1));
    // 今の問題の gap 問後（間に gap-1 問はさむ）。足りなければ最後に
    const at = Math.min(this.index + gap, this.items.length);
    this.items.splice(at, 0, { key, again: true });
  }
}

// ---- 出題方法 ----
export type Method = 'warmup' | 'group' | 'fig' | 'word' | 'weak' | 'cards' | 'attack';
export const METHODS: { id: Method; label: string; desc: string; types?: RType[] }[] = [
  { id: 'warmup', label: 'ウォームアップ', desc: '全グループから10問（約30秒）' },
  { id: 'group', label: 'グループ集中', desc: '選んだグループから20問' },
  { id: 'fig', label: '図→語ラッシュ', desc: '図を見て語を選ぶ', types: ['r_fig2word', 'r_prep_icon'] },
  { id: 'word', label: '語→イメージラッシュ', desc: '語を見てイメージ・図を選ぶ', types: ['r_word2image', 'r_word2fig', 'r_prep_word2icon'] },
  { id: 'weak', label: '弱点', desc: 'まちがえた・時間切れ・あやしいだけ（新しい順に20問）' },
  { id: 'cards', label: '暗記カード', desc: '語 → コアイメージ。すぐ出た／あやしい／出ない' },
  { id: 'attack', label: 'タイムアタック', desc: '全問を通しで。正答率と平均反応時間のベスト記録' },
];
export const GROUPS = ['基本動詞', '副詞・接続', '時制・準動詞', '助動詞', '前置詞', '文法', '使役'];
export const WARMUP_COUNT = 10;
export const RUSH_COUNT = 20;
export const WEAK_COUNT = 20;

export interface ReflexSettings {
  method: Method;
  group: string;
}
export function normalizeReflexSettings(raw: unknown): ReflexSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    method: METHODS.some((m) => m.id === r.method) ? r.method : 'warmup',
    group: GROUPS.includes(r.group) ? r.group : GROUPS[0],
  };
}

/** カードのキーはカードの id（r_…。問題の id とは重ならない） */
export const isCard = (key: string, cards: ReadonlyMap<string, RCard>) => cards.has(key);

export interface Pool {
  questions: readonly RQuestion[];
  cards: readonly RCard[];
}

/** 出題方法の範囲の候補（cards はカードの id、それ以外は問題の id） */
export function reflexCandidates(pool: Pool, s: ReflexSettings): Candidate[] {
  if (s.method === 'cards') return pool.cards.map((c, n) => ({ key: c.id, base: c.id, group: c.group, newOrder: n }));
  const m = METHODS.find((x) => x.id === s.method)!;
  const types = m.types ? new Set<string>(m.types) : null;
  return pool.questions
    .filter((q) => (!types || types.has(q.type)) && (s.method !== 'group' || q.group === s.group))
    .map((q, n) => ({ key: q.id, base: q.id, group: q.group, newOrder: n }));
}

/** 出題する順に key を選ぶ */
export function reflexPick(cands: readonly Candidate[], items: Record<string, ItemState>, s: ReflexSettings, today: number, rng: Rng): string[] {
  switch (s.method) {
    case 'attack':
      return shuffle(cands, rng).map((c) => c.key);
    case 'warmup': {
      // 全グループから順番に（各グループの中は 期限切れ → 未習 → ランダム）
      const by = new Map<string, Candidate[]>();
      for (const c of cands) by.set(c.group, [...(by.get(c.group) ?? []), c]);
      const lists = shuffle([...by.values()], rng).map((l) => prioritize(l, items, today, rng));
      const out: string[] = [];
      for (let k = 0; out.length < WARMUP_COUNT && lists.some((l) => l.length > k); k++)
        for (const l of lists) if (l[k] && out.length < WARMUP_COUNT) out.push(l[k].key);
      return shuffle(out, rng);
    }
    case 'weak': {
      const w = cands.filter((c) => isWeak(items[c.key]));
      w.sort((a, b) => items[b.key].last - items[a.key].last);
      return shuffle(w.slice(0, WEAK_COUNT), rng).map((c) => c.key);
    }
    default:
      return selectItems(cands, items, { count: RUSH_COUNT, today, rng }).map((c) => c.key);
  }
}

/** 期限切れ・まちがえた → 未習 → そのほか（それぞれランダム） */
function prioritize(list: Candidate[], items: Record<string, ItemState>, today: number, rng: Rng): Candidate[] {
  const rank = (c: Candidate) => {
    const st = items[c.key];
    if (!st) return 1;
    if (isDue(st, today) || !st.lastOk) return 0;
    return 2;
  };
  return shuffle(list, rng).sort((a, b) => rank(a) - rank(b));
}

// ---- 4択 ----
export interface RChoice {
  text: string;
  image?: string;
  latin?: boolean;
}
export interface Built {
  q: RQuestion;
  choices: RChoice[];
  answer: number;
  limitMs: number;
}

export const figureUrl = (path: string) => `./data/imagelink-reflex/${path}`;
const LATIN = new Set<RType>(['r_image2word', 'r_prep_icon']);

/** 4択を組み立てる（正解＋誤答の候補から重複なく3つ。図なら正解の図＋3枚）。毎回シャッフル */
export function buildChoices(q: RQuestion, rng: Rng): Built | null {
  const limitMs = (q.time_limit_sec || 4) * 1000;
  if (q.answer_figure) {
    const ds = [...new Set(q.distractor_figures ?? [])].filter((f) => f !== q.answer_figure);
    if (ds.length < 3) return null;
    const figs = shuffle([q.answer_figure, ...shuffle(ds, rng).slice(0, 3)], rng);
    return { q, choices: figs.map((f, k) => ({ text: `図${k + 1}`, image: figureUrl(f) })), answer: figs.indexOf(q.answer_figure), limitMs };
  }
  if (!q.answer) return null;
  const ds = [...new Set((q.distractors ?? []).map((d) => d.trim()))].filter((d) => d && d !== q.answer!.trim());
  if (ds.length < 3) return null;
  const texts = shuffle([q.answer, ...shuffle(ds, rng).slice(0, 3)], rng);
  const latin = LATIN.has(q.type);
  return { q, choices: texts.map((text) => ({ text, latin })), answer: texts.indexOf(q.answer), limitMs };
}

// ---- 記録 ----
export interface AttackRecord {
  correct: number;
  total: number;
  /** 正解した問題の平均反応時間（ms） */
  avgMs: number;
  at: number;
}
/** a が b よりよい記録か（正答率が高い → 同じなら平均反応時間が短い） */
export function better(a: AttackRecord, b: AttackRecord | undefined | null): boolean {
  if (!b) return true;
  const ra = a.total ? a.correct / a.total : 0, rb = b.total ? b.correct / b.total : 0;
  if (ra !== rb) return ra > rb;
  return a.avgMs < b.avgMs;
}

/** グループごとの反射率（反射できる問題 / 問題数） */
export function reflexRates(questions: readonly RQuestion[], items: Record<string, ItemState>) {
  const m = new Map<string, { total: number; reflex: number; tried: number }>();
  for (const q of questions) {
    const x = m.get(q.group) ?? { total: 0, reflex: 0, tried: 0 };
    x.total++;
    const st = items[q.id];
    if (st) x.tried++;
    if (isReflexive(st, q.time_limit_sec * 1000)) x.reflex++;
    m.set(q.group, x);
  }
  return m;
}

/** 章ごとの反射版の状況（完全版の章一覧に出す） */
export function chapterReflex(questions: readonly RQuestion[], items: Record<string, ItemState>) {
  const m = new Map<number, { total: number; reflex: number }>();
  for (const q of questions) {
    const x = m.get(q.chapter) ?? { total: 0, reflex: 0 };
    x.total++;
    if (isReflexive(items[q.id], q.time_limit_sec * 1000)) x.reflex++;
    m.set(q.chapter, x);
  }
  return m;
}
