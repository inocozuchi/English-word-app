// イメージリンクのデータ（public/data/imagelink/ の JSON。README.md に仕様）
export type QType =
  | 'en2ja'
  | 'ja2en'
  | 'translate'
  | 'order'
  | 'en2point'
  | 'table'
  | 'flashcard'
  | 'exercise'
  | 'cloze'
  | 'fig_caption'
  | 'fig_choose'
  | 'prep_icon'
  | 'core_image';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface IlRaw {
  id: string;
  type: QType;
  part: number;
  chapter: number;
  chapter_title: string;
  ref_page_a5: number;
  section?: string;
  difficulty: Difficulty;
  tags: string[];
  question: string;
  prompt_en?: string;
  prompt_ja?: string;
  answer?: string;
  distractors?: string[];
  explanation?: string;
  speak?: string;
  confidence?: 'medium';
  note?: string;
  tokens?: string[];
  answer_mode?: 'short' | 'self';
  figure?: string;
  figure_id?: string;
  answer_figure?: string;
  answer_figure_id?: string;
  distractor_figures?: string[];
  no_in_chapter?: number;
}

export interface IlPart {
  part: number;
  name: string;
  file: string;
}

export interface IlChapter {
  no: number;
  part: number;
  title: string;
  subtitle?: string;
  source?: string;
  page_a5: number;
  question_count: number;
}

export interface IlIndexFile {
  parts: IlPart[];
  chapters: IlChapter[];
}
