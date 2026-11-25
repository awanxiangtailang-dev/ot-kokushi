// 臨床ノート(運営者の臨床経験のブログ)を作る
// 入力: content/rinsho/*.md(1記事1ファイル。「_」で始まるファイルはひな形なので使わない)
// 出力: ot-site/rinsho/index.html(一覧)、ot-site/rinsho/<ファイル名>.html(記事)、ot-site/rinsho/pages.json(サイトマップ用)
// 使い方: node scripts/make-blog.mjs   (npm run build:site / npm run release でも自動で実行)
//
// 記事の書き方は content/rinsho/_ひな形.md を見る。
// - draft: true の記事は作らない(書きかけ)
// - 記事が1本もないあいだは、一覧ページは検索に出さない(noindex)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "content/rinsho";
const OUT = "ot-site/rinsho";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 先頭の「---」で囲んだ部分(タイトルなど)と本文に分ける */
export function parsePost(raw) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error("先頭に --- で囲んだ title などがありません");
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  meta.draft = /^(true|はい|yes)$/i.test(meta.draft ?? "");
  meta.tags = (meta.tags ?? "").split(/[,、]/).map((t) => t.trim()).filter(Boolean);
  return { meta, body: m[2] };
}

/** かんたんな Markdown(見出し・段落・箇条書き・引用・太字・リンク)を HTML にする */
export function mdToHtml(md) {
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[./][^)\s]*)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' rel="noopener" target="_blank"' : ""}>${t}</a>`);
  const out = [];
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    const h = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
    if (h && lines.length === 1) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (lines.every((l) => /^\s*[-・]\s+/.test(l))) out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-・]\s+/, ""))}</li>`).join("")}</ul>`);
    else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`);
    else if (lines.every((l) => /^>\s?/.test(l))) out.push(`<blockquote><p>${lines.map((l) => inline(l.replace(/^>\s?/, ""))).join("<br>")}</p></blockquote>`);
    else if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`, `<p>${lines.slice(1).map(inline).join("<br>")}</p>`);
    else out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
  }
  return out.join("\n    ");
}

/** 紹介文用に、本文から見出しと記号を除いた文字だけにする */
export function plainText(md) {
  return md
    .split(/\r?\n/)
    .filter((l) => !/^#{1,6}\s/.test(l))
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-・>]\s+|\s[-・>]\s+|\s\d+[.)]\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function layout({ depth, title, description, canonicalPath, noindex, body, breadcrumb, jsonLd }) {
  const up = "../".repeat(depth);
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumb.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: `%SITE_URL%/${b.path}` })),
  };
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
  <script type="application/ld+json">${JSON.stringify(crumbs)}</script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
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

const PRIVACY_NOTE =
  '<p class="meta">※ 症例は、患者さんが特定されないよう、年齢・経過などの細部を変えて書いています。</p>';

export function build() {
  const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith(".md") && !f.startsWith("_")) : [];
  const posts = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, "");
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${SRC}/${f}: ファイル名は半角の英小文字・数字・ハイフンだけにしてください(URL になります)`);
    const parsed = parsePost(readFileSync(`${SRC}/${f}`, "utf8"));
    const meta = parsed.meta;
    const body = parsed.body.replace(/<!--[\s\S]*?-->/g, ""); // ひな形のメモ(<!-- -->)は出さない
    if (meta.draft) continue;
    for (const k of ["title", "date"]) if (!meta[k]) throw new Error(`${SRC}/${f}: ${k} がありません`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${SRC}/${f}: date は 2026-12-01 の形にしてください`);
    posts.push({ slug, ...meta, html: mdToHtml(body), text: plainText(body) });
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const indexable = [];

  for (const p of posts) {
    const path = `rinsho/${p.slug}.html`;
    indexable.push(path);
    const description = p.description || p.text.slice(0, 100);
    writeFileSync(
      `${OUT}/${p.slug}.html`,
      layout({
        depth: 1,
        title: `${p.title}｜臨床ノート｜OT国試ノート`,
        description,
        canonicalPath: path,
        noindex: false,
        breadcrumb: [
          { name: "ホーム", path: "index.html" },
          { name: "臨床ノート", path: "rinsho/" },
          { name: p.title, path },
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: p.title,
          datePublished: p.date,
          ...(p.updated ? { dateModified: p.updated } : {}),
          author: { "@type": "Person", name: "ねこだんご", jobTitle: "作業療法士", url: "%SITE_URL%/about.html" },
        },
        body: `
    <p class="meta">${esc(p.date.replaceAll("-", "/"))}${p.updated ? `(更新 ${esc(p.updated.replaceAll("-", "/"))})` : ""}・ねこだんご(作業療法士)${p.tags.length ? " ・ " + p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ") : ""}</p>
    <h1>${esc(p.title)}</h1>
    ${p.html}
    ${PRIVACY_NOTE}
    <a class="back" href="./">← 臨床ノートの一覧へ</a>`,
      }),
    );
  }

  indexable.unshift("rinsho/");
  writeFileSync(
    `${OUT}/index.html`,
    layout({
      depth: 1,
      title: "臨床ノート｜現役作業療法士の臨床の話｜OT国試ノート",
      description: "現役の作業療法士が、臨床で経験したこと・国試の知識が現場でどう役立ったかを書いています。",
      canonicalPath: "rinsho/",
      // 記事がないうちは、中身の薄いページとして検索に出さない
      noindex: posts.length === 0,
      breadcrumb: [
        { name: "ホーム", path: "index.html" },
        { name: "臨床ノート", path: "rinsho/" },
      ],
      body: `
    <h1>臨床ノート</h1>
    <p>現役の作業療法士が、臨床で経験したことを書いています。国試で覚えた知識が、現場でどう役に立つのかも紹介します。</p>
    ${
      posts.length
        ? `<div class="cards">
      ${posts
        .map(
          (p) => `<a class="card" href="${p.slug}.html">
        <div class="card-body">
          <span class="tag">${esc(p.date.replaceAll("-", "/"))}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description || p.text.slice(0, 60) + "…")}</p>
        </div>
      </a>`,
        )
        .join("\n      ")}
    </div>`
        : "<p>記事は準備中です。</p>"
    }`,
    }),
  );
  writeFileSync(`${OUT}/pages.json`, JSON.stringify({ indexable: posts.length ? indexable : [] }, null, 1));
  console.log(`臨床ノート ${posts.length} 本を ${OUT}/ に作りました`);
  return posts;
}

// node scripts/make-blog.mjs で直接動かしたときだけ作る(テストから読み込んだときは作らない)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
