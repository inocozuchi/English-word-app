// マウス・トラックパッドで操作しているか（パソコン）。案内の文言を「タップ」と「クリック」で出し分ける
export const finePointer = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
/** 「タップ」/「クリック」 */
export const tapWord = () => (finePointer() ? 'クリック' : 'タップ');
