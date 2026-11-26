import { PART_COLORS } from './quiz.ts';
/** 部の色（CSS 変数 --part に入れる。ダークモードでは app.css 側で明るく混ぜる） */
export const partColor = (part: number) => PART_COLORS[part] ?? 'var(--accent)';
