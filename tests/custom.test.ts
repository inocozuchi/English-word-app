import { describe, it, expect } from 'vitest';
import { normalizeCustomSettings, parseBulk, customCandidates, customQuestion, normWord, newId, type CWord } from '../src/modes/custom/quiz.ts';
import { createRng } from '../src/core/rng.ts';

const W = (id: string, en: string, ja: string, added = 0): CWord => ({ id, en, ja, added });
const words = [W('a', 'apple', 'りんご', 1), W('b', 'banana', 'バナナ', 2), W('c', 'cherry', 'さくらんぼ', 3), W('d', 'grape', 'ぶどう', 4), W('e', 'melon', 'メロン', 5)];

describe('自由英単語', () => {
  it('設定の正規化（不正な語・重複IDを落とす・パターンの初期値）', () => {
    const s = normalizeCustomSettings({ words: [W('a', ' apple ', 'りんご'), W('a', 'x', 'y'), { id: 'z', en: '', ja: 'y' }, null], patterns: ['sp', 'xx'] });
    expect(s.words).toEqual([{ id: 'a', en: 'apple', ja: 'りんご', added: 0 }]);
    expect(s.patterns).toEqual(['sp']);
    expect(normalizeCustomSettings(undefined)).toEqual({ words: [], patterns: ['ej', 'je'] });
  });
  it('照合用の正規化', () => {
    expect(normWord('  Take  Off. ')).toBe('take off');
    expect(normWord('ＡＢＣ')).toBe('abc');
  });
  it('まとめて追加の読み取り', () => {
    const r = parseBulk('deadline, 締め切り\nsubmit\t提出する\ntake notes - メモを取る\n\nりんご\nfoo：ふー');
    expect(r.words).toEqual([
      { en: 'deadline', ja: '締め切り' },
      { en: 'submit', ja: '提出する' },
      { en: 'take notes', ja: 'メモを取る' },
      { en: 'foo', ja: 'ふー' },
    ]);
    expect(r.bad).toEqual(['りんご']);
  });
  it('候補: 4語未満は4択を出さない・つづりは入力を出さない設定で外す', () => {
    const s = { words: words.slice(0, 3), patterns: ['ej', 'je', 'sp'] as const };
    expect(customCandidates({ ...s, patterns: [...s.patterns] }, 'on').map((c) => c.key)).toEqual(['sp:c', 'sp:b', 'sp:a']);
    const all = customCandidates({ words, patterns: ['ej', 'je', 'sp'] }, 'skip');
    expect(all.every((c) => !c.key.startsWith('sp:'))).toBe(true);
    expect(all[0].key).toBe('ej:e'); // 新しい語から
    expect(all.find((c) => c.key === 'je:e')?.requires).toBe('ej:e');
  });
  it('問題: 選択肢は重複なく正解を含む', () => {
    for (let i = 0; i < 50; i++) {
      for (const p of ['ej', 'je']) {
        const q = customQuestion(words, `${p}:c`, createRng(i))!;
        expect(new Set(q.choices.map((c) => c.text)).size).toBe(4);
        expect(q.choices[q.answer].text).toBe(p === 'ej' ? 'さくらんぼ' : 'cherry');
        expect(q.key).toBe(`${p}:c`);
      }
    }
    const sp = customQuestion(words, 'sp:a', createRng(1))!;
    expect(sp.interactive).toBe(true);
    expect(customQuestion(words.slice(0, 3), 'ej:a', createRng(1))).toBeNull();
    expect(customQuestion(words, 'ej:none', createRng(1))).toBeNull();
  });
  it('同じ意味の語は誤答にしない', () => {
    const ws = [...words, W('f', 'APPLE', 'りんご（大文字）')];
    for (let i = 0; i < 30; i++) {
      const q = customQuestion(ws, 'je:a', createRng(i))!;
      expect(q.choices.filter((c) => normWord(c.text) === 'apple').length).toBe(1);
    }
  });
  it('ID は重ならない', () => {
    expect(newId(1, 0.1)).not.toBe(newId(1, 0.2));
  });
});
