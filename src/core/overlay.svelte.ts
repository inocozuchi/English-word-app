// 画面の上に重なる表示（図の拡大など）を開いている数。クイズはこれが 0 でない間タイマーを止める。
class Overlay {
  count = $state(0);
}
export const overlay = new Overlay();
