# EIGO LOOP（英語ループ・PWA）

iPhone 向けの英語クイズ PWA。個人利用。大学生が通学中に「片手で・負担なく」回せることを最優先する。
複数のクイズ「モード」を設定で切り替える。今あるモード: **語源英単語**（etymology）/ **音声変化（聞こえ方）**（sound）/ **会話チャンク**（chunks）/ **イメージリンク**（imagelink）/ **イメージリンク 反射**（imagelink-reflex）。

## コマンド

- `npm run dev` — データ変換（語源・音声変化・会話チャンク）→ 開発サーバー
- `npm run build` — データ変換 → `dist/` に静的ファイル出力（Service Worker も生成）
- `npm run preview` — ビルド結果の確認
- `npm test` — 単体テスト（Vitest。出題ロジック・間隔反復・保存形式の移行・音声変化の①〜⑨・マーキング・会話チャンクの①〜④と段階解放・語の成り立ち（接頭辞・語根・接尾辞）・イメージリンクの採点・出題方法・全10,695問のスモークテスト・反射版のタイマー・再出題・反射の判定・カナ解析・日付・例文の強調）
- `npm run e2e` — 実際にアプリを操作する総合テスト（要 `npm run build`。クイズの流れ・時間切れ・スワイプで次へ・復習リスト・検索・スワイプバック・設定・バックアップ・モード切替・音声変化・会話チャンク・イメージリンク・反射版・旧データの移行・オフライン）
- `npm run check` — svelte-check による型チェック
- `npm run validate:imagelink` — イメージリンク（完全版・反射版）の問題データの整合性チェック（各 `validate.py`。`npm test` のスモークテストでも実行）
- `npm run icons` — `scripts/icon.svg` からアイコン PNG と起動画面（端末サイズ×ライト/ダーク）を生成（Playwright）。
  起動画面の `<link>` は `scripts/splash-tags.html` に出力されるので、端末を追加したら index.html に貼り直す
- `npm run shots` — iPhone 15 サイズのスクリーンショットを `screenshots/` に保存（要 `npm run build`。`node scripts/screenshot.mjs light|dark` で片方だけ）

`icons` / `shots` は Playwright（Chromium）を使う。グローバルに無ければ `npm i -D playwright && npx playwright install chromium`。

デプロイ: GitHub Pages（https://inocozuchi.github.io/English-word-app/）。`npm run build` した `dist/` の中身を `gh-pages` ブランチに置く（`.nojekyll` を含める）。
ほかの静的ホスティング（Cloudflare Pages など）でも `dist/` を置くだけで動く。
`base: './'` なのでサブパスでも動く。

## データ

`data/` の JSON はマスター。**編集しない。** ビルド時（`npm run data`）に変換し、`src/generated/`（git 管理外）に出力する。
モードのデータは別チャンクで、そのモードを使うときに読み込む（オフライン用に Service Worker はすべてプリキャッシュ）。

### 語源英単語（etymology）

- `data/etymology_words.json`
  構成: chapters（章）/ roots（語源: meaning, memo, intro, words, phrases, chapter）/ words（word, kana, breakdown, core, defs, examples, derivatives, alsoIn）/ groups。
- `scripts/build-data.ts` がビルド時に `src/generated/words.json`（git 管理外）へ変換する。
  - 同じ単語が複数の語源に載っている場合は1語にまとめ、`roots` に全語源IDを持つ（先頭が主たる語源）。
  - kana は `^` で囲んだ部分が強く読む部分。`parseKana` で `{label, parts}` に分解済み（parts の奇数番目が強勢）。
  - schema / corrections / sources など学習に不要な項目は落とす。
  - breakdown の各パーツに **接頭辞・語根・接尾辞・つなぎ**（`kind`）を付ける（`modes/etymology/morph.ts` の `classify`。tests/morph.test.ts）:
    その語源の綴りに合うパーツ＝語根（語源が接頭辞の章・de/ex などの接頭辞なら、その次）、語根より前＝接頭辞（よく知られた接頭辞・「=ex」の注記・接頭辞らしい意味でなければ2つ目の語根）、
    語根より後＝接尾辞（よく知られた接尾辞・意味が空・接尾辞らしい意味）、間の意味のない1文字＝つなぎ。接尾辞の意味が空なら働き（名詞化・〜できる など、`added`）を補い、
    パーツに書かれていない語末の接尾辞も足す。データ（マスター）は編集しない。
- 表示（`components/Morph.svelte` / `ColorWord.svelte` / `Related.svelte`）: 綴りを色分け（接頭辞＝青・語根＝黄・接尾辞＝緑。意味のある色の例外、`--m-*`）、
  パーツを色の箱で並べ、意味をつないでコアイメージへ（中に ＋ 回る → 巻き込む。補った働きは式に入れない）、同じ語根を持つ関連語。
  単語の詳細（辞書）とクイズの解説（箱が1つずつ組み上がる・関連語は1行）に出す。
- groups（語源ではない単語グループ）は単語帳の「その他」にのみ表示し、出題しない。
- note に「語源的には〜系」「別系統」とある掲載は「覚え方として併記されているだけ」の参考語（`Word.refIn` / `Root.refs`）。
  例: cur の cure・curious・secure（本来は cure＝cura 系）、dom の kingdom、loc の lock。
  主たる語源は参考でない掲載を優先し、語源クイズの解説には出さない。単語ツリーでは点線で区別する。

### 音声変化（sound）

- `data/sound_changes.json` → `scripts/build-sound.ts` → `src/generated/sound.json`（各フレーズの `rules`・`mora` を前計算し、不整合を警告）。
- ルール6種: link（連結）/ elide（脱落）/ assim（同化）/ flap（Flap T）/ contraction（短縮形）/ hdrop（h消え）。色は `rules[].color`
  （`modes/sound/rules.css` の `--rule-<id>`。ダークモードでは白と混ぜて明るくする）。
- `items[]`（英文・marks・plain・kana・decoys・changes）と、出題パターン別の `contractions` / `assimilations` / `tFate` / `compounds` / `symptoms` / `concepts`。
- `quiz: false` は出題しない。`source: supplement`（補足例）は設定で外せる（初期は含める）。`level` は items だけにある（compounds は 3、ほかは 1 扱い）。
- データ側の既知の揺れ（アプリで吸収）: sc-028 は text が「hat you」で span「hate you」が見つからない（強調を省く）。
  同じ span に2ルール（sc-003 gotta: flap+contraction、sc-060 about her: hdrop+flap）→ ③ では同じ span の別ルールを誤答にしない。

### イメージリンク（imagelink）

- **例外: `public/data/imagelink/` にそのまま置く静的アセット**（ビルドで変換しない。編集しない）。README.md に仕様。
  `index.json`（部・章）/ `questions/part1〜4.json`（10,695問。part2 は約3MB）/ `figures/*.svg`（`<img src>` で表示）/ `validate.py`。
- 起動時には読まない。出題範囲（部・章の絞り込み）に要る部の JSON だけを `fetch` し、メモリにキャッシュ（`modes/imagelink/state.svelte.ts`）。
  復習リストにある問題の部も読む。オフラインは SW のプリキャッシュから（README.md と validate.py はキャッシュしない）。
- 保存キーは `c<章>:<問題ID>`（記録だけで章ごとの達成度を数えられる）。
- type ごとの画面: 4択（en2ja / ja2en / en2point / table / cloze / fig_caption / core_image / 文字の prep_icon。distractors から重複なく3つ）、
  図の 2×2（fig_choose / 図を選ぶ prep_icon）、並べ替え（order。大文字小文字と文末 .?! を無視）、英作文（translate。自己採点）、
  練習問題（exercise。short は自動採点で空白・大文字小文字・句読点・（ ）の補足を無視、self は自己採点）、カード（flashcard）。
  自己採点は「違った／あやしい／合っていた」（あやしい = 正解扱いで自信なし `ItemState.conf = 'low'`）、カードは「もう一度／覚えた」。
- 出題方法（設定）: 復習（間隔反復）/ 章別ミニテスト（10問）/ 部別・総合（10・20・50問）/ 苦手克服（まちがえた・自信なし）/
  イメージ図 / フラッシュカード / 英作・語順。絞り込み（部・章・type・難易度・タグ）はどの方法にも掛かる。type を絞っていないとき、カードはフラッシュカードでだけ出す。
- Leitner は5箱（`IL_SRS`: 箱1〜5、間隔 1/3/7/14/30 日、まちがいで箱1）。習得 = 箱4以上。
- 「章と達成度」画面（部ごとの進み具合・章ごとの正答率と習得数。章をタップでその章のミニテスト = クイズの `override`）。
- 英文の 🔊（`core/speech.ts`、en-US）。設定で「答え合わせのあとに英文を読む」。部の色 1青 / 2緑 / 3オレンジ / 4紫（ダークでは `--part-mix` で明るく）。

### イメージリンク 反射（imagelink-reflex）

- `public/data/imagelink-reflex/`（静的アセット。編集しない）: `questions/reflex.json` 238問・`cards.json` 60枚・`figures/`（完全版と同じ SVG）。小さいので一度に読む。
- 完全版とは別のモード・別の記録（`eq.progress.imagelink-reflex.v1`）。キーは `r_` の id（問題とカードは重ならない）。箱は完全版と同じ5箱。
- **専用のクイズ画面**（`modes/reflex/screens/ReflexQuiz.svelte`。`QuizMode.quizRoute` でホームのスタート・復習から開く）:
  問題ごとの制限時間 `time_limit_sec`（3〜5秒、細いバー）、選んだ瞬間に採点、正解0.4秒・不正解1.5秒・時間切れ1秒で自動で次へ（タップ・Enter で早送り）。
  解説は出さず、正解と教科書のページだけ。「詳しく読む」は結果画面にまとめる。2×2 の大きな選択肢、キー 1〜4。遷移は 120ms のフェードだけ。
- 仕組みは `modes/reflex/engine.ts`（時刻を引数で渡す。tests/reflex.test.ts）: `QuestionTimer`（一時停止）、`grade`（時間切れ・遅い正解＝制限時間の70%超は「あやしい」= conf low）、
  `ReflexRun`（まちがえた問題を 3〜6 問後に出し直し、2回続けて正解で終わり。上限4回。成績は初回の回答だけ記録）、
  `isReflexive`（直近3回すべて正解かつ50%以内 =「反射できる」。`ItemState.recent` に直近5回の反応時間）。グループ別の反射率が主な指標。
- 出題方法: ウォームアップ（全グループから10問）/ グループ集中・図→語・語→イメージ（20問）/ 弱点（新しい順に20問）/ 暗記カード（すぐ出た／あやしい／出ない）/ タイムアタック（全問・再出題なし、ベストは `Progress.extra.attackBest`）。
- 完全版の「章と達成度」に、その章の反射版の「反射できる」数を出す。
- **図の答えを伏せる**（`modes/reflex/figmask.ts`。データは編集せず表示のときだけ）: 図の見出しに答えの語が書いてあると読むだけで答えられるため、
  その図が表す語（図→語の answer・語→図の prompt_ja）を含む `<text>` を「？」に、「名前：説明」の短い名前（8字以内）も「？」にして説明（コアイメージ）は残す。
  誤答の図も同じように伏せる（名前を読んで消去法で選べない）。読み込み時に全図を fetch して伏せた data URL を作る。詳しく読む画面は元の図。
- 横長の図（縦横比 1.8 以上。56枚中46枚が約3:1）の4択は1列に並べて大きく、アイコン（1.3）は2×2。問題文は型ごとの短い指示（「合う図は？」など）。
  図が描けるようになって（`img.decode()`）から時間を計り始める。残り3割でバーがアクセント色に。
- 動き: 新しい問題は問題文が少し上がり選択肢が25msずつずれて浮かぶ（200ms以内）、正解はポップ・誤答は横揺れ、連続正解は毎回小さく弾み5問ごとに小さな紙吹雪、カードは縦軸で裏返る。

### 会話チャンク（chunks）

- `data/chunks.json` → `scripts/build-chunks.ts` → `src/generated/chunks.json`（番号の参照・穴埋めの ＿＿＿＿ を検査して警告）。
- `entries[]` 498件（num・section 20章・priority A 300 / B 186 / C 12・chunk・bare・gloss・ex・meaning・exJa・note・region・style・blank・near・sameMeaning・similarMeaning・ambiguous・crossRef）と `pairs[]` 18組。
- 注意: `blank.answer`（例: How often）は `bare`（How often ...?）と形が違う → ③ の答えは `blank.answer`（穴に入る形）。
  別の表現どうしで meaning（6組）・exJa（5組）の文字列が同じものがある → どのパターンでも同じ文字列は選択肢に入れない。

## 設計方針

- Vite + TypeScript + **Svelte 5**（ランタイムが小さく、仮想DOMなし）。UI ライブラリ・アニメーションライブラリは入れない。
- クイズの種類を **モード** として分けている。共通部分（core・screens）はモードに依存しない。

```
src/
  core/            モードに依存しない仕組み（テストあり）
    mode.ts        モードのインターフェース（QuizMode / Question / Choice / Route）
    session.ts     1セッションの組み立て（通常 / 復習モード。mode.pick があれば選び方を任せる）
    srs.ts         間隔反復   review.ts  復習リスト   storage.ts  保存と旧形式の移行
    store.svelte.ts  状態（設定・今のモードの記録・モード切替・秒数）  router.svelte.ts  画面スタック
    spring.ts / transitions.ts / haptics.ts / boot.ts / day.ts / rng.ts / distractors.ts / highlight.ts
  screens/         共通の画面（ホーム・クイズ・QuizCard・結果・復習リスト・設定・学習記録）
  components/      共通部品（Page, Icon, Toggle, Segmented, Example, Num）
  modes/
    index.ts       使えるモードの一覧（設定の「モード」にこの順で並ぶ）
    etymology/     語源英単語（mode.ts, quiz.ts, Prompt/Explain, 設定・記録のセクション, screens/）
    sound/         音声変化（mode.ts, quiz.ts, marks.ts, Prompt, components/Marked など, screens/ 復習ノート）
    chunks/        会話チャンク（mode.ts, quiz.ts, sections.ts, Prompt, components/EntryDetail など, screens/ チャンク辞典）
    imagelink/     イメージリンク（mode.ts, quiz.ts, state.svelte.ts, Prompt/Explain/Interact, screens/ 章と達成度・章の絞り込み・問題の詳細）
    reflex/        イメージリンク 反射（mode.ts, engine.ts, state.svelte.ts, screens/ 専用クイズ・結果・反射率・詳細）
```

### モードの追加方法

1. **データ**: `data/<名前>.json` に置く（編集しない）。`scripts/build-<名前>.ts` で `src/generated/<名前>.json` に変換し、
   `package.json` の `data` スクリプトに足す（`node scripts/build-data.ts && node scripts/build-sound.ts && node scripts/build-chunks.ts && …`）。
2. **問題生成**: `src/modes/<id>/quiz.ts` に UI に依存しない関数を書く（テストを `tests/<id>.test.ts` に）。
   - `candidates(settings)`: 出題範囲の候補 `{ key, base, group, newOrder }`。key はモードの中で一意（例: `s1:sc-001`）。
     base が同じものは1セッションに1回。newOrder は未習のときの出題順。
   - `question(key, rng)`: 4択の `Question` を返す（`choices` は重複なし・正解を含める。`answer` は正解の位置。`tags` にルールなどを入れると正答率が別に集計される）。
   - 必要なら `pick(input, settings)`: パターンの比率や苦手の優先など、出題の選び方を上書き（省略時は間隔反復の優先順）。
   - 記録の単位とパターンを分けたいとき（会話チャンク）: 候補のキーを記録の単位（表現の id）にし、pick で選んでから
     `c1:ch-001` のようにパターンを付けたキーを返す。question はどちらの形も受け、返す `Question.key` は記録の単位にする
     （復習リストからは id だけで呼ばれるので、そのとき使えるパターンを選ぶ）。
3. **登録**: `src/modes/<id>/mode.ts` で `QuizMode` を実装し、`src/modes/index.ts` の `MODES` に足す。これで設定のモード一覧に出る。
   - `timing`（自動で次へ・制限時間の初期値）、`normalizeSettings`（設定の初期値と正規化。`settings.modes[id]` に保存される）
   - `Prompt`（問題文）と `Explain`（解説）。問題文を残したまま解説を重ねるなら `inlineExplain: true` にして Prompt が `phase` を見て描く
   - `label` / `detailRoute`（結果・復習リストの表示と詳細画面）、`summary` / `stat`（ホームの要約）、`note`（解説の下の注記）
   - 任意: `SettingsSection` / `StatsSection` / `ResultSection`、一覧画面 `browse` と `screens`（名前は `<id>/xxx`）
   - 任意: `srs`（箱の決まり。既定は 0〜5 箱）、`sessionCount`（1回の問題数）、`reportable`（クイズに「この問題を報告」）
   - 4択以外の回答: `Question.interactive` のとき `Interact` がカード全体を描き、`onanswer({ ok, given, conf })` で知らせる。
     `untimed`（制限時間なし）・`advanceSec`（自己採点のあとは短く）。画像の選択肢は `Choice.image`（すべて画像なら 2×2）
   - `quizRoute`（専用のクイズ画面）・`hideTiming`（設定の秒数を出さない）・`Progress.extra`（モード固有の記録）・`recordAnswer` の反応時間
   - クイズの route に `override`（モードの設定に重ねる。章のミニテストなど）を渡せる。`load(s)` はその範囲のデータも読む
4. 記録・復習リスト・タイマー・結果・連続日数は共通部分が自動で扱う（モードごとに別保存）。

- 画面遷移は自作のスタック型ルーター。Route は `{ name, params }`。URL は使わない。
- アニメーションは **transform と opacity だけ**。スプリングは `core/spring.ts` で解いて CSS `linear()` イージングにし、Web Animations API / CSS transition で動かす。`prefers-reduced-motion` ではフェードのみ。
- 保存は localStorage（`core/storage.ts`）。サーバー・アカウントなし。
  - `eq.settings.v2`: 共通設定（問題数・テーマ・触覚・復習の回数・今のモード）＋ `modes[id]`（秒数 advanceSec / answerSec と各モードの範囲）
  - `eq.progress.<モードID>.v1`: モードごとの記録（間隔反復・日ごとの回答数＝連続日数と正答率・復習リスト・タグ別正答率）
  - `eq.reports.<モードID>.v1`: 「この問題を報告」（`core/reports.ts`。イメージリンクの設定から JSON で書き出す）
  - 旧形式（`ety.settings.v1` / `ety.progress.v1`）は最初の起動時に語源英単語モードへ移行し、旧データは残す。書き出し・読み込みは全モード（旧ファイルも読める）。
- オフライン: `scripts/vite-plugin-sw.ts` がビルド後に dist の全ファイルをプリキャッシュする `sw.js` を生成。キャッシュ優先、新版は次回起動から。
- 出題:
  - `srs.ts` 簡易 Leitner（箱0〜5、間隔 0/1/3/7/16/35 日、まちがい・未回答で箱0）。
    優先度: 期限切れ×前回まちがい → 期限切れ → 未習（学習順）→ 期限前。1セッション内で同じ対象は1回、前回最後の問題を先頭にしない、同じまとまりをなるべく隣接させない。
  - 語源: 選択肢は「同じ語源 → 同じ章 → 全体」の順で、同じ品詞を優先。意味の語句が正解と重なるものは除外。
    出題パターン: 英→日(ej) / 日→英(je, 英→日を学んだ語から) / 語源→意味(rm) / 熟語→意味(ph)。
  - 音声変化: ①聞こえ方当て ②元の英文当て ③原因ルール当て ④症状診断 ⑤元の形当て ⑥同化の対応 ⑦tの行方 ⑧複合変化の順序 ⑨知識問題（キー `s1:`〜`s9:`）。
    比率は ①③⑦ 各20%、残りで40%（`allocate`）。⑧ は難易度「すべて」かつ30問答えてから。未習は苦手なルール（タグ別正答率が低い）から。
    ② の誤答は同じルールの項目からモーラ数が近い順。⑧ は手順を A/B/C で示し、誤答は隣接入れ替え（足りなければ別の並び）。
  - 会話チャンク: ①英→和 ②和→英 ③穴埋め ④使い分け（比率 25:25:35:15）。記録は表現の id（使い分けは `pr-01#a`）。
    誤答は near（形が近い順）→ 同じ章 → 全体から。sameMeaning / similarMeaning（どちら側に書かれていても）と同じ文字列は入れない。
    ambiguous は②に、blank が null は③に出さない。③は頭の単語と語数が正解と同じ候補（How often に対する How long など、
    文に入れても成り立ちやすいもの）を後回しにし、穴の位置で先頭の大文字・小文字をそろえる。
    優先度は自動解放（最初は A、A の習得7割で B、B の7割で C。習得 = 箱3以上 = 3回続けて正解・次の間隔7日以上）か手動。
    新しい表現は1回最大5件（章の順）、残りはまちがえた・期限の来た表現。復習するものが足りないときだけ新しい表現で埋める。
    章ごとの正答率はタグ `sec:N` で集計（苦手な章）。読み上げ（聞き取り問題・例文の読み上げ）は今は入れていない。
  - 秒数はモードごと。自動で次へは正解・不正解で別（`Timing.advanceOkSec` / `advanceNgSec`。旧 `advanceSec` は両方に引き継ぐ: `resolveTiming`）。
    初期値: 語源 正解4・不正解7・制限8秒、音声変化 6・10・12秒、会話チャンク 5・9・10秒、イメージリンク 5・10・15秒（入力・並べ替え・カードは制限時間なし）。
- **復習リスト**（`core/review.ts`）: まちがえた（時間切れを含む）問題は自動で入る。連続で `reviewGoal` 回（初期3, 2〜5）正解すると自動で外れる。
  ホームの「復習する」で、リストの問題だけを出す復習モード（出題範囲・形式の設定は無視）。復習リスト画面で手動で外すこともできる。
- 日付は午前4時区切り（`day.ts`）。
- クイズのタイマーは WAAPI で細いバーを縮めるアニメーションそのもの（`finish` で次へ）。一時停止は `Animation.pause()`。
  `$effect` で `paused` を見るときは、早期 return より前に読んで依存に登録すること（過去にこれで一時停止が効かなかった）。
- クイズのタッチ操作: 長押し（450ms。指が動いたら長押しにしない）で一時停止、解説中に左スワイプ（70px 以上かフリック）で次の問題へ。
  めくっている途中も入ってくるカードは押せて、押した選択肢はめくり終わったらすぐ回答にする（`pendingChoice`）。
- **連打・遷移中のタップを捨てない**: ルーターは遷移中（約0.55秒）に来た「戻る」「開く」を1つ覚えて、遷移のあとに実行する
  （同じ画面を開く連打・戻る途中の「戻る」は捨てる＝2画面戻らない）。押せない状態のボタンは作らず、押したら次へ進める（反射版の正誤の表示中など）。
  キーボード: 1〜4 で選ぶ、解説中は Enter（→）で次へ、Esc でやめる（入力欄の中では使わない）。図の拡大など `core/overlay.svelte.ts` の重なり表示中は一時停止。
- 問題の切り替えは**カルーセル**（`screens/Quiz.svelte`）: 次の問題のカードを右に並べ、スワイプでは指についてきて、
  自動で進むときも同じ横めくりで動く。めくり終えたら右のカードをそのまま今の問題にする（要素を作り直さないのでちらつかない）。
- 起動（`core/boot.ts`）: フォントの読み込みと画面サイズ・セーフエリアの確定（150ms 変わらない）を待ってから `html.booted` を付け、
  ホームの `[data-intro]` を上から順に出す。iOS は起動直後に高さが変わり、そのまま描くと「下からカクッ」と見えるため。
  起動画面（splash）は背景色だけ（ロゴを置くと、アプリに切り替わる瞬間に位置がずれて見える）。
- 動きの方針: 急に変わる・点滅するものは置かない。出てすぐ消える演出はしない。数字は `components/Num.svelte` で数え上げて弾む。
  画面の差し替え（クイズ → 結果）も右から重ねるスライド（`router.replace`）で、背景だけになる瞬間を作らない。
## デザイン

- 白・黒＋アクセント1色（#3d5afe / ダーク #7088ff）。音声変化のルール色は意味のある色として例外（マーキング・バッジ・バー）。
- アプリ名は EIGO LOOP（ロゴは太枠に2行「EIGO / LOOP」、アイコンは青地に白い輪の矢印と E）。
- ANYCOLOR のサイトを参考に、「極太の欧文見出し（`.display`, Inter 850）」と「太い黒枠（`--frame` / `--ink`）」で全画面を統一する。
  - 画面の見出しは `components/PageHero.svelte`（日本語の小見出し＋極太の欧文。`*語*` はアクセント色）。ホームと同じ構成。
  - 操作する一覧・パネル（設定・一覧・記録）は `--panel-border`（太い黒枠）。`.ui-group` / `.ui-item` / `.ui-h2`（左に黒い短い棒）を使う。
  - 読み物のカードが続く所（語源ツリー・講ノート・まちがえた一覧）は `--card-border`（一段細い灰色の枠）で重くしない。
  - セグメントは太枠＋選択中はアクセント色、トグルは押している間つまみが伸びる、検索欄は `components/SearchField.svelte`（✕で消せる）。
  - 数字は `Num` で数え上げ、記録の棒は下から順に伸び、ページの中身は開くと上から少しずつ浮かぶ（`Page` の intro）。復習リストで外した行は横へ抜けて残りが詰まる（FLIP）。
- クイズは回答後も選択肢を見せたまま、上半分（問題のエリア）が解説に入れ替わる。
- 画像の選択肢は、読み込んだ図がすべて横長（1.8 以上）なら1列で大きく、そうでなければ 2×2（`QuizCard`）。
- 会話チャンクの回答後: 問題文はそのまま（inlineExplain）、表現・意味・例文・補足が順にフェードイン（問題文と同じものは繰り返さない）。
  ③は空所に正解が「ポン」と入る。バッジ NZ／英／豪／米・丁寧／口語。
- 音声変化の回答後: 英文はそのまま（inlineExplain）、マーキングが左から順に浮かび上がる（線は transform、弧は stroke-dashoffset）。
  連結でつながる語は折り返さないまとまりにし、弧は固定幅のすき間の下に置く（画面幅で崩れない）。続いて聞こえ方・理由がフェードイン。
  正誤の行の場所は回答前から確保して、英文が動かないようにする。
- 正誤は色だけに頼らない: 状態行は「◯ 正解」/「× 不正解（黒地）」でバッジが弾む、
  選んだ誤答は破線の枠＋取り消し線＋「あなたの答え」、正解の選択肢には ◯ 印。
- 手応えの演出: ヘッダーの点（正解=青・不正解=黒）が弾む、2問以上の連続正解バッジ、解説は上から順に浮かび、
  語の成り立ち（接頭辞・語根・接尾辞の箱）は1つずつ組み上がる。結果はスコアを数え上げ、8割以上で紙吹雪（青と黒の図形）。

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
- ホームの大きな「スタート」1タップで、選んでいるモードのクイズを前回設定のまま即開始。モードの選択は設定で（ホームはスタート上にモード名を小さく出すだけ）。
- 1問: 4択 → 即正誤 → 解説（意味・語源分解・例文）→ **設定秒数で自動で次へ**。秒数は正解のとき・不正解のときで別（モードごと。2〜15秒）。左スワイプですぐ次へも可。
  回答の制限時間（初期8秒, 5〜15）を過ぎたら未回答（不正解）。長押し中は一時停止。
- 1セッション10問（設定可）。終了時に結果とまちがえた語の一覧。
- 画面: ホーム／クイズ／結果／単語帳（章→語源→単語、検索、語源メモ、単語ツリー）／設定／学習記録（連続日数・正答率・苦手な単語）。
- コミットは小さく、日本語のメッセージで。
