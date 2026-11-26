// 会話チャンクモードのデータ型（scripts/build-chunks.ts が data/chunks.json から生成する chunks.json の形）

export type Priority = 'A' | 'B' | 'C';
export const PRIORITIES: Priority[] = ['A', 'B', 'C'];

export interface Section {
  no: number;
  title: string;
  from: number;
  to: number;
  count: number;
}

export interface Entry {
  id: string;
  num: number;
  section: number;
  priority: Priority;
  /** 原版の表記 */
  chunk: string;
  /** （）内の言い換えを除いた形 */
  bare: string;
  /** （）内の元の形（wanna → want to など） */
  gloss?: string;
  ex: string;
  meaning: string;
  exJa: string;
  note: string;
  /** nz / uk / au / us（目安） */
  region: string[];
  /** formal / casual（目安） */
  style: string[];
  /** 穴埋め: 例文のチャンクを ＿＿＿＿ に置き換えたもの */
  blank: { text: string; answer: string } | null;
  sameMeaning: number[];
  similarMeaning: number[];
  /** 和→英の出題に使わない */
  ambiguous: boolean;
  /** 紛らわしい表現の番号（形が近い順） */
  near: number[];
  crossRef?: { mode: string; lecture: number };
}

export interface Pair {
  id: string;
  a: { en: string; ja: string };
  b: { en: string; ja: string };
  refs: (number | null)[];
  note?: string;
}

export interface ChunkData {
  title: string;
  priorities: Record<Priority, string>;
  sections: Section[];
  entries: Entry[];
  pairs: Pair[];
}
