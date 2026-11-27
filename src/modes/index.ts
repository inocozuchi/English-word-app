// 使えるモードの一覧（設定の「モード」に、この順で並ぶ）。
// 新しいクイズは src/modes/<id>/ を作り、QuizMode を実装してここに足す（CLAUDE.md「モードの追加方法」）。
import type { QuizMode } from '../core/mode.ts';
import { etymologyMode } from './etymology/mode.ts';
import { soundMode } from './sound/mode.ts';
import { chunksMode } from './chunks/mode.ts';
import { imagelinkMode } from './imagelink/mode.ts';
import { reflexMode } from './reflex/mode.ts';
import { compMode } from './comprehensive/mode.ts';
import { customMode } from './custom/mode.ts';

export const MODES: QuizMode[] = [etymologyMode, soundMode, chunksMode, imagelinkMode, reflexMode, compMode, customMode];

export function getMode(id: string): QuizMode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
