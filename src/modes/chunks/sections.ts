// 章ごとの正答率（記録のタグ sec:N から）
import type { TagStats } from '../../core/mode.ts';
import type { ChunkIndex } from './quiz.ts';

export interface SectionStat {
  no: number;
  title: string;
  seen: number;
  rate: number;
}

/** 答えたことのある章を、正答率の低い順に */
export function weakSections(ix: ChunkIndex, tags: TagStats, n = 3): SectionStat[] {
  const out: SectionStat[] = [];
  for (const s of ix.d.sections) {
    const t = tags[`sec:${s.no}`];
    if (!t?.seen) continue;
    out.push({ no: s.no, title: s.title, seen: t.seen, rate: t.correct / t.seen });
  }
  return out.sort((a, b) => a.rate - b.rate || b.seen - a.seen).slice(0, n);
}
