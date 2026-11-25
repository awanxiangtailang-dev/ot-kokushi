// 過去問の解説ページ(1問1ページ)と、回ごとの一覧ページを作る(検索から人が来る入口)
// 出力: ot-site/kakomon/index.html, ot-site/kakomon/<回>/index.html, ot-site/kakomon/<回>/<a|b><番号>.html
//       ot-site/kakomon/pages.json(サイトマップ用に、検索に出すページの一覧)
// 使い方: node scripts/make-pages.mjs   (npm run build:site / npm run release でも自動で実行)
//
// - 解説がある問題だけページを作る(問題を写しただけのページは作らない)
// - 解説が「未監修」の問題は検索に出さない(noindex)。監修済み(reviewed: true)にすると検索に出る
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

const OUT = "ot-site/kakomon";
const index = JSON.parse(readFileSync("public/data/index.json", "utf8"));
// 回の範囲は public/data/index.json から(新しい回が入ったら自動で「第52回〜第62回」のように変わる)
const examNos = index.exams.map((e) => e.exam);
const RANGE = `第${Math.min(...examNos)}回〜第${Math.max(...examNos)}回`;
const TOTAL_Q = index.exams.reduce((s, e) => s + e.count, 0).toLocaleString();
// まだ公開しない記事(site.config.json の drafts)へのリンクは出さない
const drafts = existsSync("site.config.json") ? (JSON.parse(readFileSync("site.config.json", "utf8")).drafts ?? []) : [];
const textbooksReady = !drafts.includes("articles/textbooks.html");
// 合格発表の数字(厚労省)。content/goukaku.json
const goukaku = existsSync("content/goukaku.json") ? JSON.parse(readFileSync("content/goukaku.json", "utf8")).exams : [];
const goukakuOf = new Map(goukaku.map((g) => [g.exam, g]));
const pct = (a, b) => Math.round((a / b) * 1000) / 10;
/** 回ごとの一覧ページに出す、合格率と合格基準の1行 */
const goukakuLine = (g, depth) =>
  g
    ? `<p class="exam-result">合格率 <strong>${g.rate}%</strong>(新卒 ${g.newRate.toFixed(1)}%)・合格基準: 総得点 ${g.totalLine}点以上/${g.totalMax}点、実地問題 ${g.practicalLine}点以上/${g.practicalMax}点 <a href="${"../".repeat(depth - 1)}goukaku.html">合格率の推移 →</a></p>`
    : "";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(3, "0");
const fileOf = (q) => `${q.session === "午前" ? "a" : "b"}${pad(q.no)}.html`;
const answerLabel = (q) =>
  q.excluded || !q.answers.length
    ? "採点除外(全員正解)"
    : q.answers.length === 1
      ? q.answers[0].join(" と ")
      : `${q.answers.map((s) => s.join(" と ")).join(" / ")}(どれでも正解)`;
const plain = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

/** 問題をさがす欄(アプリの検索画面を開く) */
const searchForm = (depth) => `<form class="site-search" action="${"../".repeat(depth)}app/" method="get" role="search">
      <input type="search" name="search" placeholder="キーワード(例: FIM)や 問題番号(例: 60A21)" aria-label="過去問をさがす" required>
      <button type="submit">さがす</button>
    </form>`;

/** ページの共通部分(depth = ot-site から何階層下か) */
function layout({ depth, title, description, canonicalPath, noindex, body, breadcrumb }) {
  const up = "../".repeat(depth);
  const crumbs = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumb.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: `%SITE_URL%/${b.path}` })),
  });
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">\n  ' : ""}<link rel="stylesheet" href="${up}style.css">
  <link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="OT国試ノート">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="%SITE_URL%/${canonicalPath}">
  <meta property="og:image" content="%SITE_URL%/ogp.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="%SITE_URL%/${canonicalPath}">
  <script type="application/ld+json">${crumbs}</script>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="logo" href="${up}index.html"><span>国試</span>ノート</a>
      <nav class="nav">
        <a href="${up}kakomon/">過去問解説</a>
        <a href="${up}rinsho/">臨床ノート</a>
        <a href="${up}app/">アプリ</a>
        <a href="${up}about.html">運営者</a>
      </nav>
    </div>
  </header>
  <main class="wrap article">
    <nav class="crumbs" aria-label="パンくずリスト">${breadcrumb
      .map((b, i) => (i < breadcrumb.length - 1 ? `<a href="${up}${b.path}">${esc(b.name)}</a>` : `<span>${esc(b.name)}</span>`))
      .join(" › ")}</nav>
${body}
    <p class="source">出典: 厚生労働省ホームページ「作業療法士国家試験の問題および正答について」をもとに、問題文・図を加工して掲載しています。解説は本サイト独自のものです。</p>
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <div class="links">
        <a href="${up}kakomon/">過去問解説</a>
        <a href="${up}rinsho/">臨床ノート</a>
        <a href="${up}app/">過去問アプリ</a>
        <a href="${up}about.html">運営者情報</a>
        <a href="${up}privacy.html">プライバシーポリシー・免責事項</a>
      </div>
      <p>Amazonのアソシエイトとして、OT国試ノートは適格販売により収入を得ています。</p>
      <p>© OT国試ノート</p>
    </div>
  </footer>
</body>
</html>
`;
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
const indexable = ["kakomon/"];
const examSummaries = [];

for (const e of index.exams) {
  const data = JSON.parse(readFileSync(`public/data/exams/${e.exam}.json`, "utf8"));
  const exFile = `public/data/explanations/${e.exam}.json`;
  const ex = existsSync(exFile) ? JSON.parse(readFileSync(exFile, "utf8")) : {};
  const qs = data.questions;
  const withEx = qs.filter((q) => ex[q.id]);
  examSummaries.push({ exam: e.exam, year: e.year, total: qs.length, explained: withEx.length, reviewed: withEx.filter((q) => ex[q.id].reviewed).length });
  if (!withEx.length) continue;
  mkdirSync(`${OUT}/${e.exam}`, { recursive: true });

  // ── 1問1ページ ──
  withEx.forEach((q, i) => {
    const x = ex[q.id];
    const title = `第${e.exam}回 作業療法士国家試験 ${q.session} 問${q.no} 解答・解説｜OT国試ノート`;
    const description = `第${e.exam}回(${e.year}年)作業療法士国家試験 ${q.session}${q.no}の正解と解説。${plain(q.stem, 70)}`;
    const path = `kakomon/${e.exam}/${fileOf(q)}`;
    if (x.reviewed) indexable.push(path);
    const imgs = [q.image, ...(q.bessatsu ?? [])].filter(Boolean);
    const prev = withEx[i - 1];
    const next = withEx[i + 1];
    const body = `
    <p class="pr-note">本サイトはアフィリエイト広告（PR）を利用しています</p>
    <p class="meta"><span class="tag">${esc(q.part)}</span> 第${e.exam}回（${e.year}年）${q.session} 問${q.no}${q.pick === 2 ? '・<strong>2つ選ぶ</strong>' : ""}</p>
    <h1>第${e.exam}回 ${q.session} 問${q.no}の解答・解説</h1>
    <section class="q-box">
      ${q.caseText ? `<p class="q-case">${esc(q.caseText)}</p>` : ""}
      <p class="q-stem">${esc(q.stem)}</p>
      ${imgs.map((src) => `<img class="q-img" src="../../app/${esc(src)}" alt="第${e.exam}回${q.session}問${q.no}の図" loading="lazy">`).join("\n      ")}
      ${q.choicesFromImage ? "<p class=\"q-note\">選択肢は上の図の番号です。</p>" : `<ol class="q-choices">${q.choices.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>`}
      <a class="q-try" href="../../app/?q=${esc(q.id)}">アプリでこの問題を解く →</a>
    </section>
    <details class="q-answer">
      <summary>正解と解説を見る</summary>
      <p class="q-correct">正解: <strong>${esc(answerLabel(q))}</strong></p>
      ${q.excluded ? "<p>この問題は厚生労働省の発表で採点除外(全員正解扱い)になりました。</p>" : ""}
      <h2>解説${x.reviewed ? "" : '<span class="unreviewed">未監修</span>'}</h2>
      <p>${esc(x.text)}</p>
      ${x.choiceNotes ? `<ol class="q-notes">${x.choiceNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>` : ""}
      ${x.refs?.length ? `<p class="meta">参考: ${esc(x.refs.join(" / "))}</p>` : ""}
    </details>
    <nav class="q-nav">
      ${prev ? `<a href="${fileOf(prev)}">← ${prev.session} 問${prev.no}</a>` : "<span></span>"}
      <a href="./">第${e.exam}回の一覧</a>
      ${next ? `<a href="${fileOf(next)}">${next.session} 問${next.no} →</a>` : "<span></span>"}
    </nav>
    ${
      textbooksReady
        ? `<a class="app-banner" href="../../articles/textbooks.html">
      <span class="tag">PR</span>
      <strong>現役OTが国試で使った参考書を見る</strong>
      <span>苦手な分野を、効率よく復習するために。</span>
    </a>`
        : `<a class="app-banner" href="../../app/">
      <span class="tag">無料・登録なし</span>
      <strong>過去問アプリで、ほかの問題も解いてみる</strong>
      <span>${RANGE}の${TOTAL_Q}問。苦手な問題は自動で復習に回ります。</span>
    </a>`
    }`;
    writeFileSync(
      `${OUT}/${e.exam}/${fileOf(q)}`,
      layout({
        depth: 2,
        title,
        description,
        canonicalPath: path,
        noindex: !x.reviewed,
        body,
        breadcrumb: [
          { name: "ホーム", path: "index.html" },
          { name: "過去問解説", path: "kakomon/" },
          { name: `第${e.exam}回`, path: `kakomon/${e.exam}/` },
          { name: `${q.session} 問${q.no}`, path },
        ],
      }),
    );
  });

  // ── 回ごとの一覧ページ ──
  const list = (session) =>
    qs
      .filter((q) => q.session === session)
      .map((q) => {
        const label = `<span class="no">問${q.no}</span> ${esc(plain((q.caseText ? "" : "") + q.stem, 46))}`;
        return ex[q.id] ? `<li><a href="${fileOf(q)}">${label}</a></li>` : `<li class="no-ex">${label} <a href="../../app/?q=${esc(q.id)}">アプリで解く</a></li>`;
      })
      .join("\n        ");
  const path = `kakomon/${e.exam}/`;
  indexable.push(path);
  writeFileSync(
    `${OUT}/${e.exam}/index.html`,
    layout({
      depth: 2,
      title: `第${e.exam}回(${e.year}年) 作業療法士国家試験 問題・解答・解説一覧｜OT国試ノート`,
      description: `第${e.exam}回(${e.year}年)作業療法士国家試験の午前・午後200問の一覧。正答は厚生労働省の発表どおり。現役作業療法士による解説つき。`,
      canonicalPath: path,
      noindex: false,
      breadcrumb: [
        { name: "ホーム", path: "index.html" },
        { name: "過去問解説", path: "kakomon/" },
        { name: `第${e.exam}回`, path },
      ],
      body: `
    <h1>第${e.exam}回（${e.year}年）作業療法士国家試験 問題・解答・解説</h1>
    <p>午前・午後あわせて${qs.length}問。正答は厚生労働省の発表どおりです。解説は現役の作業療法士が書いています（${withEx.length}問に解説あり）。</p>
    ${goukakuLine(goukakuOf.get(e.exam), 2)}
    <p><a class="q-try" href="../../app/">アプリで第${e.exam}回を解く →</a></p>
    ${searchForm(2)}
    <h2>午前</h2>
    <ol class="q-list">
        ${list("午前")}
    </ol>
    <h2>午後</h2>
    <ol class="q-list">
        ${list("午後")}
    </ol>`,
    }),
  );
}

// ── 次の試験の情報ページ(問題データが入るまで、同じURLに出しておく) ──
const next = existsSync("content/next-exam.json") ? JSON.parse(readFileSync("content/next-exam.json", "utf8")) : null;
const nextReady = next && !index.exams.some((e) => e.exam === next.exam);
if (nextReady) {
  const recent = [...goukaku].sort((a, b) => b.exam - a.exam).slice(0, 3);
  const path = `kakomon/${next.exam}/`;
  indexable.push(path);
  mkdirSync(`${OUT}/${next.exam}`, { recursive: true });
  writeFileSync(
    `${OUT}/${next.exam}/index.html`,
    layout({
      depth: 2,
      title: `第${next.exam}回(${next.year}年) 作業療法士国家試験 日程・合格基準の目安・解答解説｜OT国試ノート`,
      description: `第${next.exam}回作業療法士国家試験は${next.writtenDateLabel}。試験地、合格発表の時期、過去の合格基準の目安をまとめました。問題・正答が公表されたら、このページで解説を公開します。`,
      canonicalPath: path,
      noindex: false,
      breadcrumb: [
        { name: "ホーム", path: "index.html" },
        { name: "過去問解説", path: "kakomon/" },
        { name: `第${next.exam}回`, path },
      ],
      body: `
    <h1>第${next.exam}回（${next.year}年）作業療法士国家試験</h1>
    <p>試験の日程と、合格基準の目安をまとめました。試験のあと、厚生労働省から問題と正答が公表されたら、このページに全問の解答・解説を載せます。</p>

    <h2>日程・試験地</h2>
    <div class="table-wrap">
    <table class="data-table info">
      <tbody>
        <tr><td>筆記試験</td><td>${esc(next.writtenDateLabel)}</td></tr>
        <tr><td>筆記試験の試験地</td><td>${esc(next.places.join("、"))}</td></tr>
        <tr><td>口述試験・実技試験</td><td>${esc(next.oralDateLabel)}(${esc(next.oralPlaces.join("、"))})</td></tr>
        <tr><td>合格発表</td><td>例年3月下旬(第61回は2026年3月23日)</td></tr>
        <tr><td>問題・正答の公表</td><td>例年4月下旬ごろ(厚生労働省のホームページ)</td></tr>
      </tbody>
    </table>
    </div>
    <p class="meta">出典: <a href="${esc(next.source)}" rel="noopener" target="_blank">厚生労働省「作業療法士国家試験の施行」</a>。会場は受験票といっしょに案内されます。最新の情報は厚生労働省のページで確認してください。</p>

    ${
      recent.length
        ? `<h2>合格基準の目安</h2>
    <p>合格基準は毎年発表されます。最近の回は次のとおりで、<strong>総得点のおよそ6割</strong>と<strong>実地問題のおよそ35%</strong>の両方が必要でした。</p>
    <ul>
      ${recent.map((g) => `<li>第${g.exam}回: 総得点 ${g.totalLine}点以上/${g.totalMax}点、実地問題 ${g.practicalLine}点以上/${g.practicalMax}点(合格率 ${g.rate}%)</li>`).join("\n      ")}
    </ul>
    <p><a href="../goukaku.html">合格率・合格基準の推移をくわしく見る →</a></p>`
        : ""
    }

    <h2>本番までに</h2>
    <p>過去${examNos.length}年分(${RANGE})の問題で、実力をたしかめておきましょう。</p>
    ${searchForm(2)}
    <p><a class="q-try" href="../../app/">過去問アプリで解く →</a></p>`,
    }),
  );
}

// ── 過去問解説のトップ ──
writeFileSync(
  `${OUT}/index.html`,
  layout({
    depth: 1,
    title: `作業療法士国家試験 過去問の解答・解説一覧(${RANGE})｜OT国試ノート`,
    description: `作業療法士国家試験の過去問${examNos.length}年分(${RANGE})の解答・解説。正答は厚生労働省の発表どおり。現役作業療法士による解説。`,
    canonicalPath: "kakomon/",
    noindex: false,
    breadcrumb: [
      { name: "ホーム", path: "index.html" },
      { name: "過去問解説", path: "kakomon/" },
    ],
    body: `
    <h1>作業療法士国家試験 過去問の解答・解説</h1>
    <p>${RANGE}の${examNos.length}年分。正答は厚生労働省の発表どおりです。解説は、新しい回から順に追加しています。</p>
    ${searchForm(1)}
    ${nextReady ? `<p><a href="${next.exam}/">第${next.exam}回(${next.year}年)の日程・合格基準の目安 →</a></p>` : ""}
    ${goukaku.length ? `<p><a href="goukaku.html">合格率・合格基準の推移 →</a></p>` : ""}
    <ul class="exam-list">
      ${examSummaries
        .map((s) =>
          s.explained
            ? `<li><a href="${s.exam}/"><strong>第${s.exam}回</strong>（${s.year}年）<span>解説 ${s.explained}/${s.total}問</span></a></li>`
            : `<li class="no-ex"><strong>第${s.exam}回</strong>（${s.year}年）<span>解説は準備中・<a href="../app/">アプリで解く</a></span></li>`,
        )
        .join("\n      ")}
    </ul>`,
  }),
);

// ── 合格率・合格基準の推移 ──
if (goukaku.length) {
  const rows = [...goukaku].sort((a, b) => b.exam - a.exam);
  const yearOf = new Map(index.exams.map((e) => [e.exam, e.year]));
  const rates = rows.map((g) => g.rate);
  const newest = rows[0];
  const oldest = rows[rows.length - 1];
  const maxRate = Math.max(...rates);
  const minRate = Math.min(...rates);
  const lowRow = rows.find((g) => g.rate === minRate);
  const totalPcts = rows.map((g) => pct(g.totalLine, g.totalMax));
  const pracPcts = rows.map((g) => pct(g.practicalLine, g.practicalMax));
  // 「60〜60%」のようにならないよう、整数にして同じなら1つだけ書く
  const range = (list) => {
    const lo = Math.round(Math.min(...list));
    const hi = Math.round(Math.max(...list));
    return lo === hi ? `${lo}%` : `${lo}〜${hi}%`;
  };
  indexable.push("kakomon/goukaku.html");
  writeFileSync(
    `${OUT}/goukaku.html`,
    layout({
      depth: 1,
      title: `作業療法士国家試験の合格率・合格基準の推移(第${oldest.exam}回〜第${newest.exam}回)｜OT国試ノート`,
      description: `作業療法士国家試験の合格率・受験者数・合格基準を、厚生労働省の発表から回ごとにまとめました。第${newest.exam}回の合格率は${newest.rate}%(新卒${newest.newRate.toFixed(1)}%)。`,
      canonicalPath: "kakomon/goukaku.html",
      noindex: false,
      breadcrumb: [
        { name: "ホーム", path: "index.html" },
        { name: "過去問解説", path: "kakomon/" },
        { name: "合格率・合格基準", path: "kakomon/goukaku.html" },
      ],
      body: `
    <h1>作業療法士国家試験の合格率・合格基準の推移</h1>
    <p>厚生労働省の合格発表から、第${oldest.exam}回(${yearOf.get(oldest.exam)}年)〜第${newest.exam}回(${yearOf.get(newest.exam)}年)の数字をまとめました。</p>

    <h2>ポイント</h2>
    <ul>
      <li>第${newest.exam}回の合格率は <strong>${newest.rate}%</strong>、新卒は <strong>${newest.newRate.toFixed(1)}%</strong> でした。</li>
      <li>この${rows.length}回の合格率は <strong>${minRate}%〜${maxRate}%</strong>。いちばん低かったのは第${lowRow.exam}回(${lowRow.rate}%)です。年によって差があるので、「毎年8割受かるから大丈夫」とは言い切れません。</li>
      <li>合格基準は、<strong>総得点のおよそ${range(totalPcts)}</strong>と、<strong>実地問題のおよそ${range(pracPcts)}</strong>の両方を取ることです。総得点が足りていても、実地問題が基準に届かないと不合格になります。</li>
      <li>満点が年ごとに少しずつ違うのは、採点から除外された問題があるためです(一般問題1問1点、実地問題1問3点)。</li>
    </ul>

    <h2>合格率の推移</h2>
    <div class="rate-bars">
      ${rows
        .map(
          (g) => `<div class="rate-row"><span class="rate-label">第${g.exam}回</span><span class="rate-bar"><span style="width:${g.rate}%"></span></span><span class="rate-num">${g.rate}%</span></div>`,
        )
        .join("\n      ")}
    </div>

    <h2>受験者数・合格者数</h2>
    <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>回(年)</th><th>受験者数</th><th>合格者数</th><th>合格率</th><th>新卒 合格率</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (g) =>
              `<tr><td>第${g.exam}回(${yearOf.get(g.exam) ?? ""}年)</td><td>${g.examinees.toLocaleString()}人</td><td>${g.passed.toLocaleString()}人</td><td><strong>${g.rate}%</strong></td><td>${g.newRate.toFixed(1)}%</td></tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>
    </div>

    <h2>合格基準</h2>
    <p>次の2つを、両方とも満たすと合格です。</p>
    <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>回</th><th>総得点</th><th>実地問題</th><th>配点(満点)</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (g) =>
              `<tr><td>第${g.exam}回</td><td>${g.totalLine}点以上 / ${g.totalMax}点<br><small>(${pct(g.totalLine, g.totalMax)}%)</small></td><td>${g.practicalLine}点以上 / ${g.practicalMax}点<br><small>(${pct(g.practicalLine, g.practicalMax)}%)</small></td><td>一般 ${g.generalMax}点 + 実地 ${g.practicalMax}点</td></tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>
    </div>

    <h2>過去問で力をためす</h2>
    <p>合格基準の6割をこえられるか、過去問で確かめてみましょう。</p>
    ${searchForm(1)}
    <p><a class="q-try" href="../app/">過去問アプリを開く →</a></p>

    <p class="meta">出典: 厚生労働省「理学療法士国家試験及び作業療法士国家試験の合格発表について」(${rows
      .map((g) => `<a href="${esc(g.source)}" rel="noopener" target="_blank">第${g.exam}回</a>`)
      .join("・")})。数字はそのまま、割合(%)は本サイトで計算しました。</p>`,
    }),
  );
}

writeFileSync(`${OUT}/pages.json`, JSON.stringify({ indexable }, null, 1));
const total = examSummaries.reduce((s, x) => s + x.explained, 0);
console.log(`解説ページ ${total} 件(検索に出すもの ${indexable.length} 件)を ${OUT}/ に作りました`);
