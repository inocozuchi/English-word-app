/**
 * カタカナのモーラ数（目安）。小さいャュョァィゥェォ（拗音・外来音の一部）と空白は数えない。
 * ッ（促音）とー（長音）は1モーラとして数える。
 */
export function moraCount(kana: string): number {
  return kana.replace(/[\sャュョァィゥェォヮ]/g, '').length;
}
