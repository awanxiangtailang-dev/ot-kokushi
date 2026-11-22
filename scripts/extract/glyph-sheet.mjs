// 文字コードが壊れている文字を、拡大画像の一覧にする(目で見て対応表を作るため)
// 1行=1種類の文字。出現例を最大3つ並べる。
// 出力: extract-out/glyphs/<回><a|b>.png と .json(番号→キー)
// 使い方: node scripts/extract/glyph-sheet.mjs [回...]
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { openPdf, EXAMS, SESSIONS } from "./pdf.mjs";

const SCALE = 4;
const SAMPLE_W = 170;
const ROW_H = 58;
const LABEL_W = 50;
const targets = process.argv.slice(2).map(Number);
mkdirSync("extract-out/glyphs", { recursive: true });

for (const exam of targets.length ? targets : EXAMS) {
  for (const s of SESSIONS) {
    const qfile = `extract-out/q/${exam}${s.key}.json`;
    if (!existsSync(qfile)) continue;
    const { file, glyphs } = JSON.parse(readFileSync(qfile, "utf8"));
    const keys = Object.keys(glyphs).filter((k) => process.env.ALL_GLYPHS || !glyphs[k].mapped).sort();
    if (!keys.length) {
      console.log(`${exam}${s.key}: 0 glyphs`);
      continue;
    }
    const doc = await openPdf(file);
    // 2列に分けて並べる
    const perCol = Math.ceil(keys.length / 2);
    const colW = LABEL_W + SAMPLE_W * 3 + 20;
    const sheet = createCanvas(colW * 2, perCol * ROW_H + 4);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#fff";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    const pageCache = new Map();
    const getPage = async (n) => {
      if (pageCache.has(n)) return pageCache.get(n);
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      canvas.vp = vp;
      pageCache.set(n, canvas);
      return canvas;
    };
    for (const [i, key] of keys.entries()) {
      const ox = Math.floor(i / perCol) * colW;
      const oy = (i % perCol) * ROW_H + 2;
      sc.fillStyle = "#00c";
      sc.font = "bold 18px sans-serif";
      sc.fillText(`#${i}`, ox + 4, oy + 34);
      for (const [j, g] of glyphs[key].at.entries()) {
        const canvas = await getPage(g.page);
        const before = g.w * 2;
        const [px, py] = canvas.vp.convertToViewportPoint(g.x - before, g.y + g.h * 1.0);
        const sx = px;
        const sw = (g.w * 5) * SCALE;
        const sy = py;
        const sh = g.h * 1.35 * SCALE;
        const dx = ox + LABEL_W + j * SAMPLE_W;
        const dw = SAMPLE_W - 12;
        const dh = Math.min(ROW_H - 6, (sh * dw) / sw);
        sc.drawImage(canvas, sx, sy, sw, sh, dx, oy, dw, dh);
        sc.strokeStyle = "#e00";
        sc.lineWidth = 2;
        sc.strokeRect(dx + (before * dw) / (g.w * 5), oy, (g.w * dw) / (g.w * 5), dh);
      }
    }
    const out = `extract-out/glyphs/${exam}${s.key}`;
    writeFileSync(`${out}.png`, sheet.toBuffer("image/png"));
    writeFileSync(`${out}.json`, JSON.stringify(keys, null, 1));
    console.log(`${exam}${s.key}: ${keys.length} glyphs`);
  }
}
