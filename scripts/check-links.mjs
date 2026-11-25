// 公開用フォルダ(release/)の中のリンク切れを調べる
// 使い方: node scripts/check-links.mjs [フォルダ]   (npm run release でも自動で実行)
// - href / src が、フォルダの中のファイルを指しているかを確かめる(外のサイトへのリンクは見ない)
// - 「#」だけのリンクや、%SITE_URL% が残っていないかも見る
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "release");
if (!existsSync(root)) {
  console.error(`${root} がありません。先に npm run release を実行してください`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const htmlFiles = walk(root).filter((f) => f.endsWith(".html"));
const broken = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const name = relative(root, file).replaceAll("\\", "/");
  if (html.includes("%SITE_URL%") || html.includes("__SITE_URL__")) broken.push(`${name}: %SITE_URL% が置きかわっていません`);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const url = m[1];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url)) continue;
    if (url === "#") continue; // 書きかけのボタンは release.mjs のチェックで見る
    if (url.startsWith("#")) continue;
    const path = decodeURIComponent(url.split(/[?#]/)[0]);
    if (!path) continue;
    let target = path.startsWith("/") ? join(root, path) : join(dirname(file), path);
    if (path.endsWith("/") || (existsSync(target) && statSync(target).isDirectory())) target = join(target, "index.html");
    checked++;
    if (!existsSync(target)) broken.push(`${name} → ${url}`);
  }
}

if (broken.length) {
  console.log(`✗ リンク切れが ${broken.length} 件あります:`);
  for (const b of [...new Set(broken)].slice(0, 50)) console.log(`  ${b}`);
  process.exit(1);
}
console.log(`リンク切れなし(${htmlFiles.length} ページ・${checked} 本のリンクを確認)`);
