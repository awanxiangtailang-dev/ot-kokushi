// 体験談サイトの各ページに、共有用のタグ(OGP・Xカード)とアイコンを入れる(1回だけ実行)
// URL の部分は %SITE_URL% にしておき、公開用フォルダを作るとき(scripts/release.mjs)に本物の URL に置きかえる
import { readFileSync, writeFileSync } from "node:fs";

const pages = ["index.html", "about.html", "privacy.html", "articles/schedule.html", "articles/textbooks.html"];

for (const page of pages) {
  const file = `ot-site/${page}`;
  let html = readFileSync(file, "utf8");
  if (html.includes('property="og:title"')) {
    console.log(`${page}: すでに入っています`);
    continue;
  }
  const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? "OT国試ノート";
  const desc =
    html.match(/<meta name="description" content="(.*?)">/)?.[1] ??
    "現役の作業療法士が、国家試験の勉強法・使った参考書・失敗談を体験ベースで紹介するサイトです。";
  const depth = page.split("/").length - 1;
  const up = "../".repeat(depth);
  const url = `%SITE_URL%/${page === "index.html" ? "" : page}`;
  const tags = [
    `  <link rel="icon" href="${up}favicon.svg" type="image/svg+xml">`,
    `  <meta property="og:type" content="${page === "index.html" ? "website" : "article"}">`,
    `  <meta property="og:site_name" content="OT国試ノート">`,
    `  <meta property="og:title" content="${title}">`,
    `  <meta property="og:description" content="${desc}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="%SITE_URL%/ogp.png">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <link rel="canonical" href="${url}">`,
  ].join("\n");
  html = html.replace(/(\s*<link rel="stylesheet"[^>]*>)/, `$1\n${tags}`);
  writeFileSync(file, html);
  console.log(`${page}: 追加しました`);
}
