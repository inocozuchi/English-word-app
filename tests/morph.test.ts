// 語源英単語: 語の成り立ち（接頭辞・語根・接尾辞）の分け方
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classify, segments, SUFFIXES } from '../src/modes/etymology/morph.ts';

const R = (spellings: string, isPrefix = false) => ({ spellings: spellings.split(/\s*\/\s*/), isPrefix });
const kinds = (m: { kind: string }[]) => m.map((p) => p.kind).join('-');

describe('接頭辞・語根・接尾辞に分ける', () => {
  it('接頭辞 + 語根', () => {
    const m = classify('involve', [{ part: 'in', meaning: '中に' }, { part: 'volve', meaning: '回る' }], R('volve'));
    expect(kinds(m)).toBe('pre-root');
  });
  it('接頭辞 + 語根 + 接尾辞。意味のない接尾辞には働きを補う', () => {
    const m = classify('advertise', [{ part: 'ad', meaning: '〜に' }, { part: 'vert', meaning: '向ける' }, { part: 'ise', meaning: '' }], R('verse'));
    expect(kinds(m)).toBe('pre-root-suf');
    expect(m[2]).toMatchObject({ meaning: SUFFIXES.ise, added: true });
  });
  it('語源そのものが接頭辞（trans）のときは、もう1つのパーツが語根', () => {
    const m = classify('transport', [{ part: 'trans', meaning: '越えて' }, { part: 'port', meaning: '運ぶ' }], R('trans', true));
    expect(kinds(m)).toBe('pre-root');
  });
  it('知らない接頭辞も「=ex 外に」のような注記や意味から分かる', () => {
    expect(kinds(classify('sport', [{ part: 's', meaning: '=dis 離れて' }, { part: 'port', meaning: '運ぶ' }], R('port')))).toBe('pre-root');
    expect(kinds(classify('entertain', [{ part: 'enter', meaning: '…の間に' }, { part: 'tain', meaning: '保つ' }], R('tain')))).toBe('pre-root');
  });
  it('意味の空の語尾は接尾辞、2つの語根（複合語）はどちらも語根、間の1文字はつなぎ', () => {
    expect(kinds(classify('volume', [{ part: 'vol', meaning: '巻く' }, { part: 'ume', meaning: '' }], R('volve')))).toBe('root-suf');
    expect(kinds(classify('geography', [{ part: 'geo', meaning: '土地' }, { part: 'graphy', meaning: '書くこと' }], R('geo')))).toBe('root-root');
    expect(kinds(classify('pesticide', [{ part: 'pest', meaning: '害虫' }, { part: 'i', meaning: '' }, { part: 'cide', meaning: '殺す' }], R('cide')))).toBe('root-link-root');
  });
  it('パーツに書かれていない語末の接尾辞を足す', () => {
    const m = classify('alternative', [{ part: 'alter', meaning: '他の' }, { part: 'na', meaning: '' }], R('alter'));
    expect(m[m.length - 1]).toMatchObject({ part: 'tive', kind: 'suf', added: true });
  });
  it('綴りの色分け（語末の e などは直前に含める・合わなければ null）', () => {
    const m = classify('society', [{ part: 'soci', meaning: '仲間' }, { part: 'ety', meaning: '' }], R('soci'));
    expect(segments('society', m)?.map((s) => s.text)).toEqual(['soci', 'ety']);
    expect(segments('execute', classify('execute', [{ part: 'ex', meaning: '外へ' }, { part: '(s)ecute', meaning: '続く' }], R('sequ')))?.map((s) => s.text)).toEqual(['ex', 'ecute']);
    expect(segments('abc', [{ part: 'zz', meaning: '', kind: 'root' }])).toBeNull();
  });
});

describe('全データ', () => {
  const d = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'etymology_words.json'), 'utf8'));
  const all: { word: string; m: ReturnType<typeof classify> }[] = [];
  for (const r of d.roots)
    for (const w of r.words)
      if (w.breakdown?.length) all.push({ word: w.word, m: classify(w.word, w.breakdown, R(r.root || r.id, r.category === '接頭辞')) });
  it('どの単語にも語根が1つ以上ある', () => {
    expect(all.filter((x) => !x.m.some((p) => p.kind === 'root')).map((x) => x.word)).toEqual([]);
  });
  it('接頭辞は語根より前、接尾辞は語根より後', () => {
    for (const x of all) {
      const first = x.m.findIndex((p) => p.kind === 'root');
      const last = x.m.map((p) => p.kind).lastIndexOf('root');
      x.m.forEach((p, i) => {
        if (p.kind === 'pre') expect(i, x.word).toBeLessThan(first);
        if (p.kind === 'suf') expect(i, x.word).toBeGreaterThan(last);
      });
    }
  });
  it('接尾辞には意味がある（データか、補った働き）', () => {
    expect(all.flatMap((x) => x.m.filter((p) => p.kind === 'suf' && !p.meaning).map(() => x.word))).toEqual([]);
  });
  it('9割5分以上の単語で綴りを色分けできる', () => {
    const ok = all.filter((x) => segments(x.word, x.m)).length;
    expect(ok / all.length).toBeGreaterThan(0.95);
  });
});
