// 文字データのない回(第53回)を、ページ画像 → Windows OCR → 問題分割 の順で取り出す
// 先に: node scripts/pdf-render.mjs raw/mhlw/53/09a_01.pdf extract-out/ocr53/a 3 7
//       powershell -File scripts/extract/ocr.ps1 extract-out/ocr53/a   (b も同様)
// 使い方: node scripts/extract/questions-ocr.mjs
// 出力: extract-out/q/53a.json, 53b.json(各問に ocr: true が付く)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openPdf, SESSIONS } from "./pdf.mjs";
import { splitQuestions, build, groupLines } from "./parse.mjs";

const EXAM = 53;
const SCALE = 3; // pdf-render の倍率と同じにする
const FOOTER_Y = 170;

for (const s of SESSIONS) {
  const dir = `extract-out/ocr${EXAM}/${s.key}`;
  const file = `raw/mhlw/${EXAM}/09${s.key}_01.pdf`;
  const doc = await openPdf(file);
  const lines = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".ocr.json")).sort()) {
    const p = Number(name.match(/p(\d+)/)[1]);
    const page = await doc.getPage(p);
    const [, , pw, ph] = page.view;
    const ocr = JSON.parse(readFileSync(join(dir, name), "utf8").replace(/^﻿/, ""));
    const items = [];
    for (const line of ocr.lines ?? []) {
      // 近い単語どうしはつなげ、離れていれば別の項目にする
      let cur = null;
      for (const w of [].concat(line.words ?? [])) {
        const x = w.x / SCALE;
        const y = ph - (w.y + w.h) / SCALE; // 下端を基準に
        const h = w.h / SCALE;
        const wd = w.w / SCALE;
        if (cur && x - (cur.x + cur.w) < h * 0.6) {
          const gap = x - (cur.x + cur.w);
          // 「1」「1」のように数字が分かれて読まれたときは、すき間が小さければ「11」とつなぐ
          const digits = /^\d+$/.test(cur.str) && /^\d+$/.test(w.t) && gap < h * 0.35;
          cur.str += (!digits && /[A-Za-z0-9]$/.test(cur.str) && /^[A-Za-z0-9]/.test(w.t) && gap > h * 0.25 ? " " : "") + w.t;
          cur.w = x + wd - cur.x;
          cur.h = Math.max(cur.h, h);
        } else {
          cur = { str: w.t, x, y, w: wd, h };
          items.push(cur);
        }
      }
    }
    const dkix = items.find((it) => /^DKIX/.test(it.str));
    const footerY = dkix ? dkix.y + 8 : FOOTER_Y;
    const body = items.filter((it) => it.y >= footerY && !/^DKIX/.test(it.str));
    lines.push(...groupLines(body, p, pw, ph, 5).map((l) => ({ ...l, footerY })));
  }
  if (process.env.DEBUG) for (const l of lines.slice(0, 40)) console.log(l.page, Math.round(l.items[0].x), Math.round(l.y), l.items.map((i) => i.str).join("|").slice(0, 40));
  const questions = splitQuestions(lines, { skip: 3 }).map((q) => ({ ...build(q, { gapFactor: 3 }), ocr: true, needsImage: true }));
  writeFileSync(`extract-out/q/${EXAM}${s.key}.json`, JSON.stringify({ file, numPages: doc.numPages, glyphs: {}, questions }, null, 1));
  const nums = questions.map((q) => q.no);
  console.log(`${EXAM}${s.key}: ${questions.length}問 (選択肢≠5: ${questions.filter((q) => q.choices.length !== 5).length}) 最後の番号: ${nums.at(-1)} 抜け: ${Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !nums.includes(n)).join(",")}`);
}
