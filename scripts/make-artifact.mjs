// dist/ のビルド結果を、CSS と JS を埋め込んだ1枚の HTML(artifact/ot-quiz.html)にまとめる
// 使い方: npm run build:artifact
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");

const jsPath = html.match(/<script[^>]*src="\.?\/?([^"]+\.js)"/)?.[1];
const cssPath = html.match(/<link[^>]*href="\.?\/?([^"]+\.css)"/)?.[1];
if (!jsPath || !cssPath) throw new Error("dist/index.html から JS/CSS が見つかりません");

const js = readFileSync(join(dist, jsPath), "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(dist, cssPath), "utf8").replace(/<\/style/gi, "<\\/style");

const page = `<title>急性期OTクイズ</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

mkdirSync("artifact", { recursive: true });
writeFileSync(join("artifact", "ot-quiz.html"), page);
console.log(`artifact/ot-quiz.html を作成しました (${(page.length / 1024).toFixed(0)} KB)`);
