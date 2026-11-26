// イメージリンク反射版のデータ（public/data/imagelink-reflex/ の JSON。README.md に仕様）
export type RType = 'r_word2image' | 'r_image2word' | 'r_prep_icon' | 'r_prep_word2icon' | 'r_fig2word' | 'r_word2fig';

export interface RQuestion {
  id: string;
  type: RType;
  question: string;
  prompt_en?: string;
  prompt_ja?: string;
  figure?: string;
  answer?: string;
  distractors?: string[];
  answer_figure?: string;
  distractor_figures?: string[];
  time_limit_sec: number;
  part: number;
  chapter: number;
  chapter_title: string;
  ref_page_a5: number;
  group: string;
  tags: string[];
}

export interface RCard {
  id: string;
  word: string;
  image: string;
  group: string;
  chapter: number;
  part: number;
  chapter_title: string;
  ref_page_a5: number;
}

export interface RIndexFile {
  name: string;
  question_file: string;
  cards_file: string;
  count: number;
  default_time_limit_sec: number;
  groups: string[];
}
