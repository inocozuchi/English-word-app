// 音声変化（聞こえ方）モード
import type { QuizMode } from '../../core/mode.ts';
import type { SoundSettings, SoundQuestion } from './quiz.ts';
import { MODE_ID, PATTERNS, PATTERN_LABEL, normalizeSoundSettings, soundCandidates, soundQuestion, soundPick, ALL_LECTURES } from './quiz.ts';
import type { PatternId } from './quiz.ts';
import { RULE_IDS } from './types.ts';
import { snd, loadSound } from './state.svelte.ts';
import Prompt from './Prompt.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import ResultSection from './ResultSection.svelte';
import Notes from './screens/Notes.svelte';
import LectureView from './screens/LectureView.svelte';
import RuleView from './screens/RuleView.svelte';
import ItemView from './screens/ItemView.svelte';
import './rules.css';

/** カタカナが出る問題 */
const HAS_KANA = new Set(['item', 'cause', 'contraction', 'assim', 'compound']);

export const soundMode: QuizMode<SoundSettings> = {
  id: MODE_ID,
  title: '音声変化',
  hero: 'Hear how it\n*really* sounds',
  tagline: '聞こえ方を、ルールで。',
  patterns: PATTERNS.map(({ id, label, desc }) => ({ id, label, desc })),
  timing: { advanceOkSec: 6, advanceNgSec: 10, answerSec: 12 },
  normalizeSettings: normalizeSoundSettings,
  load: () => loadSound().then(() => {}),
  ready: () => !!snd.index,
  candidates: (s) => (snd.index ? soundCandidates(snd.index, s) : []),
  pick: (input) => (snd.index ? soundPick(snd.index, input) : []),
  question: (key, rng) => (snd.index ? soundQuestion(snd.index, key, rng) : null),
  label(key) {
    const q = snd.index && soundQuestion(snd.index, key, () => 0.5);
    if (!q) return null;
    const s = q.data;
    const tag = PATTERN_LABEL[q.pattern as PatternId];
    switch (s.kind) {
      case 'item':
      case 'cause':
        return { title: s.item.text, sub: s.item.kana, latin: true, tag };
      case 'symptom':
        return { title: s.symptom.symptom, sub: snd.index!.rule.get(s.symptom.rule)?.name ?? '', tag };
      case 'contraction':
        return { title: s.c.form, sub: s.c.original.join(' / '), latin: true, tag };
      case 'assim':
        return { title: s.a.combo, sub: `${s.a.result}（${s.a.kana}）`, latin: true, tag };
      case 'tfate':
        return { title: s.t.text, sub: snd.index!.d.fateLabels[s.t.fate], latin: true, tag };
      case 'compound':
        return { title: s.c.text, sub: s.c.kana, latin: true, tag };
      case 'concept':
        return { title: s.c.q, sub: s.c.answer, tag };
    }
  },
  detailRoute(key) {
    const q = snd.index && soundQuestion(snd.index, key, () => 0.5);
    if (!q) return null;
    const s = q.data;
    switch (s.kind) {
      case 'item':
      case 'cause':
        return { name: 'sound/item', params: { id: s.item.id } };
      case 'symptom':
        return { name: 'sound/rule', params: { id: s.symptom.rule } };
      case 'compound':
        return { name: 'sound/rule', params: { id: q.tags?.[0] ?? 'link' } };
      case 'contraction':
      case 'assim':
      case 'tfate':
      case 'concept':
        return { name: 'sound/lecture', params: { no: (s.kind === 'contraction' || s.kind === 'concept' ? s.c : s.kind === 'assim' ? s.a : s.t).lecture } };
    }
  },
  summary(s) {
    const parts: string[] = [];
    parts.push(s.patterns.length === PATTERNS.length ? '全パターン' : `${s.patterns.length}パターン`);
    const narrowed = s.lectures.length < ALL_LECTURES.length || s.rules.length < RULE_IDS.length || s.level < 3 || !s.supplement;
    parts.push(narrowed ? '範囲を指定' : '全範囲');
    return parts.join(' · ');
  },
  stat: () => (snd.index ? `${snd.index.d.items.length}フレーズ · ${snd.index.d.rules.length}ルール` : ''),
  Prompt,
  inlineExplain: true,
  note: (q) => (HAS_KANA.has((q as SoundQuestion).data.kind) ? 'カタカナは目安です（実際の速さや話者によって揺れます）' : null),
  SettingsSection,
  StatsSection,
  ResultSection,
  browse: { route: { name: 'sound/notes' }, label: '復習ノート' },
  screens: {
    'sound/notes': Notes,
    'sound/lecture': LectureView,
    'sound/rule': RuleView,
    'sound/item': ItemView,
  },
};
