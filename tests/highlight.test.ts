import { describe, it, expect } from 'vitest';
import { splitHighlight, inflections } from '../src/lib/highlight.ts';

const hits = (text: string, w: string) => splitHighlight(text, w).filter((s) => s.hit).map((s) => s.t);

describe('splitHighlight', () => {
  it('活用形を強調する', () => {
    expect(hits('The job involves a lot of travel.', 'involve')).toEqual(['involves']);
    expect(hits('She was involved in it.', 'involve')).toEqual(['involved']);
    expect(hits('He is studying hard and studied a lot.', 'study')).toEqual(['studying', 'studied']);
    expect(hits('The bus stopped.', 'stop')).toEqual(['stopped']);
    expect(hits('Report it. Reporting is fun.', 'report')).toEqual(['Report', 'Reporting']);
  });
  it('別の単語の一部は強調しない', () => {
    expect(hits('She is curious about the cure.', 'cure')).toEqual(['cure']);
    expect(hits('The current is strong.', 'cur')).toEqual([]);
    expect(hits('He was secure.', 'cure')).toEqual([]);
  });
  it('元の文字列を失わない', () => {
    const t = 'The earth revolves around the sun.';
    expect(splitHighlight(t, 'revolve').map((s) => s.t).join('')).toBe(t);
  });
  it('熟語はそのまま照合する', () => {
    expect(hits('She is involved in volunteer work.', 'involved in')).toEqual(['involved in']);
  });
  it('e で終わる語の ing 形', () => {
    expect(inflections('make')).toContain('making');
  });
});
