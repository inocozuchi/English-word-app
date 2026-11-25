import { describe, it, expect } from 'vitest';
import { parseKana, isValidKana } from '../src/lib/kana.ts';

describe('parseKana', () => {
  it('^ で囲んだ部分を強勢として分ける', () => {
    expect(parseKana('^リ^ター')).toEqual([{ label: null, parts: ['', 'リ', 'ター'] }]);
    expect(parseKana('イン^ヴォ^ルヴ')).toEqual([{ label: null, parts: ['イン', 'ヴォ', 'ルヴ'] }]);
  });
  it('品詞ごとの読みを分ける', () => {
    const v = parseKana('^プロ^グレス（名）／プロ^グレ^ス（動）');
    expect(v).toEqual([
      { label: '名', parts: ['', 'プロ', 'グレス'] },
      { label: '動', parts: ['プロ', 'グレ', 'ス'] },
    ]);
  });
  it('末尾が強勢でも空要素を残さない', () => {
    expect(parseKana('ア^セ^ス')[0].parts).toEqual(['ア', 'セ', 'ス']);
    expect(parseKana('リ^ポー^')[0].parts).toEqual(['リ', 'ポー']);
  });
  it('対になっていない ^ を検出する', () => {
    expect(isValidKana('^リ^ター')).toBe(true);
    expect(isValidKana('^リター')).toBe(false);
  });
});
