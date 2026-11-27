// イメージリンクモード: 英語の語・文法を「コアイメージ」で理解する（教科書「英語イメージリンク 完全版テキスト」全187章・10,695問）
// データは public/data/imagelink/（README.md）。起動時には読まず、出題範囲の部の JSON だけを読む（state.svelte.ts）。
import type { QuizMode } from '../../core/mode.ts';
import type { IlSettings } from './quiz.ts';
import {
  MODE_ID,
  METHODS,
  IL_SRS,
  TYPE_LABELS,
  normalizeIlSettings,
  ilCandidates,
  ilPick,
  buildQuestion,
  sessionCount,
  neededParts,
  parseKey,
} from './quiz.ts';
import { il, loadIndex, loadParts, loadedQuestions, questionById, partOfChapter } from './state.svelte.ts';
import { store } from '../../core/store.svelte.ts';
import Prompt from './Prompt.svelte';
import Explain from './Explain.svelte';
import Interact from './Interact.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import Chapters from './screens/Chapters.svelte';
import ChapterFilter from './screens/ChapterFilter.svelte';
import QuestionView from './screens/QuestionView.svelte';

/** 今の設定（store は呼んだときに読む） */
const current = () => normalizeIlSettings(store.settings.modes[MODE_ID]);

export const imagelinkMode: QuizMode<IlSettings> = {
  id: MODE_ID,
  title: 'イメージリンク',
  hero: 'See the\n*core image*',
  tagline: 'コアイメージで、語と文法をつなぐ。',
  patterns: METHODS.map(({ id, label, desc }) => ({ id, label, desc })),
  timing: { advanceOkSec: 5, advanceNgSec: 10, answerSec: 15 },
  srs: IL_SRS,
  normalizeSettings: normalizeIlSettings,
  async load(s) {
    const ix = await loadIndex().catch(() => null);
    if (!ix) return;
    const parts = new Set(neededParts(s ?? current(), ix.chapters));
    // 復習リスト・苦手の問題は、出題範囲の外でも表示・出題できるように読む
    if (store.settings.activeMode === MODE_ID) {
      for (const key of Object.keys(store.progress.review)) {
        const p = partOfChapter(parseKey(key)?.chapter ?? 0);
        if (p) parts.add(p);
      }
    }
    await loadParts(parts);
  },
  ready() {
    const ix = il.index;
    if (!ix) return false;
    const loaded = il.parts;
    return neededParts(current(), ix.chapters).every((p) => loaded.has(p));
  },
  candidates(s) {
    if (!il.index) return [];
    // 文字入力を「出さない」設定なら、入力が必須の練習問題（short）を外す
    const qs = loadedQuestions(neededParts(s, il.index.chapters));
    return ilCandidates(store.settings.typing === 'skip' ? qs.filter((q) => !(q.type === 'exercise' && q.answer_mode === 'short')) : qs, s);
  },
  pick: (input, s) => ilPick(input, s),
  question(key, rng) {
    const k = parseKey(key);
    const raw = k && questionById(k.id);
    return raw ? buildQuestion(raw, rng) : null;
  },
  sessionCount,
  label(key) {
    void il.parts; // 部を読み込んだら表示し直す
    const k = parseKey(key);
    const r = k && questionById(k.id);
    if (!r) return null;
    const en = r.prompt_en ?? (r.type === 'ja2en' ? r.answer : undefined);
    const title = r.type === 'flashcard' || r.type === 'exercise' || r.type === 'table' || r.type.startsWith('fig') || r.type === 'core_image' || r.type === 'prep_icon' ? r.question : (en ?? r.prompt_ja ?? r.question);
    const ans = r.answer_figure ? '（図を選ぶ問題）' : (r.answer ?? '');
    return { title, sub: `第${r.chapter}章 · ${r.type === 'ja2en' || r.type === 'order' || r.type === 'translate' ? (r.prompt_ja ?? '') : ans}`.slice(0, 120), latin: !!en && title === en, tag: TYPE_LABELS[r.type] };
  },
  detailRoute: (key) => ({ name: 'imagelink/question', params: { key } }),
  summary(s) {
    const m = METHODS.find((x) => x.id === s.method)!;
    const parts: string[] = [m.label];
    if (s.method === 'chapter') parts.push(`第${s.chapter}章`);
    else {
      if (s.method === 'total') parts.splice(0, 1, `総合 ${s.totalCount}問`);
      if (s.parts.length && s.parts.length < 4) parts.push(`第${s.parts.join('・')}部`);
      if (s.chapters.length) parts.push(`${s.chapters.length}章`);
    }
    const filters = s.types.length + s.diffs.length + s.tags.length;
    if (filters) parts.push('絞り込み中');
    return parts.join(' · ');
  },
  stat: () => (il.index ? `${il.index.chapters.length}章 · ${il.index.chapters.reduce((n, c) => n + c.question_count, 0).toLocaleString()}問` : ''),
  Prompt,
  Explain,
  Interact,
  reportable: true,
  SettingsSection,
  StatsSection,
  browse: { route: { name: 'imagelink/chapters' }, label: '章と達成度' },
  screens: {
    'imagelink/chapters': Chapters,
    'imagelink/chapter-filter': ChapterFilter,
    'imagelink/question': QuestionView,
  },
};

