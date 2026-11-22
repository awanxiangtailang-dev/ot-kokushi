// PDFの中身を確認するための補助スクリプト
// 使い方: node scripts/pdf-dump.mjs <pdfのパス> [開始ページ] [終了ページ]
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const [, , file, from = "1", to = "3"] = process.argv;
const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0, cMapUrl: "node_modules/pdfjs-dist/cmaps/", cMapPacked: true, standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/" }).promise;
console.log(`pages: ${doc.numPages}`);
for (let p = Number(from); p <= Math.min(Number(to), doc.numPages); p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  console.log(`===== page ${p} =====`);
  let line = "";
  let lastY = null;
  for (const it of tc.items) {
    const y = Math.round(it.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      console.log(line);
      line = "";
    }
    line += it.str;
    lastY = y;
    if (it.hasEOL) {
      console.log(line);
      line = "";
      lastY = null;
    }
  }
  if (line) console.log(line);
}
