<script lang="ts">
  // 設定の「報告した問題」: 件数・JSON で書き出す・すべて消す（core/reports.ts）
  import Icon from './Icon.svelte';
  import { haptic } from '../core/haptics.ts';
  import { loadReports, saveReports, exportReports } from '../core/reports.ts';

  let { modeId, fileName, describe }: { modeId: string; fileName: string; describe?: (key: string) => Record<string, unknown> | null } = $props();
  // svelte-ignore state_referenced_locally
  let reports = $state(loadReports(modeId));
  let armed = $state(false);

  async function exportR() {
    const name = `${fileName}-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([exportReports(modeId, reports, describe)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file] }));
    } catch {
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function clearR() {
    if (!armed) {
      armed = true;
      haptic('light');
      setTimeout(() => (armed = false), 4000);
      return;
    }
    saveReports(modeId, []);
    reports = [];
    armed = false;
  }
</script>

<h2 class="ui-h2">報告した問題</h2>
<div class="ui-group">
  <div class="ui-item">
    <div class="ui-txt"><span>{reports.length} 件</span><span class="ui-hint">クイズ中の 🚩 から報告した問題（この端末に保存）</span></div>
  </div>
  {#if reports.length}
    <button class="ui-item link" onclick={exportR}><span>JSON で書き出す</span><Icon name="chevron" size={18} /></button>
    <button class="ui-item link danger" onclick={clearR}><span>{armed ? 'もう一度タップで消去' : '報告をすべて消す'}</span></button>
  {/if}
</div>

<style>
  .link {
    text-align: left;
    color: var(--text);
  }
  .danger {
    color: var(--text2);
  }
</style>
