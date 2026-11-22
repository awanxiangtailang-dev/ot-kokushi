// できあがったデータの品質チェック(怪しい問題を一覧にする)
// 使い方: node scripts/extract/check.mjs
import { readFileSync } from "node:fs";
import { EXAMS } from "./pdf.mjs";

const issues = {};
const add = (kind, q, detail = "") => (issues[kind] ||= []).push(`${q.id} ${detail}`.trim());
let total = 0;
for (const exam of EXAMS) {
  const { questions } = JSON.parse(readFileSync(`public/data/exams/${exam}.json`, "utf8"));
  for (const q of questions) {
    total++;
    if (q.ocr) continue; // OCR の回は画像を主に表示するので別扱い
    if (!/(か|べ|よ)。?$/.test(q.stem)) add("問題文の終わりが不自然", q, `…${q.stem.slice(-25)}`);
    if (q.stem.length < 8) add("問題文が短すぎる", q, q.stem);
    if (!q.choicesFromImage) {
      q.choices.forEach((c, i) => {
        if (!c) add("選択肢が空", q, `${i + 1}`);
        if (/[1-5]．/.test(c)) add("選択肢に別の選択肢が混ざっている", q, `${i + 1}: ${c.slice(0, 40)}`);
        if (c.length > 80) add("選択肢が長すぎる", q, `${i + 1}: ${c.slice(0, 50)}…`);
      });
    }
    if (/⟦/.test(q.stem + q.choices.join(""))) add("読めない文字が残っている", q);
    if (/つ選べ/.test(q.stem) && !/2つ選べ/.test(q.stem)) add("「2つ選べ」の数字が欠けている", q);
  }
}
console.log(`全 ${total} 問`);
for (const [k, v] of Object.entries(issues)) {
  console.log(`\n■ ${k}: ${v.length} 件`);
  for (const line of v.slice(0, 40)) console.log("  " + line);
}
