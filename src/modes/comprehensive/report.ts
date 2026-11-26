// 学習レポートの文章（ChatGPT に貼り付ける用）
import { store } from '../../core/store.svelte.ts';
import { streak, dayKey } from '../../core/day.ts';
import type { CompIndex } from './course.ts';
import { masteryOf, MASTERIES, MASTERY_LABEL, STAGE_LABEL, AFTER_COURSE, type Stage } from './course.ts';
import { scoreDiag, DOMAIN_LABEL } from './diag.ts';
import { extra } from './state.svelte.ts';
import { todayCourseDay } from './mode.ts';

export function buildReport(ix: CompIndex): string {
  const ex = extra();
  const p = store.progress;
  const day = todayCourseDay();
  const lines: string[] = [];
  lines.push('【EIGO LOOP 総合英語・留学準備 学習レポート】');
  lines.push(`目的: ニュージーランドへの語学留学に向けて、60日で基礎英語・日常会話・大学生活の英語を身につける（現在 TOEIC 300点台程度の初学者）`);
  lines.push(`日程: ${day >= AFTER_COURSE ? '60日を修了（復習中）' : `Day ${day} / 60（${ix.day.get(day)?.topic ?? ''}）`}`);
  lines.push(`連続学習: ${streak(p.days, store.today)}日 / 今日の回答: ${p.days[dayKey(store.today)]?.a ?? 0}`);
  const c: Record<string, number> = {};
  for (const it of ix.d.items) {
    const m = masteryOf(p.items[it.id], ex.ev?.[it.id]);
    c[m] = (c[m] ?? 0) + 1;
  }
  lines.push(`語彙の習熟度（${ix.d.items.length}項目）: ` + MASTERIES.map((m) => `${MASTERY_LABEL[m]} ${c[m] ?? 0}`).join(' / '));
  const st = Object.entries(p.tags)
    .filter(([t, v]) => t.startsWith('st:') && v.seen >= 3)
    .map(([t, v]) => ({ s: t.slice(3) as Stage, r: v.correct / v.seen, n: v.seen }))
    .sort((a, b) => a.r - b.r);
  if (st.length) lines.push('段階ごとの正答率（低い順）: ' + st.map((x) => `${STAGE_LABEL[x.s]} ${Math.round(x.r * 100)}%（${x.n}問）`).join('、'));
  const weak = Object.entries(p.items)
    .filter(([, s]) => !s.lastOk)
    .sort(([, a], [, b]) => b.last - a.last)
    .slice(0, 15)
    .map(([k]) => ix.item.get(k)?.english ?? ix.q.get(k)?.acceptedAnswers[0])
    .filter(Boolean);
  if (weak.length) lines.push('最近まちがえた語・表現: ' + weak.join(', '));
  for (const form of ['baseline', 'final'] as const) {
    const ds = ex.diag?.[form];
    const f = ix.d.diagnostics.find((x) => x.id === form);
    if (!ds?.finishedAt || !f) continue;
    const sc = scoreDiag(f, ds);
    lines.push(`${form === 'baseline' ? 'Day0' : 'Day60'} 診断（分野ごと・TOEIC換算なし）: ` + sc.map((x) => `${DOMAIN_LABEL[x.domain]} ${x.rate === null ? '—' : Math.round(x.rate * 100) + '%'}`).join('、'));
  }
  const tags = p.tags;
  if (tags.self) lines.push(`自己採点した回答: ${tags.self.seen}（自動の採点とは別）`);
  if (ex.audioNA) lines.push(`音声が使えなかった問題: ${ex.audioNA}（聞き取りとしては未記録）`);
  lines.push('');
  lines.push('お願い: 上の苦手な段階と最近まちがえた表現を使って、ニュージーランドの大学生活・ホームステイの場面で、短い英会話の練習相手と、英作文の添削をしてください。私の英語のレベルに合わせて、簡単な英語で始めてください。');
  return lines.join('\n');
}
