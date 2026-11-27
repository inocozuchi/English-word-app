// 「答え合わせのあとに英文を読み上げる」設定（store を読むのは呼んだときだけ：モード一覧との循環 import を避ける）
import { store } from '../../core/store.svelte.ts';
import { MODE_ID } from './quiz.ts';
export const autoSpeakOn = () => store.settings.audio && !!store.settings.modes[MODE_ID]?.autoSpeak;
