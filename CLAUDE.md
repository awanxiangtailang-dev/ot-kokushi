# OT国試ノート(過去問アプリ + 体験談サイト)

運営者「ねこだんご」(現役OT)の、作業療法士国家試験の過去問アプリと体験談サイト。返事は日本語・やさしい言葉で短く。

## 構成
- `src/` … 過去問アプリ(React + Vite + TS)。設定は `src/config/site.ts`(リンク・アフィリエイト)、`src/logic/stats.ts`(次の試験日)
- `public/data/exams/<回>.json` … 第52〜61回の2,000問(生成物。手で直さない)
- `public/data/explanations/<回>.json` … 解説(ここに追記する)
- `public/img/` … 問題・別冊の画像(生成物)
- `ot-site/` … 体験談サイト。`ot-site/app/` と `ot-site/kakomon/` は生成物(gitignore)
- `scripts/extract/` … 厚労省PDF → データ(`npm run data`。PDFは `raw/`、普段は触らない)
- `scripts/make-pages.mjs` … 1問1ページの解説ページと回ごとの一覧を生成
- `docs/サイト作りの計画.md` … 書く内容とSEOの方針

## コマンド(Windows PowerShell。Python は使えない、Node のみ)
- `npm test` … ロジック + データ検査(47件)
- `npm run build:site` … アプリをビルドして ot-site/app へ、解説ページも生成
- `npm run release:check` / `npm run release` … 公開前チェック / release/ を作る
- 確認用サーバー: `node scripts/serve-static.mjs ot-site 4173`
- `npm run review` … 監修用ページ(http://127.0.0.1:4174)。OK で `reviewed: true`、「直したい」のメモは `review/notes.json`(gitignore)
- 公開の手順(独自ドメイン・DNS・GitHub Pages): `docs/公開の手順.md`。ドメインは `site.config.json` の `siteUrl` 1か所
- 書きかけの記事は `site.config.json` の `drafts` に入れると、公開版に入らずリンクも消える(`ot-site/index.html` は `<!-- 記事: パス -->…<!-- /記事 -->` で囲む)。書き終えたら drafts から外す
- git は PATH にない: `$env:LOCALAPPDATA\github-copilot-git-2.56.0-1\cmd\git.exe`(作成者名「OT国試ノート」で設定済み。GitHub にはまだ上げていない)

## 解説の書き方
- 形式: `{"60A021": {"text": "...", "choiceNotes": ["1の解説", ... 5つ], "reviewed": false}}`。ID は 回 + A(午前)/B(午後) + 3桁
- 正解は `public/data/exams/<回>.json` の `answers` に必ず合わせる(複数正解・採点除外はそのことも書く)
- 文体: やさしい日本語、です・ます。正解の選択肢は「正解。〜」、誤りを選ぶ問題は「誤り(正解)。」
- 図のある問題(`image` / `bessatsu` / `choicesFromImage`)は、画像を Read で見てから書く
- 書き方: スクラッチに JSON を書く → node で既存ファイルにマージ(キーでソート)→ `npx vitest run scripts/extract/data.test.mjs`
- `reviewed` は運営者が「監修済みにして」と言ったときだけ true にする(未監修は解説ページが noindex になる)
- 自信が低い解説は、報告で問題番号を挙げる

## 守ること
- 体験談・プロフィールを作り話で埋めない(運営者の実体験だけ)。参考書は実際に使ったものだけ(ステマ規制)。「PR」表記と Amazon 定型文は消さない
- 出典表示(厚労省、PDL1.0、加工した旨)を消さない
- 本名・勤務先・メールアドレスをファイルに書かない

## 現状(2026-11-25)
- 解説: 第52〜61回の2,000問すべてあり。監修済みは第61回の200問だけ(残り1,800問は未監修)
- ドメイン `ot-kokushi.com` を Cloudflare で購入済み(`site.config.json` に設定済み)。GitHub・DNS はまだ
- 運営者ページ・体験談記事2本は書きかけ(運営者の回答待ち)。公開先は GitHub Pages の予定(リポジトリ未作成)

## 次にやること
方針: 試験(2027年2月下旬)前に検索に載せたいので、「公開」と「監修」を先にする
1. ドメイン購入 → GitHub に上げて公開 → Search Console(`docs/公開の手順.md`)
2. 監修(新しい回から。`npm run review`、あやしい問題から)
3. 運営者ページ・記事(回答が来たら文章に整える)
