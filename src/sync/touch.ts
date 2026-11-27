// 同期のための「この端末でいつ書き換えたか」の記録（依存なし。storage.ts などの保存のたびに呼ぶ）
const K = 'eq.sync.at.v1';
let at: Record<string, number> = {};
try {
  at = JSON.parse(localStorage.getItem(K) ?? '{}') ?? {};
} catch {
  at = {};
}
const listeners = new Set<(key: string) => void>();

/** 同期の対象になる保存キー（中断したクイズ・この端末だけの設定は対象外） */
export const isSyncKey = (key: string) => /^eq\.(settings\.v2|progress\.[\w-]+\.v1|reports\.[\w-]+\.v1|comp\.session\.v1)$/.test(key);

/** 書き換えた（同期の対象なら時刻を残して知らせる） */
export function touched(key: string) {
  if (!isSyncKey(key)) return;
  at[key] = Date.now();
  try {
    localStorage.setItem(K, JSON.stringify(at));
  } catch {
    /* noop */
  }
  for (const f of listeners) f(key);
}
export const localAt = (key: string) => at[key] ?? 0;
/** 同期で取り込んだときは、取り込んだ側の時刻にそろえる（次の比較で「この端末が新しい」としない） */
export function setLocalAt(key: string, t: number) {
  at[key] = t;
  try {
    localStorage.setItem(K, JSON.stringify(at));
  } catch {
    /* noop */
  }
}
export function onTouched(f: (key: string) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

const pulledListeners = new Set<(keys: string[]) => void>();
/** 同期でこの端末に取り込んだとき（総合英語のセッションなど、画面が持っている状態を読み直す） */
export function onPulled(f: (keys: string[]) => void) {
  pulledListeners.add(f);
  return () => pulledListeners.delete(f);
}
export function emitPulled(keys: string[]) {
  for (const f of pulledListeners) f(keys);
}
