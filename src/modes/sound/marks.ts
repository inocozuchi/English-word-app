// マーキングの組み立て（UI に依存しない・テストあり）
import type { Mark } from './types.ts';

export type LineType = 'elide' | 'assim' | 'flap';

export interface Segment {
  text: string;
  /** この文字範囲に重ねる線 */
  lines: LineType[];
  /** t の行方の黄色マーカー */
  target: boolean;
}

/** 単語を、マーキングの境目で区切る（重なっていても境目ごとに分ける） */
export function segments(word: string, marks: { type: LineType; from: number; to: number }[], target?: { from: number; to: number } | null): Segment[] {
  const cuts = new Set([0, word.length]);
  for (const m of marks) {
    cuts.add(Math.max(0, Math.min(word.length, m.from)));
    cuts.add(Math.max(0, Math.min(word.length, m.to)));
  }
  if (target) {
    cuts.add(target.from);
    cuts.add(target.to);
  }
  const pts = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1];
    if (a === b) continue;
    out.push({
      text: word.slice(a, b),
      lines: marks.filter((m) => m.from <= a && m.to >= b).map((m) => m.type),
      target: !!target && target.from <= a && target.to >= b,
    });
  }
  return out;
}

/** 連結（link）でつながる単語を1つのまとまりに（まとまりの中では折り返さない） */
export function chains(count: number, marks: Mark[]): number[][] {
  const linked = new Set(marks.filter((m) => m.type === 'link').map((m) => m.word));
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < count; i++) {
    cur.push(i);
    if (!linked.has(i) || i === count - 1) {
      out.push(cur);
      cur = [];
    }
  }
  return out;
}
