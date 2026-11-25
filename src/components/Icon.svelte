<script lang="ts">
  // 線のアイコン（必要なものだけ手書き）
  let { name, size = 24, stroke = 2 }: { name: string; size?: number; stroke?: number } = $props();
  const P: Record<string, string> = {
    back: 'M15 5l-7 7 7 7',
    close: 'M6 6l12 12M18 6L6 18',
    chevron: 'M9 5l7 7-7 7',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M7 7l10 10M17 7L7 17',
    book: 'M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z',
    chart: 'M5 20V11M12 20V4M19 20v-6',
    gear: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM19.4 13.5l1.5 1.2-1.7 3-1.9-.6a7.5 7.5 0 01-1.8 1l-.4 2h-3.4l-.4-2a7.5 7.5 0 01-1.8-1l-1.9.6-1.7-3 1.5-1.2a7.6 7.6 0 010-2.1L3.9 10.2l1.7-3 1.9.6a7.5 7.5 0 011.8-1l.4-2h3.4l.4 2a7.5 7.5 0 011.8 1l1.9-.6 1.7 3-1.5 1.2a7.6 7.6 0 010 2.1z',
    search: 'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20',
    pause: 'M9 6v12M15 6v12',
    flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.4-2.3-5.6-4-7.8-.6 1.8-1.6 2.9-2.8 3.3.3-2.8-.6-5.6-3-7.3.2 3-1.6 5.1-3 7-1 1.4-2.2 3-2.2 4.9C3.5 18.4 7.2 21 12 21z',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={P[name]} />
</svg>
