<script lang="ts">
  // 「第27章 現在形と現在進行形」の小さな見出し。左の印は部の色
  import { partColor } from './partColor.ts';
  let { part, chapter, title }: { part: number; chapter: number; title: string } = $props();
</script>

<p class="ct" style:--part={partColor(part)}><span class="pd"></span><span class="no">第{chapter}章</span><span class="t">{title}</span></p>

<style>
  .ct {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
  }
  .pd {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--part) var(--part-mix), #fff);
  }
  .no {
    flex: none;
    font-weight: 800;
    color: color-mix(in srgb, var(--part) var(--part-mix), #fff);
  }
  .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
