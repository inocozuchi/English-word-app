// 総合英語・留学準備モード（60日）。教材は comprehensive/（README・implementation_prompt.md が仕様）。
// ホームの1ボタンで「今日の学習」を自動で進める（専用の学習画面 screens/Session.svelte）。
// 辞典・お気に入り・弱点・ロードマップ・診断・学習レポートは副導線（screens/Hub.svelte から）。
import type { QuizMode } from '../../core/mode.ts';
import type { CompSettings } from './settings.ts';
import { normalizeCompSettings } from './settings.ts';
import { MODE_ID, COMP_SRS, STAGE_LABEL, AFTER_COURSE, INITIAL_DAY, courseDayFor } from './course.ts';
import { comp, loadComp, hasTodaySession, extra } from './state.svelte.ts';
import { store } from '../../core/store.svelte.ts';
import Prompt from './components/Prompt.svelte';
import SettingsSection from './SettingsSection.svelte';
import StatsSection from './StatsSection.svelte';
import Session from './screens/Session.svelte';
import Hub from './screens/Hub.svelte';
import Dict from './screens/Dict.svelte';
import Entry from './screens/Entry.svelte';
import Roadmap from './screens/Roadmap.svelte';
import Weak from './screens/Weak.svelte';
import Diag from './screens/Diag.svelte';
import Report from './screens/Report.svelte';
import { dayNumber } from '../../core/day.ts';

/** 今日の日程（表示用。進めるのは学習を始めたとき） */
export function todayCourseDay(): number {
  return courseDayFor(extra().cd ?? INITIAL_DAY, dayNumber(Date.now())).day;
}

export const compMode: QuizMode<CompSettings> = {
  id: MODE_ID,
  title: '総合英語・留学準備',
  hero: '60 days\nto *NZ*',
  tagline: '聞いて、思い出して、使える英語へ。',
  patterns: [],
  timing: { advanceOkSec: 2, advanceNgSec: 2, answerSec: 20 },
  srs: COMP_SRS,
  hideTiming: true,
  hideCount: true,
  normalizeSettings: normalizeCompSettings,
  load: () => loadComp().then(() => {}),
  ready: () => !!comp.index,
  candidates() {
    // ホームの「期限の来た問題」を数えるための記録の単位（項目と、項目のない問題）
    const ix = comp.index;
    if (!ix) return [];
    return [...ix.d.items.map((i) => i.id), ...ix.d.questions.filter((q) => !q.itemIds.length).map((q) => q.id)].map((key, n) => ({ key, base: key, group: key, newOrder: n }));
  },
  question: () => null,
  quizRoute: (kind) => ({ name: 'comp/session', params: { kind } }),
  startLabel: () => (hasTodaySession() ? '続きから再開する' : '今日の学習を始める'),
  label(key) {
    const ix = comp.index;
    if (!ix) return null;
    const it = ix.item.get(key);
    if (it) return { title: it.english, sub: it.japanese, latin: true, tag: STAGE_LABEL[it.kind] };
    const q = ix.q.get(key);
    return q ? { title: q.prompt.split('\n').at(-1)!.slice(0, 60), sub: q.acceptedAnswers[0], tag: `Day ${q.day}` } : null;
  },
  detailRoute: (key) => ({ name: 'comp/entry', params: { id: key } }),
  summary(s) {
    void store.today;
    const d = todayCourseDay();
    const info = comp.index?.day.get(d);
    if (d >= AFTER_COURSE) return `60日を修了 · 復習 · ${s.minutes}分`;
    return `Day ${d}${info ? ` · ${info.topic}` : ''} · ${s.minutes}分`;
  },
  backdrop: () => (comp.index?.d.items ?? []).filter((it) => it.english.length <= 22).map((it) => ({ t: it.english, id: it.id })),
  stat: () => (comp.index ? `60日 · ${comp.index.d.counts.items.toLocaleString()}項目 · ${comp.index.d.counts.practiceQuestions.toLocaleString()}問` : ''),
  Prompt,
  SettingsSection,
  StatsSection,
  browse: { route: { name: 'comp/hub' }, label: '教材と記録' },
  screens: {
    'comp/session': Session,
    'comp/hub': Hub,
    'comp/dict': Dict,
    'comp/entry': Entry,
    'comp/roadmap': Roadmap,
    'comp/weak': Weak,
    'comp/diag': Diag,
    'comp/report': Report,
  },
};
