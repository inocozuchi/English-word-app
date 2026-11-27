// 同期の置き場（Cloud Firestore）。必要になったときだけ読み込む（別チャンク）。
// 置き場: eigo/{コードの SHA-256} に目次 { ver, keys }、eigo/{…}/c/{保存キー~印~番号} に中身（gzip した Bytes。700KB ごとに分ける）
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, runTransaction, Bytes } from 'firebase/firestore/lite';
import type { Remote, Meta, MetaEntry } from './engine.ts';

const COL = 'eigo';
const CHUNK = 700_000;
const enc = (key: string) => key.replace(/\./g, '_');
const dec = (k: string) => k.replace(/_/g, '.');

async function gzip(text: string): Promise<{ d: Uint8Array; z: boolean }> {
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'function') return { d: raw, z: false };
  const out = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { d: new Uint8Array(out), z: true };
}
async function gunzip(d: Uint8Array, z: boolean): Promise<string> {
  if (!z) return new TextDecoder().decode(d);
  const out = await new Response(new Blob([d as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new TextDecoder().decode(out);
}

function app(config: Record<string, string>): FirebaseApp {
  const name = 'eigo-' + (config.projectId ?? 'x');
  return getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(config, name);
}

export function firebaseRemote(config: Record<string, string>, hid: string, emulator?: { host: string; port: number }): Remote {
  const db = getFirestore(app(config));
  if (emulator) connectFirestoreEmulator(db, emulator.host, emulator.port);
  const metaRef = doc(db, COL, hid);
  const chunkRef = (key: string, h: string, i: number) => doc(db, COL, hid, 'c', `${enc(key)}~${h}~${i}`);
  const toMeta = (data: any): Meta => {
    const keys: Record<string, MetaEntry> = {};
    for (const [k, e] of Object.entries<any>(data?.keys ?? {})) keys[dec(k)] = { h: e.h, at: e.at, n: e.n };
    return { ver: data?.ver ?? 0, keys };
  };
  return {
    async getMeta() {
      const s = await getDoc(metaRef);
      return s.exists() ? toMeta(s.data()) : null;
    },
    async getBlob(key, e) {
      const parts = await Promise.all(Array.from({ length: e.n }, (_, i) => getDoc(chunkRef(key, e.h, i))));
      if (parts.some((p) => !p.exists())) throw new Error('同期の中身が見つかりません（ほかの端末が書いている途中かもしれません）');
      const bytes = parts.map((p) => (p.data()!.d as Bytes).toUint8Array());
      const all = new Uint8Array(bytes.reduce((n, b) => n + b.length, 0));
      let o = 0;
      for (const b of bytes) all.set(b, (o += b.length) - b.length);
      return gunzip(all, !!parts[0].data()!.z);
    },
    async putBlob(key, h, text) {
      const { d, z } = await gzip(text);
      const n = Math.max(1, Math.ceil(d.length / CHUNK));
      await Promise.all(Array.from({ length: n }, (_, i) => setDoc(chunkRef(key, h, i), { d: Bytes.fromUint8Array(d.subarray(i * CHUNK, (i + 1) * CHUNK)), z })));
      return n;
    },
    async commitMeta(expectVer, meta) {
      const keys: Record<string, MetaEntry> = {};
      for (const [k, e] of Object.entries(meta.keys)) keys[enc(k)] = e;
      return runTransaction(db, async (tx) => {
        const s = await tx.get(metaRef);
        if ((s.exists() ? (s.data().ver ?? 0) : 0) !== expectVer) return false;
        tx.set(metaRef, { ver: meta.ver, keys, at: Date.now() });
        return true;
      });
    },
    async dropBlob(key, e) {
      await Promise.all(Array.from({ length: e.n }, (_, i) => deleteDoc(chunkRef(key, e.h, i))));
    },
  };
}
