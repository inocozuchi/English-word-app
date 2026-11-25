// 語源デッキの表示用の集計
import type { Index } from './dataset.ts';
import type { ItemState } from '../../core/srs.ts';
import { LEARNED_BOX } from '../../core/srs.ts';
import type { Scope } from './quiz.ts';
import { FORMAT_LABEL } from './quiz.ts';
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

export function scopeLabel(ix: Index | null, s: Scope): string {
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

export function settingsSummary(ix: Index | null, s: Scope): string {
  const f = s.formats.length === 1 ? FORMAT_LABEL[s.formats[0]] : `${s.formats.length}形式`;
  return `${f} · ${scopeLabel(ix, s)}`;
}
