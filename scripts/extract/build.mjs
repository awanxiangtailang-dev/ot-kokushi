// 取り出した問題・正答・別冊を1つにまとめ、アプリ用のデータと画像を作る
// 入力: extract-out/q/*.json, extract-out/answers/*.json, extract-out/bessatsu/*.json
// 出力: public/data/exams/<回>.json, public/data/index.json, public/img/<回>/*.webp
// 使い方: node scripts/extract/build.mjs [--no-images] [回...]
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { openPdf, EXAMS, SESSIONS, SOURCE_PAGES, EXAM_YEAR } from "./pdf.mjs";

const args = process.argv.slice(2);
const noImages = args.includes("--no-images");
const targets = args.filter((a) => /^\d+$/.test(a)).map(Number);
const IMG_SCALE = 2.2;
const WEBP_QUALITY = 78;

/** 厚労省の正誤表などによる、問題文の訂正 */
const CORRECTIONS = {
  "59B078": { choices: { 0: "幼少期に発症する。" }, note: "厚生労働省の正誤表により選択肢1を訂正" },
};

/** 問題番号から区分を決める(各100問: 1〜20 実地、21〜50 専門、51〜100 専門基礎) */
function partOf(no) {
  if (no <= 20) return "実地問題";
  if (no <= 50) return "専門分野";
  return "専門基礎分野";
}

mkdirSync("public/data/exams", { recursive: true });
const index = [];
const problems = [];

for (const exam of targets.length ? targets : EXAMS) {
  const answers = JSON.parse(readFileSync(`extract-out/answers/${exam}.json`, "utf8"));
  const questions = [];
  mkdirSync(`public/img/${exam}`, { recursive: true });
  for (const s of SESSIONS) {
    const key = `${exam}${s.key}`;
    const { questions: qs } = JSON.parse(readFileSync(`extract-out/q/${key}.json`, "utf8"));
    const bessatsu = JSON.parse(readFileSync(`extract-out/bessatsu/${key}.json`, "utf8")).map;
    const doc = noImages ? null : await openPdf(`raw/mhlw/${exam}/09${s.key}_01.pdf`);
    const bdoc = noImages ? null : await openPdf(`raw/mhlw/${exam}/09${s.key}_02.pdf`);
    // 本文の一番下(これより下はフッター)
    const bodyBottom = Math.min(...qs.flatMap((q) => q.regions.map((r) => r.bottom))) - 6;

    // 別冊の画像
    const bessatsuImages = {};
    for (const [no, entry] of Object.entries(bessatsu)) {
      bessatsuImages[no] = entry.pages.map((p, i) => `img/${exam}/${s.key}-b${no}${entry.pages.length > 1 ? `-${i + 1}` : ""}.webp`);
      if (!noImages) {
        for (const [i, p] of entry.pages.entries()) {
          await renderCrop(bdoc, p, null, `public/${bessatsuImages[no][i]}`, entry.rotate ?? 0, 1.8);
        }
      }
    }

    for (const [i, q] of qs.entries()) {
      const id = `${exam}${s.idPrefix}${String(q.no).padStart(3, "0")}`;
      const ans = answers[`${s.idPrefix}${String(q.no).padStart(3, "0")}`];
      if (!ans) problems.push(`${id}: 正答がない`);
      const excluded = ans && ans.length === 0;
      const pick = ans && ans.length ? ans[0].length : q.pickTwo ? 2 : 1;
      if (ans && ans.length && q.pickTwo !== (pick === 2)) problems.push(`${id}: 「2つ選べ」(${q.pickTwo}) と正答の数(${pick}) が合わない`);
      let choices = q.choices.slice(0, 5);
      const fix = CORRECTIONS[id];
      if (fix?.choices) for (const [k, v] of Object.entries(fix.choices)) choices[k] = v;
      const choicesFromImage = choices.length !== 5 || !!q.choicesUnreliable;
      if (choicesFromImage) choices = ["", "", "", "", ""];

      // 問題の画像(図がある問題・OCRの問題)
      let image = null;
      if (q.needsImage) {
        image = `img/${exam}/${s.key}-q${q.no}.webp`;
        if (!noImages) {
          const next = qs[i + 1];
          const parts = q.regions.map((r, k) => {
            const isFirst = k === 0;
            const isLast = k === q.regions.length - 1;
            // 下端: 同じページに次の問題があればその上まで、なければフッターの上まで(図が下にあることがある)
            const pageBottom = (r.footerY ?? bodyBottom) + 6;
            const nextTop = next && next.regions[0].page === r.page ? next.regions[0].top + 4 : pageBottom;
            return { page: r.page, top: isFirst ? r.top + 6 : r.ph - 40, bottom: isLast ? nextTop : pageBottom };
          });
          await renderStack(doc, parts, `public/${image}`);
        }
      }

      const bImgs = q.bessatsu.flatMap((no) => bessatsuImages[no] ?? (problems.push(`${id}: 別冊No.${no} の画像がない`), []));
      questions.push({
        id,
        exam,
        session: s.label,
        no: q.no,
        part: partOf(q.no),
        caseText: q.caseText || undefined,
        stem: q.stem,
        choices,
        choicesFromImage,
        pick,
        answers: ans ?? [],
        excluded: !!excluded,
        image,
        bessatsu: bImgs,
        ocr: !!q.ocr,
        note: fix?.note,
      });
    }
  }
  const data = { exam, year: EXAM_YEAR[exam], source: SOURCE_PAGES[exam], questions };
  writeFileSync(`public/data/exams/${exam}.json`, JSON.stringify(data));
  index.push({ exam, year: EXAM_YEAR[exam], count: questions.length, source: SOURCE_PAGES[exam] });
  console.log(`第${exam}回: ${questions.length}問 (画像つき ${questions.filter((q) => q.image).length}, 別冊つき ${questions.filter((q) => q.bessatsu.length).length})`);
}

if (!targets.length) writeFileSync("public/data/index.json", JSON.stringify({ exams: index.sort((a, b) => b.exam - a.exam) }, null, 1));
console.log(problems.length ? `\n要確認 ${problems.length} 件:\n` + problems.join("\n") : "\n要確認: なし");

// ---------- 画像 ----------

async function renderPage(doc, pageNo, scale) {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  return { c, vp };
}

/** 白い余白を切り落とす範囲を求める */
function trimBox(c, box) {
  const ctx = c.getContext("2d");
  const { x, y, w, h } = box;
  const data = ctx.getImageData(x, y, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 690) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy;
        if (yy > maxY) maxY = yy;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 12;
  return {
    x: Math.max(x, x + minX - pad),
    y: Math.max(y, y + minY - pad),
    w: Math.min(w, maxX - minX + pad * 2),
    h: Math.min(h, maxY - minY + pad * 2),
  };
}

/** 別冊の1ページを、余白を切って画像にする */
async function renderCrop(doc, pageNo, _unused, out, rotate, scale) {
  const { c } = await renderPage(doc, pageNo, scale);
  // トンボ・フッターを避けた範囲で余白を切る
  const box = trimBox(c, {
    x: Math.floor(c.width * 0.05),
    y: Math.floor(c.height * 0.03),
    w: Math.floor(c.width * 0.9),
    h: Math.floor(c.height * 0.83),
  });
  if (!box) return;
  const rot = ((rotate % 360) + 360) % 360;
  const outW = rot === 90 || rot === 270 ? box.h : box.w;
  const outH = rot === 90 || rot === 270 ? box.w : box.h;
  const o = createCanvas(outW, outH);
  const octx = o.getContext("2d");
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, outW, outH);
  octx.translate(outW / 2, outH / 2);
  octx.rotate((rot * Math.PI) / 180);
  octx.drawImage(c, box.x, box.y, box.w, box.h, -box.w / 2, -box.h / 2, box.w, box.h);
  writeFileSync(out, o.toBuffer("image/webp", WEBP_QUALITY));
}

/** 問題の範囲(複数ページのことも)を縦に並べて1枚の画像にする */
async function renderStack(doc, parts, out) {
  const pieces = [];
  for (const part of parts) {
    const { c, vp } = await renderPage(doc, part.page, IMG_SCALE);
    const [, yTop] = vp.convertToViewportPoint(0, part.top);
    const [, yBottom] = vp.convertToViewportPoint(0, part.bottom);
    const box = trimBox(c, {
      x: Math.floor(c.width * 0.15),
      y: Math.max(0, Math.floor(yTop)),
      w: Math.floor(c.width * 0.8),
      h: Math.max(1, Math.floor(yBottom - yTop)),
    });
    if (box) pieces.push({ c, box });
  }
  if (!pieces.length) return;
  const w = Math.max(...pieces.map((p) => p.box.w));
  const h = pieces.reduce((s, p) => s + p.box.h, 0);
  const o = createCanvas(w, h);
  const octx = o.getContext("2d");
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, w, h);
  let y = 0;
  for (const p of pieces) {
    octx.drawImage(p.c, p.box.x, p.box.y, p.box.w, p.box.h, 0, y, p.box.w, p.box.h);
    y += p.box.h;
  }
  writeFileSync(out, o.toBuffer("image/webp", WEBP_QUALITY));
}
