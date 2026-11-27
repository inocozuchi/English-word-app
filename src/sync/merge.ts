// 同期: 2つの端末の記録をまとめる（UI に依存しない。tests/sync.test.ts）。
// 同じことを何度してもよい（冪等）ように、どちらにも同じ結果を返す規則だけを使う。
//   学習記録: 問題ごとに最後に答えた方（last）。日ごとの回答数は多い方。復習リストはまとめて、片方でその後に答えて外れたものは外す。
//   設定: 新しい方。ただし音声・文字入力・自己採点・テーマ・触覚はこの端末のまま（端末ごとの状況）。
//          モードごとの設定は新しい方、自由英単語の単語は両方を合わせる（消した単語は gone で消したまま）。
//   報告: 両方を合わせる。総合英語のセッション: 新しい方。
import type { Progress } from '../core/storage.ts';
import type { ItemState } from '../core/srs.ts';

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** この端末だけの設定（同期しない） */
export const LOCAL_SETTINGS = ['audio', 'typing', 'selfGrade', 'theme', 'haptics'] as const;

function newerItem(a: ItemState | undefined, b: ItemState | undefined): ItemState | undefined {
  if (!a) return b;
  if (!b) return a;
  if ((a.last ?? 0) !== (b.last ?? 0)) return (a.last ?? 0) > (b.last ?? 0) ? a : b;
  return (a.seen ?? 0) >= (b.seen ?? 0) ? a : b;
}

/** 値どうしを深くまとめる（オブジェクトは中まで、それ以外は新しい方） */
export function deepMerge(a: unknown, b: unknown, aNewer: boolean): unknown {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (isObj(a) && isObj(b)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = deepMerge(a[k], b[k], aNewer);
    return out;
  }
  return aNewer ? a : b;
}

export function mergeProgress(a: Progress, b: Progress, aNewer: boolean): Progress {
  const items: Record<string, ItemState> = {};
  for (const k of new Set([...Object.keys(a.items ?? {}), ...Object.keys(b.items ?? {})])) items[k] = newerItem(a.items?.[k], b.items?.[k])!;
  const days: Progress['days'] = {};
  for (const k of new Set([...Object.keys(a.days ?? {}), ...Object.keys(b.days ?? {})])) {
    const x = a.days?.[k], y = b.days?.[k];
    days[k] = !x ? y! : !y ? x : x.a >= y.a ? x : y;
  }
  const review: Progress['review'] = {};
  for (const k of new Set([...Object.keys(a.review ?? {}), ...Object.keys(b.review ?? {})])) {
    const x = a.review?.[k], y = b.review?.[k];
    const e = !x ? y! : !y ? x : x.last >= y.last ? x : y;
    // 片方の端末でその後に答えて外れた（記録の方が新しい）ものは戻さない
    const st = items[k];
    if (st && e.last < st.last && !(x && y)) continue;
    review[k] = e;
  }
  const tags: Progress['tags'] = {};
  for (const k of new Set([...Object.keys(a.tags ?? {}), ...Object.keys(b.tags ?? {})])) {
    const x = a.tags?.[k], y = b.tags?.[k];
    tags[k] = !x ? y! : !y ? x : x.seen >= y.seen ? x : y;
  }
  const out: Progress = { items, days, lastBase: (aNewer ? a.lastBase : b.lastBase) ?? a.lastBase ?? b.lastBase ?? null, review, tags };
  const extra = deepMerge(a.extra, b.extra, aNewer);
  if (extra !== undefined) out.extra = extra as Record<string, unknown>;
  return out;
}

/** 自由英単語の単語: 両方を合わせ、同じ id は新しい設定の方。消した単語（gone）は消したまま */
function mergeCustom(a: any, b: any, aNewer: boolean) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const newer = aNewer ? a : b, older = aNewer ? b : a;
  const gone: Record<string, number> = { ...(older.gone ?? {}), ...(newer.gone ?? {}) };
  const byId = new Map<string, any>();
  for (const w of [...(older.words ?? []), ...(newer.words ?? [])]) if (w?.id && !gone[w.id]) byId.set(w.id, w);
  return { ...older, ...newer, words: [...byId.values()], gone };
}

export function mergeSettings(local: any, remote: any, localNewer: boolean): any {
  if (!isObj(local)) return remote;
  if (!isObj(remote)) return local;
  const newer = localNewer ? local : remote, older = localNewer ? remote : local;
  const modes: Record<string, unknown> = { ...(older.modes ?? {}), ...(newer.modes ?? {}) };
  if (older.modes?.custom || newer.modes?.custom) modes.custom = mergeCustom(local.modes?.custom, remote.modes?.custom, localNewer);
  const out: Record<string, any> = { ...older, ...newer, modes };
  for (const k of LOCAL_SETTINGS) if (k in local) out[k] = local[k];
  return out;
}

function mergeReports(a: unknown, b: unknown): unknown[] {
  const list = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const seen = new Map<string, unknown>();
  for (const r of list) seen.set(JSON.stringify(r), r);
  return [...seen.values()];
}

/** 保存キーごとにまとめる。null は「消した」（新しい方が null なら null） */
export function mergeKey(key: string, local: unknown, remote: unknown, localNewer: boolean): unknown {
  if (local === null || remote === null || local === undefined || remote === undefined) {
    if (local == null && remote == null) return null;
    if (key.startsWith('eq.reports.') || key.startsWith('eq.progress.') || key === 'eq.settings.v2') return local ?? remote; // 消すことはない
    return localNewer ? local ?? null : remote ?? null;
  }
  if (key === 'eq.settings.v2') return mergeSettings(local, remote, localNewer);
  if (key.startsWith('eq.progress.')) return mergeProgress(local as Progress, remote as Progress, localNewer);
  if (key.startsWith('eq.reports.')) return mergeReports(local, remote);
  return localNewer ? local : remote;
}
