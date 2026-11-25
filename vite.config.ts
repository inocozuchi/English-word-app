import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { serviceWorker } from './scripts/vite-plugin-sw.ts';

export default defineConfig({
  base: './',
  plugins: [svelte(), serviceWorker()],
  json: { stringify: true },
  build: { target: 'es2022', cssMinify: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
});
