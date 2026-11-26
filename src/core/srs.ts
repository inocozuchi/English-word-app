// 簡易的な間隔反復（Leitner 方式）。
// 箱 0〜5。正解で1つ上の箱、まちがい・未回答で箱0に戻る。
// 期限は「学習日」（day.ts）単位で持つ。
import type { Rng } from './rng.ts';
import { shuffle } from './rng.ts';

/** 箱ごとの復習間隔（日）。箱0 = その日のうちにもう一度 */
export const INTERVALS = [0, 1, 3, 7, 16, 35] as const;
export const MAX_BOX = INTERVALS.length - 1;
/** この箱以上を「覚えた」とみなす */
export const LEARNED_BOX = 3;

export interface ItemState {
  box: number;
  /** 次に出す学習日（dayNumber） */
  due: number;
  seen: number;
  correct: number;
  wrong: number;
  /** 最後に答えた時刻(ms) */
  last: number;
  lastOk: boolean;
  /** 自己申告の自信（自己採点の問題だけ。low = 自信なし） */
  conf?: 'low' | 'high';
  /** 直近の回答（反応時間 ms と正誤。新しいものが最後、最大5件。反射版だけが使う） */
  recent?: { ms: number; ok: boolean }[];
}

/** モードごとの箱の決まり。intervals[箱] = 次に出すまでの日数 */
export interface SrsConfig {
  intervals: readonly number[];
  /** 初めての問題が入っている箱（正解で +1） */
  startBox: number;
  /** まちがえたときに戻る箱 */
  resetBox: number;
}
export const DEFAULT_SRS: SrsConfig = { intervals: INTERVALS, startBox: 0, resetBox: 0 };

export function review(
  prev: ItemState | undefined,
  ok: boolean,
  now: number,
  today: number,
  cfg: SrsConfig = DEFAULT_SRS,
  conf?: 'low' | 'high',
): ItemState {
  const s: ItemState = prev
    ? { ...prev }
    : { box: cfg.startBox, due: today, seen: 0, correct: 0, wrong: 0, last: 0, lastOk: false };
  const max = cfg.intervals.length - 1;
  s.seen++;
  s.last = now;
  s.lastOk = ok;
  if (ok) {
    s.correct++;
    // 初見で正解した語は箱1から（翌日に確認）
    s.box = Math.min(s.box + 1, max);
  } else {
    s.wrong++;
    s.box = cfg.resetBox;
  }
  if (conf) s.conf = conf;
  else delete s.conf;
  s.due = today + cfg.intervals[s.box];
  return s;
}

export function isDue(s: ItemState, today: number): boolean {
  return s.due <= today;
}

export interface Candidate {
  /** 進捗の保存キー（例: "ej:involve"） */
  key: string;
  /** 同じ対象を1セッションで2回出さないためのキー（例: "w:involve"） */
  base: string;
  /** 近い位置に並ばないようにするまとまり（語源ID） */
  group: string;
  /** 未習のときの出題順（小さいほど先） */
  newOrder: number;
  /** これを先に学んでいないと未習として出さない（例: 日→英 は 英→日 の後） */
  requires?: string;
}

export interface SelectOptions {
  count: number;
  today: number;
  rng: Rng;
  /** 前回セッションの最後の問題の base。最初の問題にしない */
  avoidFirst?: string | null;
}

/**
 * 出題する候補を選ぶ。優先度:
 *  1. 期限切れ かつ 前回まちがえた
 *  2. 期限切れ（期限を過ぎた割合が大きい順）
 *  3. 未習（学習順）
 *  4. 期限前（期限が近い順）
 *  5. 前提を満たしていない未習（候補が足りないときだけ）
 */
export function selectItems(
  cands: readonly Candidate[],
  items: Record<string, ItemState>,
  opts: SelectOptions,
): Candidate[] {
  const { today, rng, count } = opts;
  const t1: Candidate[] = [], t2: Candidate[] = [], t3: Candidate[] = [], t4: Candidate[] = [], t5: Candidate[] = [];
  for (const c of cands) {
    const s = items[c.key];
    if (!s) (c.requires && !items[c.requires] ? t5 : t3).push(c);
    else if (!isDue(s, today)) t4.push(c);
    else if (!s.lastOk) t1.push(c);
    else t2.push(c);
  }
  // 同順位はランダムに崩す（毎回同じ並びにならないように）
  const jitter = new Map(cands.map((c) => [c.key, rng()]));
  const j = (c: Candidate) => jitter.get(c.key)!;
  const st = (c: Candidate) => items[c.key];
  t1.sort((a, b) => st(a).due - st(b).due || st(a).last - st(b).last || j(a) - j(b));
  const overdue = (c: Candidate) => (today - st(c).due + 1) / (INTERVALS[st(c).box] || 1);
  t2.sort((a, b) => overdue(b) - overdue(a) || j(a) - j(b));
  t3.sort((a, b) => a.newOrder - b.newOrder);
  t4.sort((a, b) => st(a).due - st(b).due || st(a).last - st(b).last || j(a) - j(b));
  t5.sort((a, b) => a.newOrder - b.newOrder);

  const picked: Candidate[] = [];
  const bases = new Set<string>();
  for (const tier of [t1, t2, t3, t4, t5]) {
    for (const c of tier) {
      if (picked.length >= count) break;
      if (bases.has(c.base)) continue;
      bases.add(c.base);
      picked.push(c);
    }
  }
  return arrange(picked, rng, opts.avoidFirst ?? null);
}

/** 並び替え: シャッフルし、同じ語源が隣り合わないようにし、前回の最後を先頭にしない */
export function arrange(list: Candidate[], rng: Rng, avoidFirst: string | null): Candidate[] {
  const rest = shuffle(list, rng);
  const out: Candidate[] = [];
  while (rest.length) {
    const prev = out[out.length - 1];
    let i = rest.findIndex((c) =>
      out.length === 0 ? c.base !== avoidFirst : c.group !== prev.group,
    );
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
