// 使えるデッキの一覧。新しいクイズ（文法など）は src/modes/<id>/ を作ってここに足す。
import type { QuizMode } from '../core/mode.ts';
import { etymologyMode } from './etymology/mode.ts';

export const MODES: QuizMode[] = [etymologyMode];

export function getMode(id: string): QuizMode {
  return MODES.find((d) => d.id === id) ?? MODES[0];
}
