// 画面表示用の集計（ホーム・単語帳・学習記録）
import type { Index } from './dataset.ts';
import type { Progress, Settings } from './storage.ts';
import type { ItemState } from './srs.ts';
import { LEARNED_BOX, isDue } from './srs.ts';
import { buildCandidates, FORMAT_LABEL } from './quiz.ts';
import type { Word } from './types.ts';

export type Status = 'new' | 'learning' | 'learned';

/** 単語の習得状況（英→日・日→英のうち進んでいる方） */
export function wordState(items: Record<string, ItemState>, w: Word): ItemState | undefined {
  const a = items['ej:' + w.w], b = items['je:' + w.w];
  if (!a) return b;
  if (!b) return a;
  return a.box >= b.box ? a : b;
}

export function wordStatus(items: Record<string, ItemState>, w: Word): Status {
  const s = wordState(items, w);
  if (!s) return 'new';
  return s.box >= LEARNED_BOX ? 'learned' : 'learning';
}

export const STATUS_LABEL: Record<Status, string> = { new: '未習', learning: '学習中', learned: '覚えた' };

/** 出題範囲で、今日の復習待ちの数 */
export function dueCount(ix: Index, s: Settings, p: Progress, today: number): number {
  let n = 0;
  for (const c of buildCandidates(ix, s)) {
    const st = p.items[c.key];
    if (st && isDue(st, today)) n++;
  }
  return n;
}

export function scopeLabel(ix: Index | null, s: Settings): string {
  if (!s.excludedRoots.length) return '全範囲';
  if (!ix) return '一部';
  const ex = new Set(s.excludedRoots);
  const chapters = ix.ds.chapters.filter((c) => c.roots.some((r) => !ex.has(r)));
  if (chapters.length === 1) {
    const c = chapters[0];
    const n = c.roots.filter((r) => !ex.has(r)).length;
    return n === c.roots.length ? `${c.no}章` : `${c.no}章の${n}語源`;
  }
  return `${chapters.length}章・${ix.ds.roots.length - ex.size}語源`;
}

export function settingsSummary(ix: Index | null, s: Settings): string {
  const f = s.formats.length === 1 ? FORMAT_LABEL[s.formats[0]] : `${s.formats.length}形式`;
  return `${s.count}問 · ${f} · ${scopeLabel(ix, s)}`;
}
