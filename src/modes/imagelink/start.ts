// 章のミニテストを始める（章と達成度・学習記録から）
import { router } from '../../core/router.svelte.ts';
import { haptic } from '../../core/haptics.ts';

export function startChapter(no: number) {
  haptic('light');
  router.push({ name: 'quiz', params: { seed: Date.now(), kind: 'normal', override: { method: 'chapter', chapter: no } } }, 'modal');
}
