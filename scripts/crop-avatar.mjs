// 写真から運営者アイコン(正方形)を切り出す
// 使い方: node scripts/crop-avatar.mjs <元の画像> <中心x> <中心y> <一辺> [出力=ot-site/nekodango.webp]
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";

const [, , src, cxArg, cyArg, sizeArg, out = "ot-site/nekodango.webp"] = process.argv;
const img = await loadImage(readFileSync(src));
const size = Number(sizeArg);
const sx = Math.max(0, Math.min(img.width - size, Number(cxArg) - size / 2));
const sy = Math.max(0, Math.min(img.height - size, Number(cyArg) - size / 2));
const OUT = 400;
const c = createCanvas(OUT, OUT);
c.getContext("2d").drawImage(img, sx, sy, size, size, 0, 0, OUT, OUT);
writeFileSync(out, c.toBuffer("image/webp", 85));
if (out.endsWith(".webp")) writeFileSync(out.replace(/\.webp$/, "-icon.png"), c.toBuffer("image/png"));
console.log(`${img.width}x${img.height} から ${size}px 四方を切り出して ${out} に保存しました`);
