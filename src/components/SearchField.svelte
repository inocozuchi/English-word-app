<script lang="ts">
  // 検索欄（枠付き・入力中は ✕ で消せる）
  import Icon from './Icon.svelte';
  let { value = $bindable(''), placeholder = '' }: { value?: string; placeholder?: string } = $props();
  let input: HTMLInputElement;
</script>

<label class="search" class:filled={!!value}>
  <Icon name="search" size={18} />
  <input bind:this={input} type="search" {placeholder} bind:value autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
  {#if value}
    <button class="clear" type="button" aria-label="検索語を消す" onclick={() => { value = ''; input.focus(); }}><Icon name="x" size={14} stroke={3} /></button>
  {/if}
</label>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 8px 0 14px;
    border-radius: 16px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    color: var(--text3);
    margin-bottom: 16px;
    transition: border-color 0.2s;
  }
  .search:focus-within,
  .search.filled {
    border-color: var(--ink);
    color: var(--text);
  }
  input {
    flex: 1;
    border: 0;
    outline: 0;
    background: none;
    font-size: 16px; /* 16px 未満だと iOS がフォーカス時に拡大する */
    color: var(--text);
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
  }
  input::placeholder {
    color: var(--text3);
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--fill-strong);
    color: var(--text2);
  }
</style>
