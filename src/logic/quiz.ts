import type { AnswerRecord, Part, Question, QuizSummary, Session } from "../types/quiz";

/** 0以上1未満の乱数を返す関数(テストでは固定の乱数を渡せる) */
export type Rng = () => number;

/** 配列をシャッフルした新しい配列を返す(元の配列は変えない) */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 出題範囲 */
export interface QuizFilter {
  /** 対象の回(空なら国試の問題は出さない) */
  exams: number[];
  sessions: Session[];
  parts: Part[];
}

/** 出題範囲で絞り込む */
export function filterQuestions(questions: readonly Question[], f: QuizFilter): Question[] {
  return questions.filter((q) => {
    if (!f.parts.includes(q.part)) return false;
    if (q.part === "オリジナル") return true; // オリジナルは回・午前午後に関係なく出す
    return f.exams.includes(q.exam) && !!q.session && f.sessions.includes(q.session);
  });
}

/** 国試の並び順(新しい回 → 午前 → 番号) */
export function examOrder(a: Question, b: Question): number {
  if (a.exam !== b.exam) return b.exam - a.exam;
  if (a.session !== b.session) return a.session === "午前" ? -1 : 1;
  return (a.no ?? 0) - (b.no ?? 0);
}

/** 正誤判定。選んだ番号の組が、正解の組のどれかと同じなら正解。採点除外は常に正解 */
export function isCorrect(question: Question, selected: readonly number[]): boolean {
  if (question.excluded || question.answers.length === 0) return true;
  const picked = [...new Set(selected)].sort((a, b) => a - b);
  return question.answers.some(
    (set) => set.length === picked.length && [...set].sort((a, b) => a - b).every((n, i) => n === picked[i]),
  );
}

/** 回答記録を作る */
export function recordAnswer(question: Question, selected: readonly number[]): AnswerRecord {
  return { questionId: question.id, selected: [...selected], correct: isCorrect(question, selected) };
}

/** 採点 */
export function summarize(records: readonly AnswerRecord[]): QuizSummary {
  const total = records.length;
  const correctCount = records.filter((r) => r.correct).length;
  return {
    total,
    correctCount,
    rate: total === 0 ? 0 : Math.round((correctCount / total) * 100),
    wrongIds: records.filter((r) => !r.correct).map((r) => r.questionId),
  };
}

/** 正解の表示用文字列(例: "3"、"2 と 5"、複数正解なら "3 / 4 のどちらでも正解") */
export function answerLabel(q: Question): string {
  if (q.excluded || q.answers.length === 0) return "採点除外(全員正解)";
  const sets = q.answers.map((s) => s.join(" と "));
  return sets.length === 1 ? sets[0] : `${sets.join(" / ")}(どれでも正解)`;
}

/** 正解に含まれる番号(色分け用) */
export function correctNumbers(q: Question): Set<number> {
  return new Set(q.answers.flat());
}

/** 問題の見出し(例: "第61回 午前 問12") */
export function questionTitle(q: Question): string {
  if (q.part === "オリジナル") return "オリジナル問題";
  return `第${q.exam}回 ${q.session} 問${q.no}`;
}

/** 日付から「今日の1問」を決める(同じ日はだれが開いても同じ問題) */
export function dailyQuestion(questions: readonly Question[], date: Date = new Date()): Question | null {
  const pool = questions.filter((q) => q.part !== "オリジナル" && !q.excluded);
  if (pool.length === 0) return null;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const sorted = [...pool].sort(examOrder);
  return sorted[(h >>> 0) % sorted.length];
}
