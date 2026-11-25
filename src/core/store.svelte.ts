// アプリ全体の状態（Svelte 5 runes）。デッキに依存しない。
import type { Deck } from './deck.ts';
import type { Settings, Progress } from './storage.ts';
import { loadSettings, saveSettings, loadProgress, saveProgress } from './storage.ts';
import { review } from './srs.ts';
import { updateReview } from './review.ts';
import type { ReviewEvent } from './review.ts';
import { dayNumber, dayKey } from './day.ts';
import { DECKS, getDeck } from '../decks/index.ts';

class Store {
  settings = $state(loadSettings());
  /** 中身は大きいので深いリアクティブにはせず、更新時に参照を差し替える */
  progress = $state.raw<Progress>(loadProgress());
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

export const decks = DECKS;

/** 使っているデッキ */
export function activeDeck(): Deck {
  return getDeck(store.settings.activeDeck);
}

/** デッキの設定（正規化済み） */
export function deckSettings<S = any>(deck: Deck<S>): S {
  return deck.normalizeSettings(store.settings.decks[deck.id]);
}

export function updateDeckSettings<S>(deck: Deck<S>, patch: Partial<S>) {
  const cur = deckSettings(deck);
  store.settings.decks = { ...store.settings.decks, [deck.id]: { ...cur, ...patch } };
  saveSettings($state.snapshot(store.settings));
}

/** 使っているデッキのデータを読み込む */
export function loadData(): Promise<void> {
  return activeDeck().load();
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

/** 1問の結果を記録し、すぐ保存する（途中でやめても失われない）。復習リストも更新する */
export function recordAnswer(deck: string, key: string, base: string, ok: boolean): ReviewEvent {
  const now = Date.now();
  const today = dayNumber(now);
  const p = store.progress;
  const dk = dayKey(today);
  const d = p.days[dk] ?? { a: 0, c: 0 };
  const r = updateReview(p.review, deck, key, ok, now, store.settings.reviewGoal);
  const next: Progress = {
    items: { ...p.items, [key]: review(p.items[key], ok, now, today) },
    days: { ...p.days, [dk]: { a: d.a + 1, c: d.c + (ok ? 1 : 0) } },
    lastBase: base,
    review: r.list,
  };
  store.progress = next;
  store.today = today;
  saveProgress(next);
  return r.event;
}

/** 復習リストから手動で外す */
export function removeFromReview(key: string) {
  const { [key]: _, ...rest } = store.progress.review;
  const next = { ...store.progress, review: rest };
  store.progress = next;
  saveProgress(next);
}

export const today = () => dayNumber(Date.now());
