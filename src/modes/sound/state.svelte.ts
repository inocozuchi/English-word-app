// 音声変化モードのデータ（読み込み後にリアクティブに参照できるように）
import type { SoundData, RuleId } from './types.ts';
import type { SoundIndex } from './quiz.ts';
import { buildSoundIndex } from './quiz.ts';

class SoundState {
  index = $state.raw<SoundIndex | null>(null);
}
export const snd = new SoundState();

/** "#RRGGBB" を白と混ぜて明るくする（ダークモード用） */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** ルールの色を CSS 変数に（--rule-<id>-lt / -dk。使うときは --rule-<id>。rules.css 参照） */
function applyRuleColors(d: SoundData) {
  const root = document.documentElement.style;
  for (const r of d.rules) {
    root.setProperty(`--rule-${r.id}-lt`, r.color);
    root.setProperty(`--rule-${r.id}-dk`, lighten(r.color, 0.38));
  }
}

let loading: Promise<SoundIndex> | null = null;
export function loadSound(): Promise<SoundIndex> {
  return (loading ??= import('../../generated/sound.json').then((m) => {
    const d = m.default as unknown as SoundData;
    if (typeof document !== 'undefined') applyRuleColors(d);
    const ix = buildSoundIndex(d);
    snd.index = ix;
    return ix;
  }));
}

/** ルールの色（CSS 変数。テーマで明るさが変わる） */
export const ruleColor = (id: RuleId | string) => `var(--rule-${id})`;
