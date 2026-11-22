# OT国試 過去問10年

作業療法士国家試験 **第52回〜第61回(2017〜2026年)の2,000問** を解けるアプリです。
体験談サイト(`ot-site/`)とつなげて、参考書のアフィリエイトへの導線を入れています。

- 正答は厚生労働省の発表どおり(採点除外・複数正解・正誤表も反映)
- 図・表・別冊(CT画像・心電図など)は、元のPDFから画像にして表示
- 2つ選ぶ問題、図を見て番号で答える問題に対応
- 苦手な問題を記録して、重点的に出題
- 「今日の1問」と、Xでのシェア(`?q=61A012` のリンクでその問題を直接開ける)
- 以前の急性期OTのオリジナル問題も「オリジナル」として残しています

## 使い方(Windows)

```
npm install
npm run dev
```

`http://localhost:5173` をブラウザで開きます。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | アプリを起動 |
| `npm test` | テストを実行 |
| `npm run build:site` | アプリをビルドして `ot-site/app/` に入れる(サイトごと公開する用) |
| `npm run data` | 厚労省のPDFから、問題データと画像を作り直す(下を参照) |

## 公開のしかた

1. `npm run release:check` で、公開前に直すもの(記事の書きかけ・`#` のままのリンクなど)を確認して直す
2. `site.config.json` の `siteUrl` に公開先の URL を書く(例: `"https://ot-kokushi.netlify.app"`)
3. `npm run release` → `release/` フォルダができる
   - 共有用のタグ(Xのカード画像)・`sitemap.xml`・`robots.txt` に、本物の URL が入ります
   - サイトのトップ: `/`、アプリ: `/app/`
4. `release/` フォルダをまるごと公開(Netlify Drop なら、フォルダをドラッグ&ドロップするだけ)

公開前に手元で見る: `npm run release -- --force` → `node scripts/serve-static.mjs release 4173` → `http://localhost:4173`

### GitHub Pages で公開する(自動)

`.github/workflows/deploy.yml` があるので、GitHub の `main` ブランチに上げるたびに
「テスト → 公開用フォルダづくり → 公開」が自動で行われます。

1. GitHub のアカウントを作り、GitHub Desktop を入れる
2. GitHub Desktop で「File → Add local repository」からこのフォルダを選び、リポジトリを作る(名前の例: `ot-kokushi`)
3. 「Publish repository」で GitHub に上げる(無料プランの GitHub Pages は **公開リポジトリ** が必要なので「Keep this code private」は外す)
4. GitHub のリポジトリの Settings → Pages → Source を「GitHub Actions」にする
5. 公開先: `https://<ユーザー名>.github.io/<リポジトリ名>/`(URL は自動で設定されます)

記事の書きかけが残っていると、公開の手前(公開用フォルダづくり)で止まり、何も公開されません。
進み具合はリポジトリの「Actions」タブで見られます。

カード画像を作り直す: `node scripts/make-ogp.mjs`

## アフィリエイトの設定

`src/config/site.ts` の `AFFILIATE` に、区分(実地問題・専門分野・専門基礎分野)ごとのおすすめ商品を書きます。

- 空のあいだは、体験談サイトの「参考書レビュー記事」への案内だけが出ます
- **実際に使った商品だけ** を入れてください(ステマ規制)
- アプリ内の広告枠には「PR」と表示されます

## 解説の追加

`public/data/explanations/<回>.json` に、問題IDごとに書きます。

```json
{
  "61A012": {
    "text": "全体の解説",
    "choiceNotes": ["1の解説", "2の解説", "3の解説", "4の解説", "5の解説"],
    "reviewed": false,
    "refs": ["根拠にした教科書・ガイドライン"]
  }
}
```

`reviewed: false` の解説には「未監修」と表示されます。内容を確認したら `true` にしてください。

## 問題データの作り方(`npm run data`)

`raw/mhlw/<回>/` に厚労省のPDF(問題・別冊・正答)を置いて実行します。処理は `scripts/extract/` にあります。

| 処理 | 内容 |
|---|---|
| `questions.mjs` | 問題PDFから文字を取り出し、問題ごとに分ける |
| `glyph-map.json` | 古い回のPDFで文字コードが壊れている数字・記号の対応表(画像を目で見て作成) |
| `questions-ocr.mjs` | 第53回は文字データがないので、Windows の OCR で読み取る(`ocr.ps1`) |
| `answers.mjs` | 正答PDFを読む(採点除外・複数正解も) |
| `bessatsu.mjs` / `bessatsu-map.json` | 別冊の図のページと「別冊No.」を対応させる |
| `build.mjs` | まとめて `public/data/` と `public/img/` を作る。正誤表の訂正もここ |
| `check.mjs` | 怪しいデータの一覧を出す |

第53回は OCR のため、アプリでは元の問題画像をメインに表示しています(文字版には誤字があります)。
古い回には、数字が文字データに入っていない箇所が少しあります(ページ上にインクがあるかで判定)。その問題も元の画像で表示し、答えは番号で選びます。

`npm test` では、アプリのロジックに加えて、できあがったデータ(2,000問そろっているか、正解の番号、画像ファイルの有無など)も検査します。

## 出典

問題・正答: 厚生労働省ホームページ「作業療法士国家試験の問題および正答について」(第52回〜第61回)を加工して作成。
厚生労働省ホームページのコンテンツは「公共データ利用規約(第1.0版)」に準拠して利用できます。アプリ内に出典と加工した旨を表示しています。
