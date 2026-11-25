// 語源英単語モード
import type { QuizMode } from '../../core/mode.ts';
import type { Format } from './types.ts';
import type { Scope } from './quiz.ts';
import { buildCandidates, questionFor, subjectOf, MODE_ID, FORMAT_LABEL } from './quiz.ts';
import { ety, loadEty } from './state.svelte.ts';
import { settingsSummary } from './summary.ts';
import Prompt from './Prompt.svelte';
import Explain from './Explain.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import Book from './screens/Book.svelte';
import Chapter from './screens/Chapter.svelte';
import RootView from './screens/RootView.svelte';
import WordView from './screens/WordView.svelte';
import GroupView from './screens/GroupView.svelte';
import ScopeScreen from './screens/Scope.svelte';

const ALL: Format[] = ['ej', 'je', 'rm', 'ph'];
export const DEFAULT_SCOPE: Scope = { formats: ['ej'], excludedRoots: [] };

export function normalizeScope(raw: any): Scope {
  const formats = Array.isArray(raw?.formats) ? ALL.filter((f) => raw.formats.includes(f)) : [];
  return {
    formats: formats.length ? formats : [...DEFAULT_SCOPE.formats],
    excludedRoots: Array.isArray(raw?.excludedRoots) ? raw.excludedRoots.filter((x: unknown) => typeof x === 'string') : [],
  };
}

export const etymologyMode: QuizMode<Scope> = {
  id: MODE_ID,
  title: '語源英単語',
  hero: 'Learn words\nby *roots*',
  tagline: '語源で、英単語を。',
  patterns: [
    { id: 'ej', label: '英 → 日', desc: '英単語を見て意味を選ぶ' },
    { id: 'je', label: '日 → 英', desc: '意味を見て英単語を選ぶ（英→日で学んだ語から）' },
    { id: 'rm', label: '語源の意味', desc: '語源（語根・接頭辞）の意味を選ぶ' },
    { id: 'ph', label: '熟語の意味', desc: '熟語の意味を選ぶ' },
  ],
  timing: { advanceOkSec: 4, advanceNgSec: 7, answerSec: 8 },
  normalizeSettings: normalizeScope,
  load: () => loadEty().then(() => {}),
  ready: () => !!ety.index,
  candidates: (s) => (ety.index ? buildCandidates(ety.index, s) : []),
  question: (key, rng) => (ety.index ? questionFor(ety.index, key, rng) : null),
  label(key) {
    const s = ety.index && subjectOf(ety.index, key);
    if (!s) return null;
    const tag = FORMAT_LABEL[key.slice(0, key.indexOf(':')) as Format];
    if (s.kind === 'word') return { title: s.word.w, sub: s.word.defs.map((d) => d.ja).join('／'), latin: true, tag };
    if (s.kind === 'root') return { title: s.root.root, sub: s.root.meaning, latin: true, tag };
    return { title: s.phrase.en, sub: s.phrase.ja, latin: true, tag };
  },
  detailRoute(key) {
    const s = ety.index && subjectOf(ety.index, key);
    if (!s) return null;
    if (s.kind === 'word') return { name: 'ety/word', params: { w: s.word.w } };
    if (s.kind === 'root') return { name: 'ety/root', params: { id: s.root.id } };
    return { name: 'ety/root', params: { id: s.phrase.root } };
  },
  summary: (s) => settingsSummary(ety.index, s),
  stat: () => (ety.index ? `${ety.index.ds.words.length.toLocaleString()}語 · ${ety.index.ds.roots.length}語源` : ''),
  Prompt,
  Explain,
  SettingsSection,
  StatsSection,
  browse: { route: { name: 'ety/book' }, label: '単語帳' },
  screens: {
    'ety/book': Book,
    'ety/chapter': Chapter,
    'ety/root': RootView,
    'ety/word': WordView,
    'ety/group': GroupView,
    'ety/scope': ScopeScreen,
  },
};
