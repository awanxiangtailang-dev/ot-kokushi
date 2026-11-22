// 指定ページの行の組み立て結果を表示する(デバッグ用)
// 使い方: node scripts/extract/debug-lines.mjs <pdf> <ページ>
import { openPdf } from "./pdf.mjs";
import { groupLines } from "./parse.mjs";

const [, , file, pageNo] = process.argv;
const doc = await openPdf(file);
const page = await doc.getPage(Number(pageNo));
const [, , pw, ph] = page.view;
const tc = await page.getTextContent();
const items = tc.items
  .filter((it) => it.str && it.transform[5] >= 170)
  .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) }));
for (const l of groupLines(items, 1, pw, ph).slice(0, 6)) {
  console.log(Math.round(l.y), l.items.map((i) => `[${Math.round(i.x)}]${JSON.stringify(i.str)}`).join(" "));
}
