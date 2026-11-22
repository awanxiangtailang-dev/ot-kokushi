// 正答PDF(正答値表)を読み取る
// 表は「問№ 正答１ 正答２ 正答３」が横に4組並ぶ。
//   正答１だけ  → その答え(「23」なら 2 と 3 の両方を選ぶ問題)
//   正答２・３もある → どれを答えても正解(複数の正解を認めた問題)
//   すべて空欄  → 採点除外(全員正解扱い)
// 出力: extract-out/answers/<回>.json  { "A001": [[2]], "A019": [[2,3]], "A042": [] ... }
// 使い方: node scripts/extract/answers.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { openPdf, EXAMS } from "./pdf.mjs";

mkdirSync("extract-out/answers", { recursive: true });

for (const exam of EXAMS) {
  const doc = await openPdf(`raw/mhlw/${exam}/09seitou.pdf`);
  const items = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items) if (it.str.trim()) items.push({ s: it.str.trim(), x: it.transform[4], y: Math.round(it.transform[5]), p });
  }
  // 見出し「問№」の x 位置 = 各組の左端
  const groupXs = [...new Set(items.filter((i) => /^問/.test(i.s)).map((i) => Math.round(i.x)))].sort((a, b) => a - b);
  const col1 = items.find((i) => /^正答\s*[1１]/.test(i.s));
  const col2 = items.find((i) => /^正答\s*[2２]/.test(i.s));
  const col3 = items.find((i) => /^正答\s*[3３]/.test(i.s));
  const off = [col1.x - groupXs[0], col2.x - groupXs[0], col3 ? col3.x - groupXs[0] : 999];
  const cellOf = (dx) => (dx < off[0] - 6 ? -1 : dx < off[1] - 4 ? 0 : dx < off[2] - 4 ? 1 : 2);

  // 行ごと・組ごとにまとめる
  const rows = new Map();
  for (const it of items) {
    const g = groupXs.findLastIndex((gx) => it.x >= gx - 3);
    if (g < 0) continue;
    const key = `${it.p}:${it.y}:${g}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ ...it, dx: it.x - groupXs[g] });
  }
  const answers = {};
  for (const cells of rows.values()) {
    const id = cells.find((c) => /^(A|B|AM|PM)\d{1,3}$/.test(c.s));
    if (!id) continue;
    const sets = [[], [], []];
    for (const c of cells) {
      if (c === id) continue;
      const k = cellOf(c.dx);
      if (k < 0) continue;
      for (const ch of c.s.replace(/\s/g, "")) if (/[1-5]/.test(ch)) sets[k].push(Number(ch));
    }
    // 第59回は「AM1」「PM1」形式なので「A001」「B001」にそろえる
    const [, ses, n] = id.s.match(/^(A|B|AM|PM)(\d+)$/);
    answers[`${ses.startsWith("A") ? "A" : "B"}${n.padStart(3, "0")}`] = sets.filter((s) => s.length).map((s) => [...new Set(s)].sort());
  }
  const ids = Object.keys(answers).sort();
  writeFileSync(`extract-out/answers/${exam}.json`, JSON.stringify(answers, null, 1));
  const excluded = ids.filter((i) => answers[i].length === 0);
  const multi = ids.filter((i) => answers[i].length > 1);
  console.log(`${exam}: ${ids.length}問  採点除外: ${excluded.join(",") || "なし"}  複数正解: ${multi.map((i) => `${i}=${JSON.stringify(answers[i])}`).join(" ") || "なし"}`);
}
