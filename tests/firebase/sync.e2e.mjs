// Firestore エミュレーターで、本物の置き場（src/sync/firebase.ts）と決まり（firestore.rules）を試す。
// 使い方: cd tests/firebase && npm i && npm test   （Java が必要）
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc, Bytes } from 'firebase/firestore';
import { firebaseRemote } from '../../src/sync/firebase.ts';
import { syncOnce } from '../../src/sync/engine.ts';

let failed = 0;
const ok = (c, m) => (console.log(`${c ? '✓' : '✗'} ${m}`), c || failed++);
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8086').split(':');
const EMU = { host, port: +port };
const CONFIG = { apiKey: 'demo', projectId: 'demo-eigo', appId: 'demo' };
const HID = 'a'.repeat(64);

function memLocal(init = {}) {
  const data = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  const at = new Map([...data.keys()].map((k) => [k, 1000]));
  return {
    keys: () => [...data.keys()],
    get: (k) => data.get(k) ?? null,
    set: (k, t, a) => (data.set(k, t), at.set(k, a)),
    at: (k) => at.get(k) ?? 0,
    val: (k) => JSON.parse(data.get(k) ?? 'null'),
  };
}
const st = (last) => ({ box: 1, due: 0, seen: 1, correct: 1, wrong: 0, last, lastOk: true });
const P = 'eq.progress.etymology.v1';
const prog = (items) => ({ items, days: {}, lastBase: null, review: {}, tags: {} });

// ---- 本物の置き場で2台を同期 ----
{
  const remote = firebaseRemote(CONFIG, HID, EMU);
  const big = {};
  for (let i = 0; i < 12000; i++) big['c1:q' + i] = st(i); // イメージリンクを全部解いたくらいの大きさ
  const a = memLocal({ [P]: prog({ x: st(100) }), 'eq.progress.imagelink.v1': prog(big), 'eq.settings.v2': { count: 10, theme: 'dark', modes: {} } });
  const b = memLocal({ [P]: prog({ y: st(200) }), 'eq.settings.v2': { count: 20, theme: 'light', modes: {} } });
  const r1 = await syncOnce(remote, a);
  ok(r1.pushed.length === 3, `1台目の記録を置き場に置く（${r1.pushed.join(', ')}）`);
  const r2 = await syncOnce(firebaseRemote(CONFIG, HID, EMU), b);
  ok(Object.keys(b.val(P).items).sort().join() === 'x,y', '2台目は両方の記録になる');
  ok(Object.keys(b.val('eq.progress.imagelink.v1').items).length === 12000, '大きな記録（12,000問）も読める');
  ok(b.val('eq.settings.v2').theme === 'light', 'テーマはこの端末のまま');
  ok(r2.pushed.includes(P), `まとめた記録を置き場に戻す（${r2.pushed.join(', ')}）`);
  await syncOnce(remote, a);
  ok(Object.keys(a.val(P).items).sort().join() === 'x,y', '1台目にも2台目の記録が届く');
  const r3 = await syncOnce(remote, a);
  ok(r3.pushed.length === 0 && r3.pulled.length === 0, '変わっていなければ何も書かない');
}

// ---- 決まり（firestore.rules）----
{
  const env = await initializeTestEnvironment({ projectId: 'demo-eigo', firestore: { host, port: +port, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'eigo', HID)));
  await assertFails(getDocs(collection(db, 'eigo'))).then(() => ok(true, '一覧は読めない（ほかの人の置き場を探せない）'), () => ok(false, '一覧は読めない'));
  await assertFails(getDoc(doc(db, 'eigo', 'short'))).then(() => ok(true, '形の違う場所は読めない'), () => ok(false, '形の違う場所は読めない'));
  await assertFails(setDoc(doc(db, 'eigo', HID), { ver: 999, keys: {}, at: 1 })).then(() => ok(true, '版を飛ばした目次は書けない'), () => ok(false, '版を飛ばした目次は書けない'));
  await assertFails(setDoc(doc(db, 'eigo', HID), { ver: 2, keys: {}, at: 1, evil: true })).then(() => ok(true, '余分な項目は書けない'), () => ok(false, '余分な項目は書けない'));
  await assertFails(deleteDoc(doc(db, 'eigo', HID))).then(() => ok(true, '目次は消せない'), () => ok(false, '目次は消せない'));
  await assertFails(setDoc(doc(db, 'eigo', HID, 'c', 'x'), { d: 'text', z: false })).then(() => ok(true, '中身は bytes だけ'), () => ok(false, '中身は bytes だけ'));
  await assertFails(setDoc(doc(db, 'other', 'x'), { a: 1 })).then(() => ok(true, 'ほかの場所には書けない'), () => ok(false, 'ほかの場所には書けない'));
  await assertSucceeds(setDoc(doc(db, 'eigo', HID, 'c', 'y'), { d: Bytes.fromUint8Array(new Uint8Array(10)), z: true })).then(() => ok(true, '中身は書ける'), () => ok(false, '中身は書ける'));
  await env.cleanup();
}
console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
