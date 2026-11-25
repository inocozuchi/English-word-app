// 会話チャンクモード: 英会話でそのまま使える「かたまり」を、意味・使い分け・穴埋めで覚える
import type { QuizMode } from '../../core/mode.ts';
import type { ChunkSettings } from './quiz.ts';
import { MODE_ID, PATTERNS, ALL_SECTIONS, normalizeChunkSettings, chunkCandidates, chunkQuestion, chunkPick } from './quiz.ts';
import { chk, loadChunks } from './state.svelte.ts';
import Prompt from './Prompt.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import ResultSection from './ResultSection.svelte';
import Dict from './screens/Dict.svelte';
import ListView from './screens/ListView.svelte';
import EntryView from './screens/EntryView.svelte';

export const chunksMode: QuizMode<ChunkSettings> = {
  id: MODE_ID,
  title: '会話チャンク',
  hero: 'Say it\nin *chunks*',
  tagline: 'そのまま使える、ひとかたまり。',
  patterns: PATTERNS.map(({ id, label, desc }) => ({ id, label, desc })),
  timing: { advanceOkSec: 5, advanceNgSec: 9, answerSec: 10 },
  normalizeSettings: normalizeChunkSettings,
  load: () => loadChunks().then(() => {}),
  ready: () => !!chk.index,
  candidates: (s) => (chk.index ? chunkCandidates(chk.index, s) : []),
  pick: (input, s) => (chk.index ? chunkPick(chk.index, input, s) : []),
  question: (key, rng) => (chk.index ? chunkQuestion(chk.index, key, rng) : null),
  label(key) {
    const ix = chk.index;
    if (!ix) return null;
    const id = key.replace(/^c[1-4]:/, '');
    if (id.includes('#')) {
      const [pid, side] = id.split('#');
      const p = ix.pair.get(pid);
      return p ? { title: p[side as 'a' | 'b'].en, sub: p[side as 'a' | 'b'].ja, latin: true, tag: '使い分け' } : null;
    }
    const e = ix.byId.get(id);
    return e ? { title: e.bare, sub: e.meaning, latin: true, tag: e.priority } : null;
  },
  detailRoute(key) {
    const id = key.replace(/^c[1-4]:/, '');
    if (id.includes('#')) return { name: 'chunks/dict', params: { tab: 'pairs' } };
    return chk.index?.byId.has(id) ? { name: 'chunks/entry', params: { id } } : null;
  },
  summary(s) {
    const parts = [s.patterns.length === PATTERNS.length ? '全パターン' : `${s.patterns.length}パターン`];
    parts.push(s.autoUnlock ? '段階解放' : s.priorities.join('・'));
    if (s.sections.length < ALL_SECTIONS.length) parts.push(`${s.sections.length}章`);
    return parts.join(' · ');
  },
  stat: () => (chk.index ? `${chk.index.d.entries.length}表現 · ${chk.index.d.sections.length}章` : ''),
  Prompt,
  inlineExplain: true,
  SettingsSection,
  StatsSection,
  ResultSection,
  browse: { route: { name: 'chunks/dict' }, label: 'チャンク辞典' },
  screens: {
    'chunks/dict': Dict,
    'chunks/list': ListView,
    'chunks/entry': EntryView,
  },
};
