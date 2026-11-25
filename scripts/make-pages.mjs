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
// まだ公開しない記事(site.config.json の drafts)へのリンクは出さない
const drafts = existsSync("site.config.json") ? (JSON.parse(readFileSync("site.config.json", "utf8")).drafts ?? []) : [];
const textbooksReady = !drafts.includes("articles/textbooks.html");

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
      <span>第52回〜第61回の2,000問。苦手な問題は自動で復習に回ります。</span>
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
    <p><a class="q-try" href="../../app/">アプリで第${e.exam}回を解く →</a></p>
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

// ── 過去問解説のトップ ──
writeFileSync(
  `${OUT}/index.html`,
  layout({
    depth: 1,
    title: "作業療法士国家試験 過去問の解答・解説一覧(第52回〜第61回)｜OT国試ノート",
    description: "作業療法士国家試験の過去問10年分(第52回〜第61回)の解答・解説。正答は厚生労働省の発表どおり。現役作業療法士による解説。",
    canonicalPath: "kakomon/",
    noindex: false,
    breadcrumb: [
      { name: "ホーム", path: "index.html" },
      { name: "過去問解説", path: "kakomon/" },
    ],
    body: `
    <h1>作業療法士国家試験 過去問の解答・解説</h1>
    <p>第52回〜第61回の10年分。正答は厚生労働省の発表どおりです。解説は、新しい回から順に追加しています。</p>
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

writeFileSync(`${OUT}/pages.json`, JSON.stringify({ indexable }, null, 1));
const total = examSummaries.reduce((s, x) => s + x.explained, 0);
console.log(`解説ページ ${total} 件(検索に出すもの ${indexable.length} 件)を ${OUT}/ に作りました`);
