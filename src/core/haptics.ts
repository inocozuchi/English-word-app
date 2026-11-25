// 触覚フィードバック。使える環境でだけ、軽く使う。
// - navigator.vibrate があればそれを使う（Android 等）
// - iOS Safari には vibrate が無い。iOS 18 以降は <input type="checkbox" switch> の切り替えで
//   システムの軽い触覚が出るので、それを使う（ユーザー操作中のみ有効。それ以外は何も起きない）
import { store } from './store.svelte.ts';

let label: HTMLLabelElement | null = null;

function iosSwitch() {
  if (!label) {
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-10px;top:0';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}

export type HapticKind = 'light' | 'success' | 'error';

export function haptic(kind: HapticKind = 'light') {
  if (!store.settings.haptics) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'error' ? [14, 60, 14] : kind === 'success' ? 12 : 8);
    } else {
      iosSwitch();
    }
  } catch {
    /* noop */
  }
}
