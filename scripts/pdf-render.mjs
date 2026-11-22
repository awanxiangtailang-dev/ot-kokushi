// PDFのページを画像(PNG)にする
// 使い方: node scripts/pdf-render.mjs <pdf> <出力フォルダ> [倍率=2] [開始ページ] [終了ページ]
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [, , file, outDir, scaleArg = "2", from = "1", to = "9999"] = process.argv;
const scale = Number(scaleArg);
mkdirSync(outDir, { recursive: true });
const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0, cMapUrl: "node_modules/pdfjs-dist/cmaps/", cMapPacked: true, standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/" }).promise;
const last = Math.min(Number(to), doc.numPages);
for (let p = Number(from); p <= last; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  writeFileSync(join(outDir, `p${String(p).padStart(3, "0")}.png`), canvas.toBuffer("image/png"));
  page.cleanup();
}
console.log(`rendered ${last - Number(from) + 1} pages -> ${outDir}`);
