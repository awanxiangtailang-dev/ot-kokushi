import type { Question, Session } from "../types/quiz";
import { examOrder } from "./quiz";

/** 検索用に文字をそろえる(全角英数→半角、大文字→小文字、空白をつめる) */
export function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface QuestionRef {
  exam?: number;
  session?: Session;
  no?: number;
}

/**
 * 問題番号の書き方を読み取る。読み取った部分は rest から除く。
 * 例: 「60A21」「60a021」「60P5」「第60回 午前21」「60回午後 問21」「60 午前 21」「第60回」
 */
export function parseRef(query: string): { ref: QuestionRef; rest: string } {
  let q = normalize(query);
  const ref: QuestionRef = {};

  // 60A21 / 60B021 / 60P5(午後= P / B)
  const compact = /(?:^|\s)(\d{2})\s*-?\s*([abp])\s*-?\s*(\d{1,3})(?=\s|$)/.exec(q);
  if (compact) {
    ref.exam = Number(compact[1]);
    ref.session = compact[2] === "a" ? "午前" : "午後";
    ref.no = Number(compact[3]);
    return { ref, rest: (q.slice(0, compact.index) + " " + q.slice(compact.index + compact[0].length)).trim() };
  }

  const exam = /第?\s*(\d{2})\s*回/.exec(q);
  if (exam) {
    ref.exam = Number(exam[1]);
    q = q.replace(exam[0], " ");
  }
  const sess = /(午前|午後|ごぜん|ごご)\s*(?:問\s*)?(\d{1,3})?(?:\s*問)?/.exec(q);
  if (sess) {
    ref.session = /前|ぜん/.test(sess[1]) ? "午前" : "午後";
    if (sess[2]) ref.no = Number(sess[2]);
    q = q.replace(sess[0], " ");
  }
  // 「60 午前 21」のように「回」を書かない形
  if (!ref.exam && ref.session) {
    const bare = /(?:^|\s)(\d{2})(?=\s|$)/.exec(q);
    if (bare) {
      ref.exam = Number(bare[1]);
      q = q.replace(bare[0], " ");
    }
  }
  if (ref.session && !ref.no) {
    const no = /(?:^|\s)問?\s*(\d{1,3})\s*問?(?=\s|$)/.exec(q);
    if (no) {
      ref.no = Number(no[1]);
      q = q.replace(no[0], " ");
    }
  }
  return { ref, rest: q.replace(/\s+/g, " ").trim() };
}

export interface SearchHit {
  question: Question;
  /** 問題文などで当たった場所の前後(表示用) */
  snippet: string;
  score: number;
}

const questionText = (q: Question) => [q.caseText ?? "", q.stem, ...q.choices].join(" ");

/**
 * 問題をさがす。
 * - 問題番号だけなら、その問題
 * - 「第60回 FIM」のように回と言葉をまぜてもよい
 * - 言葉は空白で区切ると「すべてふくむ」
 * - 問題文・選択肢で当たったものを、解説だけで当たったものより上に出す
 */
export function searchQuestions(questions: readonly Question[], query: string, limit = 100): { hits: SearchHit[]; total: number; ref: QuestionRef } {
  const { ref, rest } = parseRef(query);
  const words = rest.split(" ").filter(Boolean);
  if (!words.length && ref.exam === undefined && !ref.session) return { hits: [], total: 0, ref };

  const hits: SearchHit[] = [];
  for (const q of questions) {
    if (q.part === "オリジナル") continue;
    if (ref.exam !== undefined && q.exam !== ref.exam) continue;
    if (ref.session && q.session !== ref.session) continue;
    if (ref.no !== undefined && q.no !== ref.no) continue;

    const main = normalize(questionText(q));
    const ex = normalize([q.explanation?.text ?? "", ...(q.explanation?.choiceNotes ?? [])].join(" "));
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (main.includes(w)) score += 3;
      else if (ex.includes(w)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    hits.push({ question: q, snippet: makeSnippet(q, words), score });
  }
  hits.sort((a, b) => b.score - a.score || examOrder(a.question, b.question));
  return { hits: hits.slice(0, limit), total: hits.length, ref };
}

/** 最初に当たった言葉のまわりを切り出す。問題文で当たらなければ解説から */
function makeSnippet(q: Question, words: string[], width = 60): string {
  const sources = [questionText(q), q.explanation?.text ?? "", ...(q.explanation?.choiceNotes ?? [])];
  for (const src of sources) {
    // 表示は元の大文字・小文字のまま(さがすときだけ小文字にそろえる。長さは変わらない)
    const shown = src.normalize("NFKC").replace(/\s+/g, " ").trim();
    const n = shown.toLowerCase();
    for (const w of words) {
      const i = n.indexOf(w);
      if (i >= 0) {
        const start = Math.max(0, i - 20);
        return (start > 0 ? "…" : "") + shown.slice(start, start + width) + (start + width < shown.length ? "…" : "");
      }
    }
  }
  const s = q.stem.normalize("NFKC").replace(/\s+/g, " ").trim();
  return s.length > width ? s.slice(0, width) + "…" : s;
}

/** 解説ページ(kakomon/)の場所。アプリから見た相対パス */
export function kakomonPath(q: Question): string | null {
  if (q.part === "オリジナル" || !q.explanation || !q.session || !q.no) return null;
  return `../kakomon/${q.exam}/${q.session === "午前" ? "a" : "b"}${String(q.no).padStart(3, "0")}.html`;
}
