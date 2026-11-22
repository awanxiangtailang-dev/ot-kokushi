import type { Question } from "../types/quiz";
import { examOrder, shuffle, type Rng } from "./quiz";

/** 間違えたあと、何回続けて正解したら「克服」とみなすか */
export const MASTERY_STREAK = 2;

/** 1問ぶんの成績 */
export interface QuestionStat {
  /** 解いた回数 */
  attempts: number;
  /** 間違えた回数 */
  wrongCount: number;
  /** 連続正解数(間違えると0に戻る) */
  correctStreak: number;
  /** 最後に解いた日時(ミリ秒) */
  lastAnsweredAt: number;
}

/** 問題ID → 成績 */
export type ProgressMap = Readonly<Record<string, QuestionStat>>;

/** 出題モード */
export type QuizMode = "normal" | "unanswered" | "focus" | "weakOnly";

export const MODE_LABELS: Record<QuizMode, string> = {
  normal: "通常",
  unanswered: "まだ解いていない問題",
  focus: "苦手を重点",
  weakOnly: "苦手だけ復習",
};

/** 苦手か(一度でも間違えていて、まだ克服していない) */
export function isWeak(stat: QuestionStat | undefined): boolean {
  return !!stat && stat.wrongCount > 0 && stat.correctStreak < MASTERY_STREAK;
}

/** 克服したか(間違えたことがあり、その後 MASTERY_STREAK 回続けて正解) */
export function isMastered(stat: QuestionStat | undefined): boolean {
  return !!stat && stat.wrongCount > 0 && stat.correctStreak >= MASTERY_STREAK;
}

/** 正答率(0〜100 の整数)。未回答なら null */
export function accuracy(stat: QuestionStat | undefined): number | null {
  if (!stat || stat.attempts === 0) return null;
  return Math.round(((stat.attempts - stat.wrongCount) / stat.attempts) * 100);
}

/** 回答を記録した新しい ProgressMap を返す(元は変えない) */
export function applyAnswer(
  progress: ProgressMap,
  questionId: string,
  correct: boolean,
  now: number = Date.now(),
): ProgressMap {
  const prev = progress[questionId];
  const next: QuestionStat = {
    attempts: (prev?.attempts ?? 0) + 1,
    wrongCount: (prev?.wrongCount ?? 0) + (correct ? 0 : 1),
    correctStreak: correct ? (prev?.correctStreak ?? 0) + 1 : 0,
    lastAnsweredAt: now,
  };
  return { ...progress, [questionId]: next };
}

/**
 * 出やすさの重み
 * - 苦手: 4〜6(間違えた回数が多いほど重い)
 * - 未回答: 1
 * - 正解している・克服済み: 0.5(たまに出して、忘れていないか確認)
 */
export function questionWeight(stat: QuestionStat | undefined): number {
  if (!stat) return 1;
  if (isWeak(stat)) return 4 + Math.min(stat.wrongCount - 1, 2);
  return 0.5;
}

/** 重みつきで、重複なしに count 個取り出す */
export function weightedSample<T>(
  items: readonly T[],
  weight: (item: T) => number,
  count: number,
  rng: Rng = Math.random,
): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0, weight(item)) }));
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let index: number;
    if (total <= 0) {
      index = Math.floor(rng() * pool.length);
    } else {
      let r = rng() * total;
      index = pool.findIndex((p) => (r -= p.w) < 0);
      if (index < 0) index = pool.length - 1;
    }
    out.push(pool[index].item);
    pool.splice(index, 1);
  }
  return out;
}

/** 苦手な問題だけに絞る */
export function weakQuestions(questions: readonly Question[], progress: ProgressMap): Question[] {
  return questions.filter((q) => isWeak(progress[q.id]));
}

/** まだ解いていない問題だけに絞る */
export function unansweredQuestions(questions: readonly Question[], progress: ProgressMap): Question[] {
  return questions.filter((q) => !progress[q.id]);
}

/** モードに応じて出題できる問題の数(pool は出題範囲で絞り込み済み) */
export function availableCount(pool: readonly Question[], mode: QuizMode, progress: ProgressMap): number {
  if (mode === "weakOnly") return weakQuestions(pool, progress).length;
  if (mode === "unanswered") return unansweredQuestions(pool, progress).length;
  return pool.length;
}

/**
 * モードに応じて問題を選ぶ
 * - 国試は選択肢の番号に意味がある(図の①〜⑤など)ので、選択肢は並べ替えない
 * - ordered: true なら回・番号順(本番と同じ並び)
 */
export function prepareQuizByMode(
  pool: readonly Question[],
  count: number,
  mode: QuizMode,
  progress: ProgressMap,
  { ordered = false, rng = Math.random }: { ordered?: boolean; rng?: Rng } = {},
): Question[] {
  const n = Math.max(0, count);
  let picked: Question[];
  switch (mode) {
    case "normal":
      picked = ordered ? [...pool].slice(0, n) : shuffle(pool, rng).slice(0, n);
      break;
    case "focus":
      picked = weightedSample(pool, (q) => questionWeight(progress[q.id]), n, rng);
      break;
    case "weakOnly":
      picked = shuffle(weakQuestions(pool, progress), rng).slice(0, n);
      break;
    case "unanswered":
      picked = (ordered ? unansweredQuestions(pool, progress) : shuffle(unansweredQuestions(pool, progress), rng)).slice(0, n);
      break;
  }
  return ordered ? picked.sort(examOrder) : picked;
}
/** クイズの前後を比べて、克服した問題・新しく苦手になった問題を返す */
export function diffProgress(
  before: ProgressMap,
  after: ProgressMap,
  questionIds: readonly string[],
): { newlyMastered: string[]; newlyWeak: string[] } {
  return {
    newlyMastered: questionIds.filter((id) => isWeak(before[id]) && isMastered(after[id])),
    newlyWeak: questionIds.filter((id) => !isWeak(before[id]) && isWeak(after[id])),
  };
}
