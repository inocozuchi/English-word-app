# 語源で英単語（PWA）

語源別に整理した英単語を学ぶ、iPhone 向けの単語クイズ PWA。個人利用。
大学生が通学中に「片手で・負担なく」回せることを最優先する。

## コマンド

- `npm run dev` — データ変換 → 開発サーバー
- `npm run build` — データ変換 → `dist/` に静的ファイル出力（Service Worker も生成）
- `npm run preview` — ビルド結果の確認
- `npm test` — 単体テスト（Vitest。出題ロジック・間隔反復・カナ解析・日付・例文の強調）
- `npm run e2e` — 実際にアプリを操作する総合テスト（要 `npm run build`。クイズの流れ・時間切れ・検索・スワイプバック・設定・バックアップ・オフライン）
- `npm run check` — svelte-check による型チェック
- `npm run icons` — `scripts/icon.svg` からアイコン PNG と起動画面（端末サイズ×ライト/ダーク）を生成（Playwright）。
  起動画面の `<link>` は `scripts/splash-tags.html` に出力されるので、端末を追加したら index.html に貼り直す
- `npm run shots` — iPhone 15 サイズのスクリーンショットを `screenshots/` に保存（要 `npm run build`。`node scripts/screenshot.mjs light|dark` で片方だけ）

`icons` / `shots` は Playwright（Chromium）を使う。グローバルに無ければ `npm i -D playwright && npx playwright install chromium`。

デプロイ: `dist/` をそのまま静的ホスティング（Cloudflare Pages 想定。ビルドコマンド `npm run build`、出力 `dist`）。
`base: './'` なのでサブパスでも動く。

## データ

- `data/etymology_words.json` がマスター。**編集しない。**
  構成: chapters（章）/ roots（語源: meaning, memo, intro, words, phrases, chapter）/ words（word, kana, breakdown, core, defs, examples, derivatives, alsoIn）/ groups。
- `scripts/build-data.ts` がビルド時に `src/generated/words.json`（git 管理外）へ変換する。
  - 同じ単語が複数の語源に載っている場合は1語にまとめ、`roots` に全語源IDを持つ（先頭が主たる語源）。
  - kana は `^` で囲んだ部分が強く読む部分。`parseKana` で `{label, parts}` に分解済み（parts の奇数番目が強勢）。
  - schema / corrections / sources など学習に不要な項目は落とす。
- groups（語源ではない単語グループ）は単語帳の「その他」にのみ表示し、出題しない。
- note に「語源的には〜系」「別系統」とある掲載は「覚え方として併記されているだけ」の参考語（`Word.refIn` / `Root.refs`）。
  例: cur の cure・curious・secure（本来は cure＝cura 系）、dom の kingdom、loc の lock。
  主たる語源は参考でない掲載を優先し、語源クイズの解説には出さない。単語ツリーでは点線で区別する。

## 設計方針

- Vite + TypeScript + **Svelte 5**（ランタイムが小さく、仮想DOMなし）。UI ライブラリ・アニメーションライブラリは入れない。
- 画面遷移は自作のスタック型ルーター（`src/lib/router.svelte.ts`）。URL は使わない。
- アニメーションは **transform と opacity だけ**。スプリングは `src/lib/spring.ts` で解いて CSS `linear()` イージングにし、Web Animations API / CSS transition で動かす。`prefers-reduced-motion` ではフェードのみ。
- 保存は localStorage（`src/lib/storage.ts`）。サーバー・アカウントなし。
- オフライン: `scripts/vite-plugin-sw.ts` がビルド後に dist の全ファイルをプリキャッシュする `sw.js` を生成。キャッシュ優先、新版は次回起動から。
- 出題ロジックは `src/lib/`（UI 非依存・テストあり）:
  - `srs.ts` 簡易 Leitner（箱0〜5、間隔 0/1/3/7/16/35 日、まちがい・未回答で箱0）。
    優先度: 期限切れ×前回まちがい → 期限切れ → 未習（学習順）→ 期限前。1セッション内で同じ対象は1回、前回最後の問題を先頭にしない、同じ語源をなるべく隣接させない。
  - `distractors.ts` / `quiz.ts` 選択肢は「同じ語源 → 同じ章 → 全体」の順で、同じ品詞を優先。意味の語句が正解と重なるものは除外。
  - 出題形式: 英→日(ej) / 日→英(je, 英→日を学んだ語から) / 語源→意味(rm) / 熟語→意味(ph)。
- 日付は午前4時区切り（`day.ts`）。
- クイズのタイマーは WAAPI で細いバーを縮めるアニメーションそのもの（`finish` で次へ）。一時停止は `Animation.pause()`。
  `$effect` で `paused` を見るときは、早期 return より前に読んで依存に登録すること（過去にこれで一時停止が効かなかった）。

## デザイン

- 白・黒＋アクセント1色（#3d5afe / ダーク #7088ff）。
- ANYCOLOR のサイトを参考に、ホームなど要所に「極太の欧文見出し（`.display`, Inter 850）」と「太い黒枠（`--frame` / `--ink`）」を使う。
  一覧やクイズは読みやすさ優先で控えめに（薄い枠・薄い面）。
- クイズは回答後も選択肢を見せたまま、上半分（問題のエリア）が解説に入れ替わる。

## iPhone 表示（重要）

- `apple-mobile-web-app-status-bar-style` は **`default`**。コンテンツをステータスバーの下に潜り込ませない
  （`black-translucent` だとダイナミックアイランドと重なり、ライト背景では時計が白文字で見えない）。
  ステータスバーの色は `theme-color`（ライト/ダーク別）で背景色に合わせる。
- それでも全画面で描画される場合に備え、上下の余白は常に `env(safe-area-inset-*)` + 余裕分をとる
  （`--pad-top` / `--pad-bottom`、app.css）。画面の角は丸いので、最上部・最下部の要素は端に寄せない。
- `npm run shots` はダイナミックアイランド・角丸・ホームインジケーターを重ねた「最悪ケース（全画面描画）」で撮る。

## 要件（元の依頼の要点）

- 初回読み込み後は完全オフライン。起動1秒以内、操作の遅延なし、バンドルは小さく。
- ホーム画面に追加でスタンドアロン起動（セーフエリア・ステータスバー色・アイコン）。
- シンプル・ミニマル。余白広め、文字大きめ。白・黒系＋アクセント1色（正解=アクセント、不正解=グレー＋✕＋横揺れ）。ダークモードは OS 追従（設定で固定も可）。
  日本語は system-ui（ヒラギノ）、英語は Inter（ラテン文字サブセットを同梱）。
- スプリング系アニメーション、タップ時の縮小、スワイプバック、ネイティブ慣性スクロール。ダブルタップ拡大・選択ハイライト等は無効。
- 触覚: `navigator.vibrate` があれば使う。iOS Safari には無いので iOS 18+ の `<input switch>` を使う方法で代用（設定でOFF可）。
- ホームの大きな「スタート」1タップで前回設定のまま即開始。
- 1問: 4択 → 即正誤 → 解説（意味・語源分解・例文）→ **設定秒数（初期5秒, 3〜10）で自動で次へ**。
  回答の制限時間（初期8秒, 5〜15）を過ぎたら未回答（不正解）。長押し中は一時停止。
- 1セッション10問（設定可）。終了時に結果とまちがえた語の一覧。
- 画面: ホーム／クイズ／結果／単語帳（章→語源→単語、検索、語源メモ、単語ツリー）／設定／学習記録（連続日数・正答率・苦手な単語）。
- コミットは小さく、日本語のメッセージで。
