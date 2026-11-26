# 教材追加指示
既存 comprehensive_course.json と curriculum.json を読み、既存ID・内容を保持して次の連続7日程度を追加する。初歩から実用へ。各通常日20語程度、熟語10、チャンク5、文法15問、瞬間英作文10問、言い換え、リスニング、読解、会話を目標とし、量より自然さを優先。復習日は新出を抑え、既存ID参照。語彙は中学初級から、S相当の運用語を優先。英語、カナ、和訳、例文、例文訳、可能ならIPA・強勢・簡単な英英定義を付与。カナは近似と明記。英国/NZ表現を優先し、米国差は必要時に注記。未習文法は必要なチャンクとして説明。言い換えは用途・特徴・場所・人・反対語・簡単な日本語への変換を扱う。質問返答、数字、授業指示、誤文訂正、混合演習、実用読解も計画的に追加。正解の複数候補と説明を用意し、未知の妥当な解答は自己判定。教材はオリジナル。既存の問題を水増し複製しない。新しいkindやフィールドはスキーマと実装契約を同時更新。収録済み日だけ status=available とし availableThroughDay を更新。検証して件数・不足・変更点を報告。60日必修と追加教材・辞典を分離し、全教材の暗記を強制しない。


Phase 10-F: pronunciation_reference.json を統合。soundContrast は選択肢をランダム化、connectedSpeech は語境界・強勢を表示、numberListening は数字表記の別解を許容、listeningPassage は原稿を解答後に表示。TTSはen-NZ優先、en-GB代替、速度0.75/1/1.25。音声差が再現されない場合はスキップ可。日本語自由回答は自己採点可。図解の原稿は出題前に隠す。


## Phase 10-G
Load conversation_reference.json and reading_reference.json. Use scripted nodes, not AI; show only current node, TTS speaker, choice feedback, slower repair, terminal completion. Save node and attempt on each choice. Reading documents are fictional; show text and hide answers until response. Integrate recommended questions into existing one-button flow; self-grade open responses. Do not treat TTS as authentic NZ speech.
