// 空白の項目のまわりを表示する(デバッグ用)
// 使い方: node scripts/extract/debug-space.mjs <pdf> <ページ> <含まれる文字>
import { openPdf } from "./pdf.mjs";

const [, , file, pageNo, near] = process.argv;
const doc = await openPdf(file);
const page = await doc.getPage(Number(pageNo));
const tc = await page.getTextContent();
const target = tc.items.find((it) => it.str.includes(near));
const y = target.transform[5];
const row = tc.items.filter((o) => Math.abs(o.transform[5] - y) <= 2).sort((a, b) => a.transform[4] - b.transform[4]);
for (const o of row) console.log(JSON.stringify({ s: o.str, x: +o.transform[4].toFixed(1), w: +o.width.toFixed(1), y: +o.transform[5].toFixed(1), f: o.fontName }));
