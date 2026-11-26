// イメージリンク 反射版: 見た瞬間にコアイメージが浮かぶ状態をつくる（238問＋暗記カード60枚。1回3分）。
// 完全版（imagelink）とは別のモード・別の記録。キーは r_ で始まる id。
// クイズは専用の画面（screens/ReflexQuiz.svelte）: 問題ごとの3〜5秒・選んだ瞬間に採点・自動で次へ・再出題。
import type { QuizMode } from '../../core/mode.ts';
import type { ReflexSettings, Built } from './engine.ts';
import { MODE_ID, METHODS, normalizeReflexSettings, reflexCandidates, buildChoices } from './engine.ts';
import { IL_SRS } from '../imagelink/quiz.ts';
import { rx, loadReflex, qById } from './state.svelte.ts';
import { itemLabel } from './label.ts';
import Prompt from './Prompt.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import ReflexQuiz from './screens/ReflexQuiz.svelte';
import ReflexResult from './screens/ReflexResult.svelte';
import ReflexRates from './screens/ReflexRates.svelte';
import ReflexItem from './screens/ReflexItem.svelte';

export const reflexMode: QuizMode<ReflexSettings> = {
  id: MODE_ID,
  title: 'イメージリンク 反射',
  hero: 'Snap to\nthe *image*',
  tagline: '見た瞬間に、コアイメージ。1回3分。',
  patterns: METHODS.map(({ id, label, desc }) => ({ id, label, desc })),
  timing: { advanceOkSec: 2, advanceNgSec: 2, answerSec: 5 },
  srs: IL_SRS,
  hideTiming: true,
  reportable: true,
  normalizeSettings: normalizeReflexSettings,
  load: () => loadReflex().catch(() => {}),
  ready: () => !!rx.questions,
  candidates: (s) => (rx.questions ? reflexCandidates({ questions: rx.questions, cards: rx.cards }, s) : []),
  question(key, rng) {
    const q = qById.get(key);
    const b = q && buildChoices(q, rng);
    if (!b) return null;
    return {
      modeId: MODE_ID,
      key,
      base: key,
      group: q!.group,
      pattern: q!.type,
      patternLabel: q!.type,
      choices: b.choices.map((c) => ({ text: c.text, latin: c.latin, image: c.image })),
      answer: b.answer,
      data: b as Built,
    };
  },
  quizRoute: (kind) => ({ name: 'reflex/quiz', params: { kind } }),
  label: itemLabel,
  detailRoute: (key) => ({ name: 'reflex/item', params: { key } }),
  summary(s) {
    const m = METHODS.find((x) => x.id === s.method)!;
    return s.method === 'group' ? `${m.label}（${s.group}）` : m.label;
  },
  stat: () => (rx.questions ? `${rx.questions.length}問 · カード${rx.cards.length}枚` : ''),
  Prompt,
  SettingsSection,
  StatsSection,
  browse: { route: { name: 'reflex/rates' }, label: '反射率' },
  screens: {
    'reflex/quiz': ReflexQuiz,
    'reflex/result': ReflexResult,
    'reflex/rates': ReflexRates,
    'reflex/item': ReflexItem,
  },
};
