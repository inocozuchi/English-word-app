import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { installSpringVars } from './core/spring.ts';
import { loadData } from './core/store.svelte.ts';
import { requestPersist } from './core/storage.ts';
import { boot } from './core/boot.ts';
import { initSync } from './sync/sync.svelte.ts';

// 単語データ（別チャンク）を最初に読み込み始める
loadData();

installSpringVars(document.documentElement);
// iOS で :active（タップ時の縮小）を効かせる
document.addEventListener('touchstart', () => {}, { passive: true });
// ピンチ拡大を止める（iOS は viewport 指定だけでは止まらない）
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

mount(App, { target: document.getElementById('app')! });
boot();
// 複数端末の同期（設定したときだけ。通信できなくても何もしない）
initSync();

requestPersist();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
