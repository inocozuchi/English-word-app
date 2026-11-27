// 自由英単語: 自分で登録した英単語と日本語訳だけでクイズをする（英→日・日→英・つづり）
// 単語リストは screens/Words.svelte で追加・編集・まとめて追加・書き出し。保存は settings.modes.custom.words
import { customWords } from './words.ts';
import { typingOf } from '../../core/storage.ts';
import type { QuizMode } from '../../core/mode.ts';
import type { CustomSettings } from './quiz.ts';
import { MODE_ID, PATTERNS, MIN_WORDS, normalizeCustomSettings, customCandidates, customQuestion } from './quiz.ts';
import { store } from '../../core/store.svelte.ts';
import Prompt from './Prompt.svelte';
import Explain from './Explain.svelte';
import Interact from './Interact.svelte';
import SettingsSection from './SettingsSection.svelte';
import Words from './screens/Words.svelte';

const words = () => normalizeCustomSettings(store.settings.modes[MODE_ID]).words;

export const customMode: QuizMode<CustomSettings> = {
  id: MODE_ID,
  title: '自由英単語',
  hero: 'Your words,\n*your* quiz',
  tagline: '自分で集めた単語だけで。',
  patterns: PATTERNS,
  timing: { advanceOkSec: 3, advanceNgSec: 6, answerSec: 10 },
  normalizeSettings: normalizeCustomSettings,
  load: async () => {},
  ready: () => true,
  candidates: (s) => customCandidates(s, typingOf(store.settings)),
  question: (key, rng) => customQuestion(words(), key, rng),
  label(key) {
    const id = key.replace(/^(ej|je|sp):/, '');
    const w = words().find((x) => x.id === id);
    return w ? { title: w.en, sub: w.ja, latin: true, tag: PATTERNS.find((p) => key.startsWith(p.id + ':'))?.label } : null;
  },
  detailRoute: (key) => ({ name: 'custom/words', params: { focus: key.replace(/^(ej|je|sp):/, '') } }),
  summary(s) {
    if (!s.words.length) return '単語を登録して始めましょう';
    return `${s.words.length}語 · ${s.patterns.map((p) => PATTERNS.find((x) => x.id === p)!.label).join('・')}`;
  },
  backdrop: () => customWords().map((w) => ({ t: w.en, id: w.id })),
  stat: () => `${words().length}語`,
  emptyHint() {
    const n = words().length;
    if (n < MIN_WORDS)
      return { text: n ? `あと ${MIN_WORDS - n} 語で4択が出せます` : 'まだ単語がありません', sub: '英単語と日本語訳を登録すると、その単語だけでクイズができます（4択は4語以上）。', action: { label: '単語を追加する', route: { name: 'custom/words' } } };
    return { text: '出題できる問題がありません', sub: '設定で出題パターンを確認してください（つづりは「文字を入力する問題」を「出さない」にすると出ません）。', action: { label: '単語リストを開く', route: { name: 'custom/words' } } };
  },
  Prompt,
  Explain,
  Interact,
  SettingsSection,
  browse: { route: { name: 'custom/words' }, label: '単語リスト' },
  screens: { 'custom/words': Words },
};
