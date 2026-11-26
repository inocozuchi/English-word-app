// アプリ全体の状態（Svelte 5 runes）。モードに依存しない。
// store.progress は「今選んでいるモード」の学習記録。モードを切り替えると読み込み直す。
import type { QuizMode, Timing } from './mode.ts';
import type { Settings, Progress } from './storage.ts';
import { loadSettings, saveSettings, loadProgress, saveProgress, resolveTiming } from './storage.ts';
import { review } from './srs.ts';
import { updateReview } from './review.ts';
import type { ReviewEvent } from './review.ts';
import { dayNumber, dayKey } from './day.ts';
import { MODES, getMode } from '../modes/index.ts';

class Store {
  settings = $state(loadSettings());
  /** 中身は大きいので深いリアクティブにはせず、更新時に参照を差し替える */
  progress = $state.raw<Progress>(loadProgress(getMode(this.settings.activeMode).id));
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

export const modes = MODES;

/** 使っているモード */
export function activeMode(): QuizMode {
  return getMode(store.settings.activeMode);
}

/** モードの設定（正規化済み） */
export function modeSettings<S = any>(mode: QuizMode<S>): S {
  return mode.normalizeSettings(store.settings.modes[mode.id]);
}

export function updateModeSettings<S>(mode: QuizMode<S>, patch: Partial<S>) {
  const raw = store.settings.modes[mode.id] ?? {};
  store.settings.modes = { ...store.settings.modes, [mode.id]: { ...raw, ...mode.normalizeSettings(raw), ...patch } };
  saveSettings($state.snapshot(store.settings));
}

/** モードごとの秒数 */
export function timingOf(mode: QuizMode): Timing {
  return resolveTiming(store.settings.modes[mode.id], mode.timing);
}

export function updateTiming(mode: QuizMode, patch: Partial<Timing>) {
  const raw = store.settings.modes[mode.id] ?? {};
  store.settings.modes = { ...store.settings.modes, [mode.id]: { ...raw, ...patch } };
  saveSettings($state.snapshot(store.settings));
}

/** 使っているモードのデータを読み込む */
export function loadData(): Promise<void> {
  return activeMode().load();
}

/** モードを切り替える（選んだモードは保存され、次回以降も使う） */
export function switchMode(id: string) {
  const m = getMode(id);
  if (m.id === store.settings.activeMode) return;
  store.settings.activeMode = m.id;
  saveSettings($state.snapshot(store.settings));
  store.progress = loadProgress(m.id);
  m.load();
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(store.settings, patch);
  saveSettings($state.snapshot(store.settings));
}

/** 全モードの学習記録（書き出し用） */
export function allProgress(): Record<string, Progress> {
  const out: Record<string, Progress> = {};
  for (const m of MODES) out[m.id] = m.id === store.settings.activeMode ? store.progress : loadProgress(m.id);
  return out;
}

export function replaceAll(s: Settings, progress: Record<string, Progress>) {
  saveSettings(s);
  for (const [id, p] of Object.entries(progress)) saveProgress(id, p);
  store.settings = s;
  store.progress = loadProgress(getMode(s.activeMode).id);
}

/** 1問の結果を記録し、すぐ保存する（途中でやめても失われない）。復習リストとタグ別の正答率も更新する */
export function recordAnswer(key: string, base: string, ok: boolean, tags: string[] = [], conf?: 'low' | 'high'): ReviewEvent {
  const now = Date.now();
  const today = dayNumber(now);
  const p = store.progress;
  const dk = dayKey(today);
  const d = p.days[dk] ?? { a: 0, c: 0 };
  const r = updateReview(p.review, key, ok, now, store.settings.reviewGoal);
  const t = { ...p.tags };
  for (const tag of tags) {
    const cur = t[tag] ?? { seen: 0, correct: 0 };
    t[tag] = { seen: cur.seen + 1, correct: cur.correct + (ok ? 1 : 0) };
  }
  const next: Progress = {
    items: { ...p.items, [key]: review(p.items[key], ok, now, today, activeMode().srs, conf) },
    days: { ...p.days, [dk]: { a: d.a + 1, c: d.c + (ok ? 1 : 0) } },
    lastBase: base,
    review: r.list,
    tags: t,
  };
  store.progress = next;
  store.today = today;
  saveProgress(store.settings.activeMode, next);
  return r.event;
}

/** 復習リストから手動で外す */
export function removeFromReview(key: string) {
  const { [key]: _, ...rest } = store.progress.review;
  const next = { ...store.progress, review: rest };
  store.progress = next;
  saveProgress(store.settings.activeMode, next);
}

/** このモードでの回答数の合計 */
export function answeredCount(p: Progress): number {
  let n = 0;
  for (const d of Object.values(p.days)) n += d.a;
  return n;
}

export const today = () => dayNumber(Date.now());
