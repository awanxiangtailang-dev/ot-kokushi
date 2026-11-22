// PDFの全ページを縮小して1枚の一覧画像にする(確認用)
// 使い方: node scripts/pdf-sheet.mjs <pdf> <出力png> [縮尺=0.25] [列数=6]
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";

const [, , file, out, scaleArg = "0.25", colsArg = "6"] = process.argv;
const scale = Number(scaleArg);
const cols = Number(colsArg);
const doc = await getDocument({
  data: new Uint8Array(readFileSync(file)),
  verbosity: 0,
  cMapUrl: "node_modules/pdfjs-dist/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
}).promise;
const first = await doc.getPage(1);
const vp0 = first.getViewport({ scale });
const w = Math.ceil(vp0.width);
const h = Math.ceil(vp0.height);
const rows = Math.ceil(doc.numPages / cols);
const sheet = createCanvas(cols * (w + 8), rows * (h + 22));
const sctx = sheet.getContext("2d");
sctx.fillStyle = "#ccc";
sctx.fillRect(0, 0, sheet.width, sheet.height);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale });
  const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const col = (p - 1) % cols;
  const row = Math.floor((p - 1) / cols);
  sctx.drawImage(c, col * (w + 8) + 4, row * (h + 22) + 18);
  sctx.fillStyle = "#000";
  sctx.font = "14px sans-serif";
  sctx.fillText(`p${p}`, col * (w + 8) + 6, row * (h + 22) + 14);
}
writeFileSync(out, sheet.toBuffer("image/png"));
console.log(`${doc.numPages} pages -> ${out}`);
