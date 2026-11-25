<script lang="ts">
  // 地域・文体の小さなバッジ（NZ／英／豪／米・丁寧／口語）。データの印は目安
  import type { Entry } from '../types.ts';
  let { entry }: { entry: Entry } = $props();
  const REGION: Record<string, string> = { nz: 'NZ', uk: '英', au: '豪', us: '米' };
  const STYLE: Record<string, string> = { formal: '丁寧', casual: '口語' };
  const list = $derived([
    ...entry.region.map((r) => ({ t: REGION[r] ?? r, k: 'region' })),
    ...entry.style.map((s) => ({ t: STYLE[s] ?? s, k: s })),
  ]);
</script>

{#each list as b}<span class="bd {b.k}">{b.t}</span>{/each}

<style>
  .bd {
    display: inline-block;
    flex: none;
    padding: 0 6px;
    margin-left: 4px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.7;
    vertical-align: 0.2em;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    font-family: var(--font-ja);
  }
  .bd.region {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .bd.casual {
    background: var(--fill);
  }
</style>
