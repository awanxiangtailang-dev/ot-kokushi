// X などでリンクを共有したときに出るカード画像(1200×630)を作る
// 出力: ot-site/ogp.png(サイト用)、public/ogp.png(アプリ用)
// 使い方: node scripts/make-ogp.mjs
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

// Windows の日本語フォント(なければ別の候補)
const FONT = ["Yu Gothic UI", "Yu Gothic", "Meiryo", "Noto Sans JP", "MS Gothic"].find((f) => GlobalFonts.has(f)) ?? "sans-serif";

function card({ eyebrow, title, sub, badge }) {
  const W = 1200;
  const H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  // 背景
  ctx.fillStyle = "#2f7d6d";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f7f8f6";
  ctx.beginPath();
  ctx.roundRect(48, 48, W - 96, H - 96, 28);
  ctx.fill();
  // 左の帯
  ctx.fillStyle = "#2f7d6d";
  ctx.fillRect(48, 48, 18, H - 96);

  ctx.fillStyle = "#2f7d6d";
  ctx.font = `bold 34px "${FONT}"`;
  ctx.fillText(eyebrow, 110, 150);

  ctx.fillStyle = "#24302c";
  ctx.font = `bold 84px "${FONT}"`;
  title.split("\n").forEach((line, i) => ctx.fillText(line, 106, 270 + i * 104));

  ctx.fillStyle = "#5f6d68";
  ctx.font = `36px "${FONT}"`;
  ctx.fillText(sub, 110, 500);

  if (badge) {
    ctx.font = `bold 34px "${FONT}"`;
    const w = ctx.measureText(badge).width + 48;
    ctx.fillStyle = "#b5651d";
    ctx.beginPath();
    ctx.roundRect(W - 96 - w - 20, 100, w, 64, 32);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(badge, W - 96 - w - 20 + 24, 144);
  }
  return c.toBuffer("image/png");
}

writeFileSync(
  "public/ogp.png",
  card({
    eyebrow: "作業療法士国家試験",
    title: "過去問10年分\n2,000問を無料で",
    sub: "第52回〜第61回・正答は厚生労働省の発表どおり",
    badge: "無料",
  }),
);
writeFileSync(
  "ot-site/ogp.png",
  card({
    eyebrow: "OT国試ノート",
    title: "現役OTの\n国試勉強の体験談",
    sub: "勉強スケジュール・使った参考書・過去問アプリ",
  }),
);
console.log(`カード画像を作りました(フォント: ${FONT})`);
