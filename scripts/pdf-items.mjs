// テキスト項目の生データ(位置・フォント)を表示する補助スクリプト
// 使い方: node scripts/pdf-items.mjs <pdf> <ページ>
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const [, , file, pageNo = "1"] = process.argv;
const doc = await getDocument({
  data: new Uint8Array(readFileSync(file)),
  verbosity: 0,
  cMapUrl: "node_modules/pdfjs-dist/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
}).promise;
const page = await doc.getPage(Number(pageNo));
const tc = await page.getTextContent({ includeMarkedContent: false });
const ops = await page.getOperatorList();
const { OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const names = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));
const counts = {};
for (const fn of ops.fnArray) counts[names[fn]] = (counts[names[fn]] || 0) + 1;
console.log("ops:", JSON.stringify(counts));
console.log("fonts:", JSON.stringify(Object.fromEntries(Object.entries(tc.styles).map(([k, v]) => [k, v.fontFamily]))));
for (const it of tc.items.slice(0, 60)) {
  console.log(JSON.stringify({ s: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), w: Math.round(it.width), f: it.fontName }));
}
