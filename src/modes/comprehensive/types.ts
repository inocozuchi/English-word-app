// 総合英語モード（comprehensive）のデータ型。
// マスターは リポジトリ直下の comprehensive/（編集しない）。scripts/build-comprehensive.ts が検証して
// src/generated/comprehensive.json に1つにまとめる（このファイルの CompData の形）。
export type Priority = 'core' | 'recommended' | 'extra';
export type ItemKind = 'vocabulary' | 'idiom' | 'chunk';
export type QKind = 'recall' | 'listening' | 'translation' | 'dictation' | 'paraphrase' | 'reading' | 'correction';
export const Q_KINDS: QKind[] = ['recall', 'listening', 'translation', 'dictation', 'paraphrase', 'reading', 'correction'];

export interface Item {
  id: string;
  day: number;
  kind: ItemKind;
  english: string;
  kana: string;
  japanese: string;
  example: string;
  exampleJapanese?: string;
  priority: Priority;
}

export interface CQuestion {
  id: string;
  day: number;
  kind: QKind;
  prompt: string;
  acceptedAnswers: string[];
  explanation: string;
  itemIds: string[];
  priority: Priority;
  audioText?: string;
  grammarId?: string;
  pronunciationId?: string;
  conversationId?: string;
  readingId?: string;
  subtype?: string;
}

export type DayKind = 'lesson' | 'review' | 'assessment';
export interface Day {
  day: number;
  topic: string;
  /** learning_policy の種類（lesson / review / assessment。curriculum の test は assessment） */
  kind: DayKind;
  grammar?: string;
  itemIds: string[];
  questionIds: string[];
  reviewDays: number[];
}

export interface Profile {
  minutes: number;
  budget: { review: number; new: number; practice: number; finish: number };
  newItemCap: number;
  optionalPriorities: Priority[];
}

export interface VisualNode {
  english: string;
  japanese: string;
  [k: string]: unknown;
}
export type VisualType =
  | 'contrast'
  | 'morphology'
  | 'wordFamily'
  | 'collocation'
  | 'preposition'
  | 'questionResponse'
  | 'paraphraseFlow'
  | 'grammarStructure'
  | 'soundContrast'
  | 'connectedSpeech'
  | 'numberListening'
  | 'listeningPassage'
  | 'conversationFlow'
  | 'practicalReading'
  | 'topicVocabulary'
  | 'sentenceExpansion';
export interface Visual {
  id: string;
  type: VisualType;
  title: string;
  day: number;
  description: string;
  diagram?: string;
  nodes: VisualNode[];
  questionIds: string[];
  itemIds: string[];
}

export interface GrammarGroup {
  id: string;
  day: number;
  title: string;
  rule: string;
  diagram?: string;
  examples: { english: string; japanese: string; incorrect?: string }[];
  questionIds: string[];
}

export interface ConvChoice {
  text: string;
  next: string;
  feedback?: string;
}
export interface ConvNode {
  id: string;
  speaker?: string;
  slow?: boolean;
  terminal?: boolean;
  choices?: ConvChoice[];
}
export interface Scenario {
  id: string;
  day: number;
  title: string;
  goal: string;
  startNode: string;
  nodes: ConvNode[];
  questionIds: string[];
}

export interface ReadingDoc {
  id: string;
  day: number;
  title: string;
  text: string;
  fictional?: boolean;
  questionIds: string[];
}

export interface PronGroup {
  id: string;
  day: number;
  type: string;
  title: string;
  note?: string;
  nodes: { english: string; japanese: string; ipa?: string }[];
  questionIds: string[];
}

export type Domain = 'vocabulary' | 'grammar' | 'chunks' | 'listening' | 'paraphrase' | 'reading' | 'academic';
export interface DiagQuestion {
  id: string;
  domain: Domain;
  prompt: string;
  acceptedAnswers: string[];
  scoring: 'exact_or_self' | 'self';
  pairId: string;
  explanation: string;
  audioText?: string;
}
export interface DiagForm {
  id: 'baseline' | 'final';
  day: 0 | 60;
  questions: DiagQuestion[];
}

export interface IrregularVerb {
  id: string;
  base: string;
  past: string[];
  participle: string[];
  kana: string;
  japanese: string;
  itemId?: string;
  note?: string;
}
export interface VerbSense {
  id: string;
  base: string;
  phrase: string;
  japanese: string;
  example: string;
  exampleJapanese?: string;
  itemId?: string;
}

export interface CompData {
  release: string;
  counts: { items: number; practiceQuestions: number; diagnosticQuestions: number; visualGroups: number; days: number };
  items: Item[];
  questions: CQuestion[];
  days: Day[];
  route: string[];
  profiles: Profile[];
  reviewOffsets: number[];
  /** 重複問題の別名 → 正（quality_report.exactDuplicateQuestionAliases） */
  aliases: Record<string, string>;
  /** 同じ英語表記の別項目（意味が違う。同じセッションで重ねない） */
  sameEnglish: string[][];
  visuals: Visual[];
  grammar: GrammarGroup[];
  pronunciation: PronGroup[];
  pronunciationLimitations: string;
  scenarios: Scenario[];
  readings: ReadingDoc[];
  irregularVerbs: IrregularVerb[];
  verbSenses: VerbSense[];
  diagnostics: DiagForm[];
  diagScoring: { thresholds: { priorityReviewBelow: number; normalReviewBelow: number } };
  limitations: string[];
}
