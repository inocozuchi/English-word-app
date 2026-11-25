// ビルド後に dist/ の全ファイルをプリキャッシュする Service Worker（dist/sw.js）を書き出す。
// - インストール時に全ファイルをキャッシュ → 以降は完全オフラインで動く
// - キャッシュ優先。新しい版はバックグラウンドで取得し、次回起動から使われる
import type { Plugin, ResolvedConfig } from 'vite';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const SW = (version: string, assets: string[]) => `// 自動生成（scripts/vite-plugin-sw.ts）
const CACHE = 'ety-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ety-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
`;

export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    closeBundle() {
      const out = config.build.outDir;
      const files = walk(out)
        .map((p) => relative(out, p).split(sep).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(out, f)));
      const version = hash.digest('hex').slice(0, 12);
      const assets = ['./', ...files.map((f) => './' + f)];
      writeFileSync(join(out, 'sw.js'), SW(version, assets));
      config.logger.info(`sw.js: ${files.length} files precached (version ${version})`);
    },
  };
}
