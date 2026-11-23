// 問題PDF(文字データあり)から、問題文・選択肢・位置情報を取り出す
// 出力: extract-out/q/<回><a|b>.json
// 使い方: node scripts/extract/questions.mjs [回...]
//
// 古い回のPDFは、数字などの一部の文字コードが壊れている。
// glyph-map.json(画像を見て作った対応表)で正しい文字に直す。
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { openPdf, EXAMS, SESSIONS, isBrokenChar, glyphKey } from "./pdf.mjs";
import { splitQuestions, build, groupLines } from "./parse.mjs";
import { createCanvas } from "@napi-rs/canvas";

const FOOTER_Y = 170; // これより下はページ番号などのフッター
const OCR_EXAMS = [53]; // 文字データがなく OCR で読む回
const GLYPH_MAP = JSON.parse(readFileSync("scripts/extract/glyph-map.json", "utf8"));

const targets = process.argv.slice(2).map(Number);
const exams = (targets.length ? targets : EXAMS).filter((e) => !OCR_EXAMS.includes(e));
mkdirSync("extract-out/q", { recursive: true });

for (const exam of exams) {
  for (const s of SESSIONS) {
    const file = `raw/mhlw/${exam}/09${s.key}_01.pdf`;
    const result = await extract(file, GLYPH_MAP[`${exam}${s.key}`] ?? {});
    writeFileSync(`extract-out/q/${exam}${s.key}.json`, JSON.stringify(result, null, 1));
    const qs = result.questions;
    console.log(
      `${exam}${s.key}: ${qs.length}問 (選択肢≠5: ${qs.filter((q) => q.choices.length !== 5).length}, 図あり: ${qs.filter((q) => q.needsImage).length}, 別冊参照: ${qs.filter((q) => q.bessatsu.length).length}, 未対応の壊れ文字: ${Object.keys(result.glyphs).filter((k) => !result.glyphs[k].mapped).length})`,
    );
  }
}

async function extract(file, map) {
  const doc = await openPdf(file);
  const lines = [];
  const glyphs = {};
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const [, , pw, ph] = page.view;
    const tc = await page.getTextContent();
    // フッター(「DKIX-…」とページ番号)の高さ。これより下は本文ではない
    const dkix = tc.items.find((it) => /^DKIX/.test(it.str));
    const footerY = dkix ? dkix.transform[5] + 8 : FOOTER_Y;
    const items = [];
    for (const [i, it] of tc.items.entries()) {
      if (!it.str) continue;
      // 数字用フォントの「空白」で、次の文字まで1文字ぶん空いているものは、空白ではなく数字が欠けている
      // (PDF内の並び順は画面上の並びと違うことがあるので、同じ行で右隣にある項目を探す)
      const nextX = it.str === " " ? rightNeighborX(tc.items, it) : Infinity;
      // (幅のほとんどない空白のすぐ後ろが、ちょうど全角1文字ぶん空いている。前の文字とはすき間なくつながっている)
      const prev = it.str === " " ? leftNeighbor(tc.items, it) : null;
      const gapToNext = nextX - it.transform[4];
      const candidate =
        it.str === " " && it.width < 3 && gapToNext >= 10 && gapToNext <= 14 &&
        !!prev && Math.abs(prev.transform[4] + prev.width - it.transform[4]) < 1.5 && /[^\s．.]$/.test(prev.str) && !/^\s*\d+\s*$/.test(prev.str); // 問題番号のうしろの空白は除く
      // 字間をあけて印刷しただけの空白(「抗　菌」など)と見分けるため、その場所に実際にインクがあるかを確かめる
      const hiddenDigit = candidate && (await hasInk(page, it.transform[4] + 1.5, it.transform[5] - 1, gapToNext - 3, (Math.abs(it.transform[3]) || 10) * 0.85));
      const x = it.transform[4];
      const y = it.transform[5];
      if (y < footerY) continue;
      if (/^DKIX/.test(it.str)) continue;
      const h = Math.abs(it.transform[3]) || it.height || 10;
      let str = "";
      const chars = [...it.str];
      for (const [idx, ch] of chars.entries()) {
        if (hiddenDigit) {
          str += "⟦?⟧"; // 数字が欠けているかもしれない印(この問題は画像で表示する)
          continue;
        }
        if (!isBrokenChar(ch)) {
          str += ch;
          continue;
        }
        const key = glyphKey(it.fontName, ch);
        const code = ch.codePointAt(0);
        const mapped = map[key] ?? (code >= 0x80 ? ch : null); // é ° などはそのまま
        const list = (glyphs[key] ||= []);
        list.mapped = mapped != null;
        if (list.length < 200) list.push({ page: p, x: x + (it.width / chars.length) * idx, y, w: it.width / chars.length, h, pw, ph, n: chars.length });
        str += mapped ?? `⟦${key}⟧`;
      }
      items.push({ str, x, y, w: it.width, h });
    }
    lines.push(...mergeSuperscripts(groupLines(items, p, pw, ph)).map((l) => ({ ...l, footerY })));
  }

  const questions = splitQuestions(lines);

  // 問題ページ(問1のページ以降)に出てくる壊れ文字だけを残す(確認用の一覧画像に使う)
  const firstPage = questions[0]?.lines[0]?.page ?? 1;
  const kept = {};
  for (const [key, list] of Object.entries(glyphs)) {
    const inBody = list.filter((o) => o.page >= firstPage).sort((a, b) => a.n - b.n);
    if (inBody.length) kept[key] = Object.assign(inBody.slice(0, 3), { mapped: list.mapped });
  }
  // JSON にすると配列のプロパティが消えるので、形を変えて保存
  const glyphOut = Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, { mapped: v.mapped, at: [...v] }]));
  return { file, numPages: doc.numPages, glyphs: glyphOut, questions: questions.map(build) };
}

/** ページ上の四角(PDFの座標)に、印刷されたもの(暗い画素)があるか */
// (この関数は上のループから先に呼ばれるので、キャッシュは関数の中で用意する)
async function hasInk(page, x, y, w, h) {
  const SCALE = 3;
  const inkCache = (hasInk.cache ||= new WeakMap());
  let r = inkCache.get(page);
  if (!r) {
    const vp = page.getViewport({ scale: SCALE });
    const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    r = { ctx, vp };
    inkCache.set(page, r);
  }
  const [x0, y0] = r.vp.convertToViewportPoint(x, y + h);
  const [x1, y1] = r.vp.convertToViewportPoint(x + w, y);
  const data = r.ctx.getImageData(Math.floor(x0), Math.floor(y0), Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))).data;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] < 300) dark++;
  return dark > 6;
}
/** 同じ行で右隣にある項目の x(なければ Infinity) */
function rightNeighborX(items, it) {
  let best = Infinity;
  for (const o of items) {
    if (o === it || !o.str || Math.abs(o.transform[5] - it.transform[5]) > 2) continue;
    if (o.transform[4] > it.transform[4] + 0.5 && o.transform[4] < best) best = o.transform[4];
  }
  return best;
}

/** 同じ行で左隣にある項目 */
function leftNeighbor(items, it) {
  let best = null;
  for (const o of items) {
    if (o === it || !o.str.trim() || Math.abs(o.transform[5] - it.transform[5]) > 2) continue;
    if (o.transform[4] < it.transform[4] && (!best || o.transform[4] > best.transform[4])) best = o;
  }
  return best;
}
/**
 * 上付き文字(「Na⁺」の「＋」、「Ca²⁺」の「2＋」など)は小さい文字で少し上に印刷されるため、
 * 別の行になってしまう。すぐ下の行に戻す。
 */
function mergeSuperscripts(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const small = line.items.length <= 3 && line.items.every((it) => it.h <= 9 && it.str.trim().length <= 3);
    if (small && next && line.y - next.y > 0 && line.y - next.y < 8 && next.h > 9) {
      next.items = [...next.items, ...line.items].sort((a, b) => a.x - b.x);
      continue;
    }
    out.push(line);
  }
  return out;
}
