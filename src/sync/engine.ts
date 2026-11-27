// 同期の手順（通信の部分は Remote に任せる。tests/sync.test.ts ではメモリの Remote で試す）。
//   1. 置き場の目次（meta: 保存キーごとの中身の印 h・書いた時刻 at・分けた数 n）を読む
//   2. 保存キーごとに、この端末と置き場の中身が違えば置き場の中身を読んでまとめ（merge.ts）、この端末に書く
//   3. まとめた中身が置き場と違えば置き場に書き、目次を更新する（目次は版 ver で守り、ほかの端末と同時なら最初からやり直す）
import { mergeKey } from './merge.ts';

export interface MetaEntry {
  /** 中身の印（hashText） */
  h: string;
  /** 最後に書き換えた時刻（どちらが新しいかの目安） */
  at: number;
  /** 中身を分けた数 */
  n: number;
}
export interface Meta {
  ver: number;
  keys: Record<string, MetaEntry>;
}
export interface Remote {
  getMeta(): Promise<Meta | null>;
  getBlob(key: string, e: MetaEntry): Promise<string>;
  /** 中身を置く（同じ印の中身は同じなので、何度置いてもよい）。分けた数を返す */
  putBlob(key: string, h: string, text: string): Promise<number>;
  /** 目次を書く。expectVer と置き場の版が違えば書かずに false */
  commitMeta(expectVer: number, meta: Meta): Promise<boolean>;
  /** 使わなくなった中身を消す（できなくてもよい） */
  dropBlob?(key: string, e: MetaEntry): Promise<void>;
}
export interface Local {
  keys(): string[];
  /** 中身（JSON 文字列）。書き換えたことがあって消えているなら "null"、触れたことがなければ null */
  get(key: string): string | null;
  set(key: string, text: string, at: number): void;
  at(key: string): number;
}

/** キーを並べ替えた JSON（どちらの端末でまとめても同じ文字列になるように） */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x,
  );
}

/** 文字列の印（cyrb53 を2つ。速く、同期の比較には十分） */
export function hashText(s: string): string {
  const h = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  };
  return h(1) + h(7) + s.length.toString(36);
}

export interface SyncResult {
  /** この端末に取り込んで書き換えた保存キー */
  pulled: string[];
  /** 置き場に書いた保存キー */
  pushed: string[];
}

export async function syncOnce(remote: Remote, local: Local, now = Date.now(), tries = 3): Promise<SyncResult> {
  for (let t = 0; t < tries; t++) {
    const meta = (await remote.getMeta()) ?? { ver: 0, keys: {} };
    const pulled: string[] = [], pushed: string[] = [];
    const next: Record<string, MetaEntry> = { ...meta.keys };
    const dropped: [string, MetaEntry][] = [];
    for (const key of new Set([...local.keys(), ...Object.keys(meta.keys)])) {
      const lt = local.get(key);
      const rm = meta.keys[key];
      const lh = lt === null ? null : hashText(lt);
      if (rm && lh === rm.h) continue; // 同じ
      let merged = lt;
      let at = local.at(key);
      if (rm) {
        const rt = await remote.getBlob(key, rm);
        if (lt === null) merged = rt;
        else merged = canonical(mergeKey(key, JSON.parse(lt), JSON.parse(rt), local.at(key) >= rm.at));
        at = Math.max(at, rm.at);
        if (merged !== lt) {
          local.set(key, merged, at);
          pulled.push(key);
        }
      }
      if (merged === null) continue;
      const mh = hashText(merged);
      if (rm && mh === rm.h) continue;
      const n = await remote.putBlob(key, mh, merged);
      next[key] = { h: mh, at: Math.max(at, rm ? now : at), n };
      if (rm) dropped.push([key, rm]);
      pushed.push(key);
    }
    if (!pushed.length) return { pulled, pushed };
    if (await remote.commitMeta(meta.ver, { ver: meta.ver + 1, keys: next })) {
      for (const [k, e] of dropped) await remote.dropBlob?.(k, e).catch(() => {});
      return { pulled, pushed };
    }
    // ほかの端末が同時に書いた: 読み直してやり直す（ここまでにこの端末へ取り込んだ分はそのまま。まとめは何度しても同じ）
  }
  throw new Error('同期がほかの端末と重なりました。少しあとでもう一度試してください');
}
