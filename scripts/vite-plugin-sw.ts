// ビルド後に dist/ の全ファイルをプリキャッシュする Service Worker を書き出す。
import type { Plugin } from 'vite';
export function serviceWorker(): Plugin {
  return { name: 'sw-placeholder' };
}
