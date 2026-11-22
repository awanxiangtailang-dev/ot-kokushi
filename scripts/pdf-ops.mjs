// ページの描画命令・注釈を調べる補助スクリプト
// 使い方: node scripts/pdf-ops.mjs <pdf> <ページ>
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const [, , file, pageNo = "1"] = process.argv;
const doc = await getDocument({
  data: new Uint8Array(readFileSync(file)),
  verbosity: 0,
  cMapUrl: "node_modules/pdfjs-dist/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
}).promise;
const page = await doc.getPage(Number(pageNo));
const names = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));
for (const intent of ["display", "print"]) {
  const ops = await page.getOperatorList({ intent, annotationMode: 3 });
  const counts = {};
  for (const fn of ops.fnArray) counts[names[fn]] = (counts[names[fn]] || 0) + 1;
  console.log(intent, JSON.stringify(counts));
}
const annots = await page.getAnnotations();
console.log("annotations:", annots.length, JSON.stringify(annots.slice(0, 3).map((a) => ({ t: a.subtype, r: a.rect, ap: !!a.hasAppearance }))));
const oc = await doc.getOptionalContentConfig();
console.log("optional content groups:", JSON.stringify([...oc].map(([id, g]) => ({ id, name: g.name, visible: g.visible }))));
console.log("view:", JSON.stringify(page.view));
