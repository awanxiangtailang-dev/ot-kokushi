// 行のリストを問題ごとに分け、問題文・選択肢などを組み立てる(テキスト版とOCR版で共通)
//
// 行の形: { page, y, h, pw, ph, items: [{ str, x, y, w, h }] }
//   座標は PDF の単位(左下が原点、y は上ほど大きい)

/** 全角・漢字などの間の空白を消し、英数字どうしの空白は残す */
export function normalize(s) {
  return s
    .replace(/\s+/g, " ")
    .replace(/(?<=[^\x00-\x7f])\s+(?=[^\x00-\x7f])/g, "")
    .replace(/(?<=[^\x00-\x7f])\s+(?=[\x00-\x7f])/g, (m, off, str) => (/[A-Za-z]/.test(str[off + m.length] ?? "") ? " " : ""))
    .replace(/(?<=[0-9])\s+(?=[^\x00-\x7f])/g, "")
    .trim();
}

/** 行を問題ごとに分ける(問題番号は 1 から順番に出てくる) */
export function splitQuestions(lines, { skip = 0 } = {}) {
  // 選択肢「1．」が始まる x 位置(問題番号はこれより左にある)
  const choiceXs = {};
  for (const l of lines) {
    const f = l.items[0];
    if (/^\s*[1-5]\s*[．.]/.test(f.str)) choiceXs[Math.round(f.x)] = (choiceXs[Math.round(f.x)] || 0) + 1;
  }
  const choiceX = Number(Object.entries(choiceXs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 148);

  const questions = [];
  let expected = 1;
  let q = null;
  // 「次の文により、7、8の問いに答えよ。」で始まる共通の事例文
  let shared = null;
  const sharedFor = {}; // 問題番号 -> 共通の事例文
  for (const line of lines) {
    const first = line.items[0];
    const text = line.items.map((i) => i.str).join("").replace(/\s/g, "");
    const sm = text.match(/^次の文により、?(\d+)[、,](\d+)(?:[、,](\d+))?の問いに答えよ/);
    if (sm) {
      shared = { lines: [line], targets: [sm[1], sm[2], sm[3]].filter(Boolean).map(Number) };
      for (const t of shared.targets) sharedFor[t] = shared;
      q = null; // 前の問題にはつなげない
      continue;
    }
    // 行頭の「数字だけの項目」が隣り合っていればつなげる(「1」「00」→「100」)
    let lead = 0;
    let headStr = "";
    while (lead < line.items.length && /^\d+$/.test(line.items[lead].str.trim()) && headStr.length < 3) {
      const it = line.items[lead];
      const prev = line.items[lead - 1];
      if (prev && it.x - (prev.x + prev.w) > 2) break;
      headStr += it.str.trim();
      lead++;
    }
    // 番号が独立した項目ならそれを使う(「1」「85歳」のように続く数字とくっつけない)
    const m = lead > 0 ? [headStr, headStr] : first.str.match(/^\s*(\d{1,3})(?![\d．.])/);
    let num = m ? Number(m[1]) : NaN;
    // 第58回の「100」は先頭の「1」の文字が欠けて「00」になっているページがある
    if (m && num !== expected && String(expected).length === m[1].length + 1 && String(expected).endsWith(m[1])) num = expected;
    // skip > 0 のとき(OCR)は、番号の読み落としがあっても先へ進めるよう少し先の番号も受け付ける
    if (num >= expected && num <= expected + skip && first.x < choiceX - 2) {
      q = { no: num, lines: [], shared: sharedFor[num] ?? null };
      questions.push(q);
      expected = num + 1;
      shared = null;
      const rest = line.items.slice(lead);
      if (lead === 0 && rest.length) rest[0] = { ...rest[0], str: rest[0].str.replace(/^\s*\d{1,3}\s*/, "") };
      q.lines.push({ ...line, items: rest });
      continue;
    }
    if (shared) shared.lines.push(line);
    else if (q) q.lines.push(line);
  }
  return questions;
}

/** 共通の事例文を文字列にする(「次の文により…答えよ。」の1行目は除く) */
function sharedText(shared) {
  if (!shared) return "";
  const parts = [];
  for (const [i, line] of shared.lines.entries()) {
    let s = line.items.map((it) => it.str).join("");
    if (i === 0) s = s.replace(/^.*?答えよ。?/, "");
    parts.push(s);
  }
  return normalize(parts.join(""));
}

/** 離れた項目の間の目印(normalize で消えないよう、空白ではない私用文字にしておく) */
// 大きく離れている(図形の線がある) → 「 ― 」、少し離れている → 全角スペース
const SEP = "\uE000";
const SEP_SMALL = "\uE001";
const sep = (s) => s.replace(/\s*\uE000\s*/g, " ― ").replace(/\s*\uE001\s*/g, "　");

/** 1問ぶんの行から、問題文・選択肢・画像の範囲などを組み立てる */
export function build(q, { gapFactor = 1.5 } = {}) {
  const stemParts = [];
  const choices = [];
  const regions = []; // ページごとの範囲(画像切り出し用)
  let prevY = null;
  let prevPage = null;
  let maxGap = 0;
  for (const line of q.lines) {
    let r = regions.find((r) => r.page === line.page);
    if (!r) regions.push((r = { page: line.page, top: line.y + line.h, bottom: line.y, pw: line.pw, ph: line.ph, footerY: line.footerY ?? 170 }));
    r.top = Math.max(r.top, line.y + line.h);
    r.bottom = Math.min(r.bottom, line.y);
    if (prevPage === line.page && prevY !== null) maxGap = Math.max(maxGap, prevY - line.y);
    prevY = line.y;
    prevPage = line.page;

    // 選択肢の区切り: 「1．」で始まる項目
    let target = null;
    let prevItem = null;
    for (const it of line.items) {
      // 同じ行で大きく離れた項目の間には、図形の線(組合せ問題の「―」など)がある
      // (空白だけの項目はとばして、その前の文字の項目からの距離をみる)
      const gap = prevItem && it.str.trim() ? it.x - (prevItem.x + prevItem.w) : 0;
      const farGap = gap > (it.h || 10) * gapFactor;
      const veryFar = gap > (it.h || 10) * Math.max(6, gapFactor * 2);
      if (it.str.trim()) prevItem = it;
      const m = it.str.match(/^\s*([1-5])\s*[．.]\s*(.*)$/s);
      if (m && Number(m[1]) === choices.length + 1) {
        choices.push(m[2]);
        target = "choice";
        continue;
      }
      const str = (veryFar ? SEP : farGap ? SEP_SMALL : "") + it.str;
      if (target === "choice" || (choices.length > 0 && !target)) {
        choices[choices.length - 1] += str;
        target = "choice";
      } else stemParts.push(str);
    }
    if (target !== "choice" && choices.length === 0) stemParts.push("\n");
  }
  const stem = sep(normalize(stemParts.join("").replace(/\n+/g, "\n")).replace(/ ?\n ?/g, ""));
  // 1つの選択肢でも線で区切られていれば、その問題の区切りはすべて「 ― 」にそろえる
  const useDash = choices.some((c) => c.includes(SEP));
  const cleanChoices = choices.map((c) => sep(normalize(useDash ? c.replaceAll(SEP_SMALL, SEP) : c)).replace(/^( ― |　)/, ""));
  const caseText = sharedText(q.shared);
  // OCR では「No.」が「N。.」などになるので、ゆるく受け付ける
  const bessatsu = [...(caseText + stem).matchAll(/別冊\s*N\s*[oO。0]\s*[.．]?\s*(\d+)(?:\s*[、,]\s*(\d+))?(?:\s*[〜～]\s*(\d+))?/g)].flatMap((m) => {
    const a = Number(m[1]);
    if (m[3]) return Array.from({ length: Number(m[3]) - a + 1 }, (_, i) => a + i);
    return m[2] ? [a, Number(m[2])] : [a];
  });
  const pickTwo = /2\s*つ選べ/.test(stem);
  // 本文中の「別冊 No. 1」のラベル枠は図ではない。行間の大きさと言葉で図の有無を判定
  const textStem = stem.replace(/別冊.*?示す/g, "");
  const cleanStem = stem.replace(/別冊\s*No\.\s*\d+\s*$/, "").replace(/\s*別冊\s*$/, "").replace(/袷$/, "");
  // 文の終わりが「。」などで終わらない = 表やリストが文字として混ざっている
  const oddTail = !/([。）)]|選べ|どれか|答えよ)$/.test(cleanStem);
  // 選択肢に表の中身が混ざっている
  const oddChoices = cleanChoices.some((c) => /[0-9０-９]．/.test(c) || c.length > 80);
  // 数字が欠けているかもしれない問題は、文字ではなく画像で見せる
  const missing = /⟦\?⟧/.test(stem + choices.join(""));
  const needsImage = missing ||
    cleanChoices.length !== 5 || oddTail || oddChoices || maxGap > 60 || /図|写真|グラフ|矢印|波形|表[をにのでは]|下記/.test(textStem);
  return {
    no: q.no,
    caseText,
    stem: cleanStem.replace(/⟦\?⟧/g, "□"),
    choicesUnreliable: cleanChoices.length !== 5 || oddChoices || missing,
    choices: cleanChoices.map((c) => c.replace(/⟦\?⟧/g, "□")),
    pickTwo,
    bessatsu: [...new Set(bessatsu)],
    needsImage,
    maxGap: Math.round(maxGap),
    regions: regions.map((r) => ({ page: r.page, top: Math.round(r.top), bottom: Math.round(r.bottom), pw: r.pw, ph: r.ph, footerY: Math.round(r.footerY) })),
  };
}

/** 同じ高さの項目を1行にまとめる */
export function groupLines(items, page, pw, ph, tol = 3) {
  const lines = [];
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  let cur = null;
  for (const it of items) {
    if (cur && Math.abs(cur.y - it.y) <= tol) cur.items.push(it);
    else {
      cur = { page, y: it.y, h: it.h, items: [it], pw, ph };
      lines.push(cur);
    }
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}
