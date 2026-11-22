// 1問だけ取り出して、行と項目を表示する(デバッグ用)
// 使い方: node scripts/extract/debug-q.mjs <pdf> <問題番号>
import { openPdf } from "./pdf.mjs";
import { splitQuestions, build, groupLines } from "./parse.mjs";

const [, , file, noArg] = process.argv;
const doc = await openPdf(file);
const lines = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const [, , pw, ph] = page.view;
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((it) => it.str && it.transform[5] >= 170 && !/^DKIX/.test(it.str))
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 10 }));
  lines.push(...groupLines(items, p, pw, ph));
}
const q = splitQuestions(lines).find((q) => q.no === Number(noArg));
for (const l of q.lines) console.log(l.items.map((i) => `[x${Math.round(i.x)} w${Math.round(i.w)} h${Math.round(i.h)}]${JSON.stringify(i.str)}`).join(" "));
console.log(build(q).choices);
