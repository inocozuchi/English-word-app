// 複数の端末で記録を同期する（Cloud Firestore。設定したときだけ）。
//   ・1台目で「同期を始める」→ 同期コード（20文字）ができる。ほかの端末でそのコードを入れると同じ記録になる。
//   ・置き場の場所はコードの SHA-256（コードそのものは送らない）。コードを知っている端末だけが読み書きできる。
//   ・起動したとき・アプリに戻ったとき・答えてから少したったとき・離れるとき・5分ごと（見ている間）に同期する。
//     クイズ・学習の途中（modal）は同期せず、終わってから。通信できなければ何もしない（この端末だけで動き続ける）。
import { router } from '../core/router.svelte.ts';
import { store } from '../core/store.svelte.ts';
import { loadSettings, loadProgress } from '../core/storage.ts';
import { FIREBASE_CONFIG } from './config.ts';
import { syncOnce, type Local, type Remote } from './engine.ts';
import { isSyncKey, localAt, setLocalAt, onTouched, emitPulled } from './touch.ts';

const K = 'eq.sync.v1';
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 見まちがえやすい 0 O 1 I L を除く

interface Saved {
  code: string | null;
  /** 設定画面で貼り付けた接続設定（config.ts が空のとき） */
  config?: Record<string, string> | null;
  lastAt?: number;
}
function readSaved(): Saved {
  try {
    return { code: null, ...(JSON.parse(localStorage.getItem(K) ?? '{}') ?? {}) };
  } catch {
    return { code: null };
  }
}
function writeSaved(s: Saved) {
  try {
    localStorage.setItem(K, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

class SyncState {
  saved = $state<Saved>(readSaved());
  status = $state<'off' | 'idle' | 'syncing' | 'error' | 'offline'>('off');
  error = $state('');
  /** 直前の同期で取り込んだ・送った数 */
  last = $state<{ pulled: number; pushed: number } | null>(null);
  get code() {
    return this.saved.code;
  }
  get config() {
    return FIREBASE_CONFIG ?? this.saved.config ?? null;
  }
}
export const sync = new SyncState();

/** 「ABCDE-FGHJK-…」の形に（入力の空白・ハイフン・小文字は気にしない） */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '');
export const formatCode = (c: string) => c.replace(/(.{5})(?=.)/g, '$1-');
export const isValidCode = (c: string) => c.length === 20 && [...c].every((ch) => ALPHA.includes(ch));
export function newCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(20));
  return [...r].map((x) => ALPHA[x % ALPHA.length]).join('');
}
async function placeOf(code: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('eigo-loop:' + code));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Firebase コンソールの firebaseConfig（JS のオブジェクト）を貼り付けたものを読む */
export function parseConfig(text: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g)) out[m[1]] = m[2];
  return out.apiKey && out.projectId ? out : null;
}

const local: Local = {
  keys() {
    const ks = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (isSyncKey(k)) ks.add(k);
    }
    return [...ks];
  },
  get(k) {
    const v = localStorage.getItem(k);
    return v ?? (localAt(k) > 0 ? 'null' : null);
  },
  set(k, text, at) {
    try {
      if (text === 'null') localStorage.removeItem(k);
      else localStorage.setItem(k, text);
    } catch {
      /* noop */
    }
    setLocalAt(k, at);
  },
  at: localAt,
};

export { onPulled } from './touch.ts';

let remote: Remote | null = null;
let remoteFor = '';
async function getRemote(): Promise<Remote | null> {
  const code = sync.code, config = sync.config;
  if (!code || !config) return null;
  const id = code + JSON.stringify(config);
  if (remote && remoteFor === id) return remote;
  const { firebaseRemote } = await import('./firebase.ts');
  // emulatorHost（試験用: Firestore エミュレーター）があればそこにつなぐ
  const emu = config.emulatorHost?.match(/^([\w.-]+):(\d+)$/);
  remote = firebaseRemote(config, await placeOf(code), emu ? { host: emu[1], port: +emu[2] } : undefined);
  remoteFor = id;
  return remote;
}

let running: Promise<void> | null = null;
let again = false;
/** 同期する（同期中なら終わってからもう一度）。クイズ・学習の途中は終わるまで待つ */
export function syncNow(): Promise<void> {
  if (!sync.code || !sync.config) return Promise.resolve();
  if (router.top.kind === 'modal') {
    pendingAfterModal = true;
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          sync.status = 'offline';
          return;
        }
        sync.status = 'syncing';
        const r = await getRemote();
        if (!r) return;
        const res = await syncOnce(r, local);
        apply(res.pulled);
        sync.last = { pulled: res.pulled.length, pushed: res.pushed.length };
        sync.saved = { ...sync.saved, lastAt: Date.now() };
        writeSaved(sync.saved);
        sync.status = 'idle';
        sync.error = '';
      } while (again);
    } catch (e) {
      sync.status = navigator.onLine === false ? 'offline' : 'error';
      sync.error = explain(e);
    } finally {
      running = null;
    }
  })();
  return running;
}

function explain(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/permission|PERMISSION_DENIED/i.test(m)) return '置き場に入れませんでした（Firestore のルールを確認してください）';
  if (/not-found|NOT_FOUND|database.*does not exist/i.test(m)) return 'Firestore のデータベースが見つかりません（作成してください）';
  if (/api.?key|invalid/i.test(m)) return '接続設定が正しくないようです';
  if (/network|offline|unavailable|Failed to fetch/i.test(m)) return '通信できませんでした（あとで自動でもう一度）';
  return m.slice(0, 120);
}

/** 取り込んだ記録を、今の画面の状態にも反映する */
function apply(keys: string[]) {
  if (!keys.length) return;
  if (keys.includes('eq.settings.v2')) store.settings = loadSettings();
  const pk = `eq.progress.${store.settings.activeMode}.v1`;
  if (keys.includes(pk) || keys.includes('eq.settings.v2')) store.progress = loadProgress(store.settings.activeMode);
  emitPulled(keys);
}

/** 新しく同期を始める（この端末の記録を置き場に置く）。コードを返す */
export async function startNew(): Promise<string> {
  const code = newCode();
  sync.saved = { ...sync.saved, code };
  writeSaved(sync.saved);
  await syncNow();
  return code;
}
/** ほかの端末のコードで同期する（この端末の記録とまとめる） */
export async function join(input: string): Promise<boolean> {
  const code = normalizeCode(input);
  if (!isValidCode(code)) return false;
  sync.saved = { ...sync.saved, code };
  writeSaved(sync.saved);
  await syncNow();
  return true;
}
/** この端末の同期をやめる（記録はこの端末に残る。置き場も消さない） */
export function stop() {
  sync.saved = { ...sync.saved, code: null, lastAt: undefined };
  writeSaved(sync.saved);
  sync.status = 'off';
  sync.error = '';
  remote = null;
}
export function setConfig(c: Record<string, string> | null) {
  sync.saved = { ...sync.saved, config: c };
  writeSaved(sync.saved);
  remote = null;
}

let pendingAfterModal = false;
let started = false;
/** 起動時に一度だけ呼ぶ（main.ts） */
export function initSync() {
  if (started) return;
  started = true;
  sync.status = sync.code && sync.config ? 'idle' : 'off';
  let timer = 0;
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), ms);
  };
  onTouched(() => sync.code && soon(6000));
  document.addEventListener('visibilitychange', () => {
    if (!sync.code) return;
    if (document.visibilityState === 'visible') soon(400);
    else void syncNow(); // 離れるときに送っておく
  });
  addEventListener('online', () => sync.code && soon(800));
  setInterval(() => sync.code && document.visibilityState === 'visible' && void syncNow(), 5 * 60_000);
  // クイズ・学習を終えたら、待たせていた同期をする
  $effect.root(() => {
    $effect(() => {
      void router.stack.length;
      if (pendingAfterModal && router.top.kind !== 'modal') {
        pendingAfterModal = false;
        soon(600);
      }
    });
  });
  if (sync.code) soon(1500);
}
