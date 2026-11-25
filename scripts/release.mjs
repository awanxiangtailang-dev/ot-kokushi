// 公開前のチェックと、公開用フォルダ(release/)づくり
//
// 使い方:
//   npm run release:check   … 公開前に残っている作業を一覧にする(何も作らない)
//   npm run release         … チェックに問題がなければ release/ を作る
//   npm run release -- --force  … 書きかけが残っていても release/ を作る(手元での確認用)
//
// 公開先の URL は site.config.json の siteUrl に書く(例: "https://ot-kokushi.example.com")
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const force = args.includes("--force");

const config = JSON.parse(readFileSync("site.config.json", "utf8"));
// GitHub Actions では環境変数 SITE_URL で渡す(site.config.json に書いてあればそちらを優先)
const siteUrl = String(config.siteUrl || process.env.SITE_URL || "").trim().replace(/\/$/, "");
// まだ公開しない記事(例: "articles/schedule.html")。公開用フォルダに入れず、リンクも消す
const drafts = (config.drafts ?? []).map((p) => String(p).replace(/^\//, ""));
const isDraft = (name) => drafts.includes(name);

// ───────── チェック ─────────
const blocking = []; // 公開前に必ず直すもの
const notes = []; // 直さなくても公開はできるもの

if (!siteUrl) blocking.push("site.config.json の siteUrl(公開先の URL)が空です");
else if (!/^https:\/\//.test(siteUrl)) blocking.push(`siteUrl は https:// で始まる URL にしてください(今: ${siteUrl})`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "app" ? [] : walk(p);
    return [p];
  });
}
// 過去問の解説ページを最新のデータから作り直す(ot-site/kakomon/)
execSync("node scripts/make-pages.mjs", { stdio: "inherit" });
// 書きかけのチェックは、自分で書くページだけ(自動で作る解説ページは除く)
// (drafts に入れた記事は、公開しないのでチェックしない)
const htmlFiles = walk("ot-site").filter(
  (f) => f.endsWith(".html") && !/[\\/]kakomon[\\/]/.test(f) && !isDraft(relative("ot-site", f).replaceAll("\\", "/")),
);
if (drafts.length) notes.push(`まだ公開しない記事(site.config.json の drafts): ${drafts.join("、")}`);
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const name = relative("ot-site", file).replaceAll("\\", "/");
  const todo = (html.match(/class="todo"/g) ?? []).length;
  const brackets = [...new Set(html.match(/【[^】]*】/g) ?? [])];
  const emptyLinks = (html.match(/href="#"/g) ?? []).length;
  if (todo) blocking.push(`${name}: 「自分で書く」の枠が ${todo} か所残っています`);
  if (brackets.length) blocking.push(`${name}: 【 】の書きかけが ${brackets.length} 種類あります(例: ${brackets.slice(0, 3).join(" ")})`);
  if (emptyLinks) blocking.push(`${name}: リンク先が「#」のままのボタンが ${emptyLinks} 個あります(アフィリエイトのリンクを入れる)`);
}

const siteTs = readFileSync("src/config/site.ts", "utf8");
if (!/items:\s*\[\s*\{/.test(siteTs)) notes.push("アプリ内のおすすめ商品(src/config/site.ts の AFFILIATE)がまだ空です。空のあいだは参考書レビュー記事への案内だけが出ます");

let unreviewed = 0;
let explained = 0;
for (const f of existsSync("public/data/explanations") ? readdirSync("public/data/explanations") : []) {
  const ex = JSON.parse(readFileSync(join("public/data/explanations", f), "utf8"));
  for (const v of Object.values(ex)) {
    explained++;
    if (!v.reviewed) unreviewed++;
  }
}
notes.push(`解説: ${explained} 問ぶん(そのうち未監修 ${unreviewed} 問。アプリでは「未監修」と表示されます)`);
notes.push("別冊の写真などに国以外の権利が含まれていないか、気になる場合は厚生労働省 医政局 医事課 試験免許室に確認すると安心です");

console.log("\n■ 公開前に直すもの");
console.log(blocking.length ? blocking.map((b) => `  ✗ ${b}`).join("\n") : "  なし");
console.log("\n■ 確認しておくこと");
console.log(notes.map((n) => `  ・${n}`).join("\n"));

if (checkOnly) process.exit(0);
if (blocking.length && !force) {
  console.log("\n直すものが残っているので、公開用フォルダは作りませんでした。(手元で確認するだけなら --force)");
  process.exit(1);
}

// ───────── 公開用フォルダを作る ─────────
const url = siteUrl || "http://localhost:4173";
console.log(`\nアプリをビルドします(公開先: ${url})`);
execSync("npx tsc --noEmit && npx vite build", { stdio: "inherit", env: { ...process.env, VITE_SITE_URL: url, VITE_DRAFTS: drafts.join(",") } });

rmSync("release", { recursive: true, force: true });
cpSync("ot-site", "release", {
  recursive: true,
  filter: (src) => !/[\\/]ot-site[\\/]app([\\/]|$)/.test(src) && !isDraft(relative("ot-site", src).replaceAll("\\", "/")),
});
cpSync("dist", "release/app", { recursive: true });

// %SITE_URL% を本物の URL に置きかえる
// 「<!-- 記事: articles/xxx.html -->…<!-- /記事 -->」で囲んだ部分は、書いてある記事がすべて未公開なら消す
// (walk は app/ を飛ばすので、アプリのフォルダは別に足す)
const leftover = [];
for (const file of [...walk("release"), ...walk("release/app")].filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf8")
    .replace(/<!-- 記事: ([^>]*?) -->([\s\S]*?)<!-- \/記事 -->/g, (_, list, inner) => (list.split(/\s+/).every(isDraft) ? "" : inner))
    .replaceAll("%SITE_URL%", url)
    .replaceAll("__SITE_URL__", url);
  writeFileSync(file, html);
  for (const d of drafts) if (html.includes(d.split("/").pop())) leftover.push(`${relative("release", file)} → ${d}`);
}
if (leftover.length) {
  console.log(`\n✗ 未公開の記事へのリンクが残っています:\n  ${leftover.join("\n  ")}`);
  process.exit(1);
}

// 検索エンジン向け(drafts は htmlFiles に入っていないので、サイトマップにも入らない)
const pages = htmlFiles.map((f) => relative("ot-site", f).replaceAll("\\", "/"));
// 解説ページは、検索に出すもの(監修済みの解説と一覧ページ)だけをサイトマップに入れる
const { indexable } = JSON.parse(readFileSync("ot-site/kakomon/pages.json", "utf8"));
const urls = [...pages.map((p) => `${url}/${p === "index.html" ? "" : p}`), `${url}/app/`, ...indexable.map((p) => `${url}/${p}`)];
writeFileSync(
  "release/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`,
);
// GitHub Pages で「_」で始まるファイルなどが消されないように
writeFileSync("release/.nojekyll", "");
writeFileSync("release/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`);
// 独自ドメインのときは CNAME を置く(GitHub Pages がドメインを覚えておくため)
const host = siteUrl ? new URL(siteUrl).host : "";
if (host && !host.endsWith("github.io")) writeFileSync("release/CNAME", host + "\n");

const files = walk("release").length + walk("release/app").length;
const size = [...walk("release"), ...walk("release/app")].reduce((s, f) => s + statSync(f).size, 0);
console.log(`\nrelease/ を作りました(${files} ファイル、${(size / 1024 / 1024).toFixed(1)} MB)。このフォルダをまるごと公開します。`);
if (blocking.length) console.log("※ 書きかけが残っている状態です(--force)。このままは公開しないでください。");
