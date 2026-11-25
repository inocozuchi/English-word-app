// アプリ全体の状態（Svelte 5 runes）。
import type { Dataset } from './types.ts';
import type { Index } from './dataset.ts';
import { buildIndex } from './dataset.ts';
import type { Settings, Progress } from './storage.ts';
import { loadSettings, saveSettings, loadProgress, saveProgress } from './storage.ts';
import { review } from './srs.ts';
import { dayNumber, dayKey } from './day.ts';

class Store {
  settings = $state(loadSettings());
  /** 中身は大きいので深いリアクティブにはせず、更新時に参照を差し替える */
  progress = $state.raw<Progress>(loadProgress());
  index = $state.raw<Index | null>(null);
  /** 現在の学習日（復帰時・1分ごとに更新） */
  today = $state(dayNumber(Date.now()));
}
export const store = new Store();

if (typeof document !== 'undefined') {
  const tick = () => {
    const d = dayNumber(Date.now());
    if (d !== store.today) store.today = d;
  };
  document.addEventListener('visibilitychange', tick);
  setInterval(tick, 60_000);
}

let loading: Promise<Index> | null = null;
/** 単語データを読み込む（別チャンク。起動直後に並行して読み込み始める） */
export function loadData(): Promise<Index> {
  return (loading ??= import('../generated/words.json').then((m) => {
    const ix = buildIndex(m.default as unknown as Dataset);
    store.index = ix;
    return ix;
  }));
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(store.settings, patch);
  saveSettings($state.snapshot(store.settings));
}

export function replaceAll(s: Settings, p: Progress) {
  store.settings = s;
  store.progress = p;
  saveSettings(s);
  saveProgress(p);
}

/** 1問の結果を記録し、すぐ保存する（途中でやめても失われない） */
export function recordAnswer(key: string, base: string, ok: boolean) {
  const now = Date.now();
  const today = dayNumber(now);
  const p = store.progress;
  const dk = dayKey(today);
  const d = p.days[dk] ?? { a: 0, c: 0 };
  const next: Progress = {
    items: { ...p.items, [key]: review(p.items[key], ok, now, today) },
    days: { ...p.days, [dk]: { a: d.a + 1, c: d.c + (ok ? 1 : 0) } },
    lastBase: base,
  };
  store.progress = next;
  store.today = today;
  saveProgress(next);
}

export const today = () => dayNumber(Date.now());
