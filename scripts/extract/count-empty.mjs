// 文字データが空なのに幅がある項目(=文字が欠けている所)を数える(調査用)
import { openPdf, EXAMS, SESSIONS } from "./pdf.mjs";

for (const exam of EXAMS.filter((e) => e !== 53)) {
  for (const s of SESSIONS) {
    const doc = await openPdf(`raw/mhlw/${exam}/09${s.key}_01.pdf`);
    let n = 0;
    const samples = [];
    for (let p = 7; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      tc.items.forEach((it, i) => {
        if (it.str === "" && it.width > 2 && it.transform[5] > 170) {
          n++;
          if (samples.length < 3) {
            const before = tc.items.slice(Math.max(0, i - 2), i).map((x) => x.str).join("");
            const after = tc.items.slice(i + 1, i + 3).map((x) => x.str).join("");
            samples.push(`p${p} …${before.slice(-8)}[?w${Math.round(it.width)}]${after.slice(0, 8)}…`);
          }
        }
      });
    }
    console.log(`${exam}${s.key}: ${n}  ${samples.join("  ")}`);
  }
}
