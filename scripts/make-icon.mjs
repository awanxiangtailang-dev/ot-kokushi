// ねこだんごのイラスト(ot-site/nekodango.svg)から、X などのアイコン用の正方形 PNG を作る
// 出力: assets/nekodango-icon.png(400×400、背景つき)
// 使い方: node scripts/make-icon.mjs
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SIZE = 400;
const svg = readFileSync("ot-site/nekodango.svg");
const img = await loadImage(svg);
const c = createCanvas(SIZE, SIZE);
const ctx = c.getContext("2d");
// 背景: やさしいピンク(丸く切り取られても見栄えがするよう全面に塗る)
ctx.fillStyle = "#fde7ee";
ctx.fillRect(0, 0, SIZE, SIZE);
const pad = 40;
ctx.drawImage(img, pad, pad, SIZE - pad * 2, SIZE - pad * 2);
mkdirSync("assets", { recursive: true });
writeFileSync("assets/nekodango-icon.png", c.toBuffer("image/png"));
console.log("assets/nekodango-icon.png を作りました");
