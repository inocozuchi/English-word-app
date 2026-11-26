// 音声変化モードのデータ型（scripts/build-sound.ts が data/sound_changes.json から生成する sound.json の形）

export type RuleId = 'link' | 'elide' | 'assim' | 'flap' | 'contraction' | 'hdrop';
export const RULE_IDS: RuleId[] = ['link', 'elide', 'assim', 'flap', 'contraction', 'hdrop'];

export interface Rule {
  id: RuleId;
  name: string;
  nameEn: string;
  /** マーキングとバッジの色 */
  color: string;
  summary: string;
  lectures: number[];
}

export interface Lecture {
  no: number;
  title: string;
  rules: RuleId[];
  summary: string;
}

/** 視覚マーキング。link は words[word] と words[word+1] の間、それ以外は words[word] の文字範囲 [from, to) */
export interface Mark {
  type: 'link' | 'elide' | 'assim' | 'flap';
  word: number;
  from?: number;
  to?: number;
}

export interface Change {
  span: string;
  rule: RuleId;
  why: string;
  ask?: string;
}

export interface Item {
  id: string;
  lecture: number;
  source: 'video' | 'supplement';
  level: number;
  text: string;
  words: string[];
  marks: Mark[];
  /** 学校読み */
  plain: string;
  /** 実際の聞こえ方 */
  kana: string;
  ja: string;
  decoys: string[];
  changes: Change[];
  quiz: boolean;
  ctx?: string;
  alt?: string;
  note?: string;
  /** 変化に出てくるルール（重複なし・出てくる順） */
  rules: RuleId[];
  /** kana のモーラ数（目安） */
  mora: number;
  /** 学習順 */
  order: number;
}

export interface Contraction {
  id: string;
  lecture: number;
  form: string;
  original: string[];
  ja: string;
  kana: string;
}

export interface Assimilation {
  id: string;
  lecture: number;
  combo: string;
  result: string;
  kana: string;
  example: string;
}

export type Fate = 'flap' | 'elide' | 'absorb' | 'clear';

export interface TFate {
  id: string;
  lecture: number;
  text: string;
  words: string[];
  target: { word: number; from: number; to: number };
  fate: Fate;
  why: string;
}

export interface Compound {
  id: string;
  text: string;
  words: string[];
  marks: Mark[];
  kana: string;
  ja: string;
  steps: { label: string; rule: RuleId | null }[];
  note: string;
}

export interface Symptom {
  id: string;
  lecture: number;
  rule: RuleId;
  symptom: string;
}

export interface Concept {
  id: string;
  lecture: number;
  q: string;
  answer: string;
  wrong: string[];
  why: string;
}

export interface SoundData {
  title: string;
  rules: Rule[];
  lectures: Lecture[];
  items: Item[];
  contractions: Contraction[];
  assimilations: Assimilation[];
  tFate: TFate[];
  fateLabels: Record<Fate, string>;
  compounds: Compound[];
  symptoms: Symptom[];
  concepts: Concept[];
}
