// 別冊PDFの「図が載っているページ」を見つけ、問題文の「別冊No.」と数を突き合わせる
// 出力: extract-out/bessatsu/<回><a|b>.json  { contentPages: [...], refs: [...], map: { "1": [ページ] } }
//       数が合わないときは一覧画像 extract-out/bessatsu/<回><a|b>.png を見て
//       scripts/extract/bessatsu-map.json に手で対応を書く
// 使い方: node scripts/extract/bessatsu.mjs [回...]
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { openPdf, EXAMS, SESSIONS } from "./pdf.mjs";

const SCALE = 0.3;
const targets = process.argv.slice(2).map(Number);
mkdirSync("extract-out/bessatsu", { recursive: true });
const manual = existsSync("scripts/extract/bessatsu-map.json")
  ? JSON.parse(readFileSync("scripts/extract/bessatsu-map.json", "utf8"))
  : {};

for (const exam of targets.length ? targets : EXAMS) {
  for (const s of SESSIONS) {
    const key = `${exam}${s.key}`;
    const qs = JSON.parse(readFileSync(`extract-out/q/${key}.json`, "utf8")).questions;
    const refs = [...new Set(qs.flatMap((q) => q.bessatsu))].sort((a, b) => a - b);
    const doc = await openPdf(`raw/mhlw/${exam}/09${s.key}_02.pdf`);
    const ink = [];
    const thumbs = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: SCALE });
      const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      // 上下左右の端(トンボ・フッター)を除いた範囲の、白くない画素の割合
      const x0 = Math.floor(c.width * 0.06), x1 = Math.floor(c.width * 0.94);
      const y0 = Math.floor(c.height * 0.04), y1 = Math.floor(c.height * 0.85);
      const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] < 600) dark++;
      ink.push(dark / (data.length / 4));
      thumbs.push(c);
    }
    // 1ページ目は表紙。図のページは白くない画素が多い
    const contentPages = ink.map((v, i) => ({ p: i + 1, v })).filter((o) => o.p > 1 && o.v > 0.01).map((o) => o.p);
    let map = {};
    let status;
    if (manual[key] && !key.startsWith("_")) {
      map = manual[key];
      status = "手入力の対応表を使用";
    } else if (contentPages.length === refs.length) {
      refs.forEach((no, i) => (map[no] = { pages: [contentPages[i]] }));
      status = "自動で対応(数が一致)";
    } else status = `要確認: 図のページ ${contentPages.length} / 参照 ${refs.length}`;
    writeFileSync(`extract-out/bessatsu/${key}.json`, JSON.stringify({ contentPages, ink: ink.map((v) => +v.toFixed(3)), refs, map }, null, 1));

    // 確認用の一覧画像(ページ番号つき)
    const w = thumbs[0].width, h = thumbs[0].height, cols = 8;
    const rows = Math.ceil(thumbs.length / cols);
    const sheet = createCanvas(cols * (w + 6), rows * (h + 20));
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#bbb";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    thumbs.forEach((t, i) => {
      const x = (i % cols) * (w + 6) + 3, y = Math.floor(i / cols) * (h + 20) + 18;
      sc.drawImage(t, x, y);
      sc.fillStyle = contentPages.includes(i + 1) ? "#c00" : "#000";
      sc.font = "bold 14px sans-serif";
      sc.fillText(`p${i + 1}`, x + 2, y - 4);
    });
    writeFileSync(`extract-out/bessatsu/${key}.png`, sheet.toBuffer("image/png"));
    console.log(`${key}: ${status}  図のページ=${contentPages.join(",")}  参照No.=${refs.join(",")}`);
  }
}
