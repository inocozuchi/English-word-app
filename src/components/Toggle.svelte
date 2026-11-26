<script lang="ts">
  // iOS 風スイッチ
  let { checked, onchange, label }: { checked: boolean; onchange: (v: boolean) => void; label: string } = $props();
</script>

<button class="toggle" class:on={checked} role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    flex: none;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    background: var(--fill-strong);
    position: relative;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 0.25s;
  }
  .toggle.on {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
    transition: transform var(--dur-press, 300ms) var(--ease-press, ease-out);
  }
  .on .knob {
    transform: translateX(20px);
  }
  /* 押している間、つまみが少し伸びる（iOS のスイッチと同じ手応え） */
  .toggle:active .knob {
    transform: scaleX(1.22);
    transform-origin: left center;
  }
  .toggle.on:active .knob {
    transform: translateX(20px) scaleX(1.22);
    transform-origin: right center;
  }
</style>
