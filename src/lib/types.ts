// アプリ内で使うデータ型（scripts/build-data.ts が生成する words.json の形）

export interface Def { pos: string; ja: string }
export interface Example { en: string; ja: string }
export interface Part { part: string; meaning: string }
export interface Derivative { word: string; pos: string; ja: string }

/** カナの1バリアント。parts は奇数番目が「強く読む」部分。label は（名）（動）など */
export interface KanaVariant { label: string | null; parts: string[] }

export interface Word {
  id: number;
  w: string;
  kana: KanaVariant[];
  /** 掲載されている語源ID。先頭が主たる語源（詳細表示に使う掲載元） */
  roots: string[];
  breakdown: Part[];
  core: string | null;
  defs: Def[];
  examples: Example[];
  derivatives: Derivative[];
  note: string | null;
  /** 覚え方として併記されているだけ（語源的には別系統）の語源ID */
  refIn: string[];
  /** 学習順（章 → 語源 → 単語の並び） */
  order: number;
}

export interface Phrase {
  id: number;
  en: string;
  ja: string;
  examples: Example[];
  root: string;
  order: number;
}

export interface Root {
  id: string;
  /** 表示用の綴り（例: "cede / ceed / cess"） */
  root: string;
  meaning: string;
  meaningEn: string;
  chapter: number;
  category: string;
  intro: string;
  memo: string;
  note: string | null;
  words: number[];
  /** words のうち、覚え方として併記されている別語源の単語 */
  refs: number[];
  phrases: number[];
  order: number;
}

export interface Chapter { no: number; title: string; roots: string[] }

export interface GroupWord { w: string; kana: KanaVariant[]; defs: Def[]; examples: Example[] }
export interface Group { id: string; title: string; words: GroupWord[] }

export interface Dataset {
  title: string;
  chapters: Chapter[];
  roots: Root[];
  words: Word[];
  phrases: Phrase[];
  groups: Group[];
}

/** 出題形式: 英→日 / 日→英 / 語源→意味 / 熟語→意味 */
export type Format = 'ej' | 'je' | 'rm' | 'ph';
