# 語源で英単語（PWA）

語源別に整理した英単語を学ぶ、iPhone 向けの単語クイズ PWA。個人利用。
大学生が通学中に「片手で・負担なく」回せることを最優先する。

## コマンド

- `npm run dev` — データ変換 → 開発サーバー
- `npm run build` — データ変換 → `dist/` に静的ファイル出力（Service Worker も生成）
- `npm run preview` — ビルド結果の確認
- `npm test` — 単体テスト（Vitest。出題ロジック・間隔反復・カナ解析・日付・例文の強調）
- `npm run e2e` — 実際にアプリを操作する総合テスト（要 `npm run build`。クイズの流れ・時間切れ・スワイプで次へ・復習リスト・検索・スワイプバック・設定・バックアップ・オフライン）
- `npm run check` — svelte-check による型チェック
- `npm run icons` — `scripts/icon.svg` からアイコン PNG と起動画面（端末サイズ×ライト/ダーク）を生成（Playwright）。
  起動画面の `<link>` は `scripts/splash-tags.html` に出力されるので、端末を追加したら index.html に貼り直す
- `npm run shots` — iPhone 15 サイズのスクリーンショットを `screenshots/` に保存（要 `npm run build`。`node scripts/screenshot.mjs light|dark` で片方だけ）

`icons` / `shots` は Playwright（Chromium）を使う。グローバルに無ければ `npm i -D playwright && npx playwright install chromium`。

デプロイ: GitHub Pages（https://inocozuchi.github.io/English-word-app/）。`npm run build` した `dist/` の中身を `gh-pages` ブランチに置く（`.nojekyll` を含める）。
ほかの静的ホスティング（Cloudflare Pages など）でも `dist/` を置くだけで動く。
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
- 将来は文法クイズなど英語全般のクイズに広げる予定。そのため **共通部分（core）** と **デッキ（クイズの種類）** を分けている。

```
src/
  core/            デッキに依存しない仕組み（テストあり）
    deck.ts        デッキのインターフェース（Deck / Question / Route）
    session.ts     1セッションの組み立て（通常 / 復習モード）
    srs.ts         間隔反復   review.ts  復習リスト   storage.ts  保存と旧形式の移行
    store.svelte.ts  状態（設定・履歴・使用中のデッキ）  router.svelte.ts  画面スタック
    spring.ts / transitions.ts / haptics.ts / day.ts / rng.ts / distractors.ts / highlight.ts
  screens/         共通の画面（ホーム・クイズ・結果・復習リスト・設定・学習記録）
  components/      共通部品（Page, Icon, Toggle, Segmented, Example）
  decks/
    index.ts       使えるデッキの一覧
    etymology/     語源英単語デッキ（deck.ts, quiz.ts, Prompt/Explain, 設定・記録のセクション, screens/）
```

- **デッキの追加方法**（例: 文法クイズ）: `src/decks/grammar/` を作り、`Deck` を実装して `src/decks/index.ts` に足す。
  - `candidates()` / `question()` で出題、`Prompt` / `Explain` で問題文と解説、`label()` / `detailRoute()` で結果・復習リストの表示。
  - 画面は `screens: { 'grammar/xxx': Comp }` で登録（名前はデッキの接頭辞を付ける）。設定は `settings.decks[deckId]` に入る。
  - 進捗のキーはデッキごとに重ならない接頭辞にする（語源デッキは `ej:` `je:` `rm:` `ph:`）。
  - ホームの大見出し・説明・件数もデッキから取る。デッキが2つ以上になったら、ホームのデッキ表示（chip）を切り替えにする。
- 画面遷移は自作のスタック型ルーター。Route は `{ name, params }`。URL は使わない。
- アニメーションは **transform と opacity だけ**。スプリングは `core/spring.ts` で解いて CSS `linear()` イージングにし、Web Animations API / CSS transition で動かす。`prefers-reduced-motion` ではフェードのみ。
- 保存は localStorage（`core/storage.ts`）。サーバー・アカウントなし。キー名は旧版から変えていない（`ety.settings.v1` / `ety.progress.v1`）。
  旧形式（デッキ分け前・復習リストなし）は読み込み時に自動で移行する。
- オフライン: `scripts/vite-plugin-sw.ts` がビルド後に dist の全ファイルをプリキャッシュする `sw.js` を生成。キャッシュ優先、新版は次回起動から。
- 出題:
  - `srs.ts` 簡易 Leitner（箱0〜5、間隔 0/1/3/7/16/35 日、まちがい・未回答で箱0）。
    優先度: 期限切れ×前回まちがい → 期限切れ → 未習（学習順）→ 期限前。1セッション内で同じ対象は1回、前回最後の問題を先頭にしない、同じまとまりをなるべく隣接させない。
  - 語源デッキの選択肢は「同じ語源 → 同じ章 → 全体」の順で、同じ品詞を優先。意味の語句が正解と重なるものは除外。
  - 語源デッキの出題形式: 英→日(ej) / 日→英(je, 英→日を学んだ語から) / 語源→意味(rm) / 熟語→意味(ph)。
- **復習リスト**（`core/review.ts`）: まちがえた（時間切れを含む）問題は自動で入る。連続で `reviewGoal` 回（初期3, 2〜5）正解すると自動で外れる。
  ホームの「復習する」で、リストの問題だけを出す復習モード（出題範囲・形式の設定は無視）。復習リスト画面で手動で外すこともできる。
- 日付は午前4時区切り（`day.ts`）。
- クイズのタイマーは WAAPI で細いバーを縮めるアニメーションそのもの（`finish` で次へ）。一時停止は `Animation.pause()`。
  `$effect` で `paused` を見るときは、早期 return より前に読んで依存に登録すること（過去にこれで一時停止が効かなかった）。
- クイズのタッチ操作: 長押し（280ms）で一時停止、解説中に左スワイプ（70px 以上かフリック）で次の問題へ。
- 問題の切り替えは**カルーセル**（`screens/Quiz.svelte`）: 次の問題のカードを右に並べ、スワイプでは指についてきて、
  自動で進むときも同じ横めくりで動く。めくり終えたら右のカードをそのまま今の問題にする（要素を作り直さないのでちらつかない）。
- 起動（`core/boot.ts`）: フォントの読み込みと画面サイズ・セーフエリアの確定（150ms 変わらない）を待ってから `html.booted` を付け、
  ホームの `[data-intro]` を上から順に出す。iOS は起動直後に高さが変わり、そのまま描くと「下からカクッ」と見えるため。
  起動画面（splash）は背景色だけ（ロゴを置くと、アプリに切り替わる瞬間に位置がずれて見える）。
- 動きの方針: 急に変わる・点滅するものは置かない。出てすぐ消える演出はしない。数字は `components/Num.svelte` で数え上げて弾む。
  画面の差し替え（クイズ → 結果）も右から重ねるスライド（`router.replace`）で、背景だけになる瞬間を作らない。
## デザイン

- 白・黒＋アクセント1色（#3d5afe / ダーク #7088ff）。
- ANYCOLOR のサイトを参考に、ホームなど要所に「極太の欧文見出し（`.display`, Inter 850）」と「太い黒枠（`--frame` / `--ink`）」を使う。
  一覧やクイズは読みやすさ優先で控えめに（薄い枠・薄い面）。
- クイズは回答後も選択肢を見せたまま、上半分（問題のエリア）が解説に入れ替わる。
- 正誤は色だけに頼らない: 状態行は「◯ 正解」/「× 不正解（黒地）」でバッジが弾む、
  選んだ誤答は破線の枠＋取り消し線＋「あなたの答え」、正解の選択肢には ◯ 印。
- 手応えの演出: ヘッダーの点（正解=青・不正解=黒）が弾む、2問以上の連続正解バッジ、解説は上から順に浮かび、
  語源の分解（in + volve → 巻き込む）は1つずつ組み上がる。結果はスコアを数え上げ、8割以上で紙吹雪（青と黒の図形）。

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
- 1問: 4択 → 即正誤 → 解説（意味・語源分解・例文）→ **設定秒数（初期5秒, 3〜10）で自動で次へ**（左スワイプですぐ次へも可）。
  回答の制限時間（初期8秒, 5〜15）を過ぎたら未回答（不正解）。長押し中は一時停止。
- 1セッション10問（設定可）。終了時に結果とまちがえた語の一覧。
- 画面: ホーム／クイズ／結果／単語帳（章→語源→単語、検索、語源メモ、単語ツリー）／設定／学習記録（連続日数・正答率・苦手な単語）。
- コミットは小さく、日本語のメッセージで。
