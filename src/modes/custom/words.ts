// 自由英単語の単語リストの読み書き（設定 settings.modes.custom.words に保存。バックアップに含まれ、
// 「学習記録を消去」では消えない）。ほかのモード（総合英語・語源英単語）からも追加できる
import { store, updateModeSettings } from '../../core/store.svelte.ts';
import type { QuizMode } from '../../core/mode.ts';
import { MODE_ID, newId, normWord, normalizeCustomSettings, type CWord, type CustomSettings } from './quiz.ts';

const current = () => normalizeCustomSettings(store.settings.modes[MODE_ID]);
export const customWords = (): CWord[] => current().words;

function save(words: CWord[]) {
  const s = current();
  // updateModeSettings は今のモードでなくても、そのモードの設定を書き換える（id と正規化だけ使う）
  const target = { id: MODE_ID, normalizeSettings: normalizeCustomSettings } as unknown as QuizMode<CustomSettings>;
  updateModeSettings(target, { ...s, words });
}

export const findWord = (en: string) => customWords().find((w) => normWord(w.en) === normWord(en));

/** 追加する（同じ英単語があれば意味を足さずにそのまま。追加した数を返す） */
export function addWords(list: { en: string; ja: string; ex?: string; note?: string }[]): number {
  const words = customWords();
  let n = 0;
  const now = Date.now();
  for (const x of list) {
    const en = x.en.trim(), ja = x.ja.trim();
    if (!en || !ja || words.some((w) => normWord(w.en) === normWord(en))) continue;
    words.push({ id: newId(now + n), en, ja, ...(x.ex?.trim() ? { ex: x.ex.trim() } : {}), ...(x.note?.trim() ? { note: x.note.trim() } : {}), added: now + n });
    n++;
  }
  if (n) save(words);
  return n;
}

export function updateWord(id: string, patch: Partial<Omit<CWord, 'id' | 'added'>>) {
  save(customWords().map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

export function removeWord(id: string) {
  save(customWords().filter((w) => w.id !== id));
}

