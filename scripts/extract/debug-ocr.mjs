// OCR版の行の組み立てを確認する(デバッグ用)
import { readFileSync } from "node:fs";
import { groupLines } from "./parse.mjs";

const [, , file, ph = "938.4624"] = process.argv;
const SCALE = 3;
const ocr = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
console.log("lines type:", Array.isArray(ocr.lines), typeof ocr.lines);
const items = [];
for (const line of [].concat(ocr.lines ?? [])) {
  for (const w of [].concat(line.words ?? [])) {
    items.push({ str: w.t, x: w.x / SCALE, y: Number(ph) - (w.y + w.h) / SCALE, w: w.w / SCALE, h: w.h / SCALE });
  }
}
console.log("items:", items.length);
for (const l of groupLines(items, 1, 669, Number(ph), 5).slice(0, 8)) {
  console.log(Math.round(l.items[0].x), Math.round(l.y), l.items.map((i) => i.str).join("|"));
}
