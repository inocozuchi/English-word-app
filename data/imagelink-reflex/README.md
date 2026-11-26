# イメージリンク 反射版データ（仕様）

「見た瞬間に思い浮かぶ」べきコアイメージだけを、3〜5秒の4択で答えるためのデータです。完全版（10,695問）・要点版（3,409問）とは別に、238問＋暗記カード60枚だけを収めています。

## ファイル
- `index.json`：件数・型・グループ
- `questions/reflex.json`：問題（配列）
- `cards.json`：暗記カード（語→コアイメージ、自己判定用）
- `figures/`：図のSVG（`<img src>` で表示）
- `validate.py`：整合性チェック

## 問題の型（すべて `reflex: true`、`time_limit_sec` あり）
| type | 出題 | 選択肢 |
|---|---|---|
| `r_word2image` | `prompt_en` の語のコアイメージは？ | `answer` ＋ `distractors` から3つ（日本語の短文） |
| `r_image2word` | `prompt_ja` のイメージに当てはまる語は？ | 同上（英単語） |
| `r_prep_icon` | `figure`（文字なしアイコン）の前置詞は？ | 同上 |
| `r_prep_word2icon` | `prompt_en` の前置詞のアイコンは？ | `answer_figure` ＋ `distractor_figures`（3枚）の図4択 |
| `r_fig2word` | `figure` が表すものは？（語・時制・文法名） | 文字の4択 |
| `r_word2fig` | `prompt_ja` に合う図は？ | `answer_figure` ＋ `distractor_figures` の図4択 |

## 共通フィールド
`id`（`r_` ＋ハッシュ。固定）、`part`、`chapter`、`chapter_title`、`ref_page_a5`、`group`（基本動詞／副詞・接続／時制・準動詞／助動詞／前置詞／文法／使役）、`tags`、`time_limit_sec`（3〜5）、`difficulty`（常に `reflex`）。

## 注意
- 選択肢（誤答）は同じグループの別の語から機械的に選んでいます。各問題に「この問題を報告」を付けてください。
- 図は完全版・要点版と同じSVGです。
