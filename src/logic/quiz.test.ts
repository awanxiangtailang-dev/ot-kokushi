import { describe, expect, it } from "vitest";
import type { Question } from "../types/quiz";
import {
  answerLabel,
  dailyQuestion,
  examOrder,
  filterQuestions,
  isCorrect,
  questionTitle,
  recordAnswer,
  shuffle,
  summarize,
} from "./quiz";
import { ORIGINAL_QUESTIONS } from "../data/original";
import { QUESTIONS as LEGACY } from "../data/questions";

/** テスト用の国試問題 */
function q(over: Partial<Question>): Question {
  return {
    id: "61A001",
    exam: 61,
    session: "午前",
    no: 1,
    part: "実地問題",
    stem: "テスト",
    choices: ["a", "b", "c", "d", "e"],
    pick: 1,
    answers: [[3]],
    ...over,
  };
}

describe("正誤判定", () => {
  it("1つ選ぶ問題", () => {
    expect(isCorrect(q({}), [3])).toBe(true);
    expect(isCorrect(q({}), [2])).toBe(false);
  });

  it("2つ選ぶ問題は、順番に関係なく両方そろって正解", () => {
    const two = q({ pick: 2, answers: [[2, 5]] });
    expect(isCorrect(two, [5, 2])).toBe(true);
    expect(isCorrect(two, [2])).toBe(false);
    expect(isCorrect(two, [2, 4])).toBe(false);
  });

  it("複数の正解が認められた問題は、どれを選んでも正解", () => {
    const multi = q({ answers: [[3], [4]] });
    expect(isCorrect(multi, [3])).toBe(true);
    expect(isCorrect(multi, [4])).toBe(true);
    expect(isCorrect(multi, [1])).toBe(false);
  });

  it("2つ選ぶ問題で、正解の組が複数あるとき", () => {
    const multi = q({ pick: 2, answers: [[1, 2], [1, 5], [2, 5]] });
    expect(isCorrect(multi, [5, 1])).toBe(true);
    expect(isCorrect(multi, [1, 3])).toBe(false);
  });

  it("採点除外の問題は、何を選んでも正解", () => {
    expect(isCorrect(q({ answers: [], excluded: true }), [1])).toBe(true);
  });

  it("回答記録", () => {
    expect(recordAnswer(q({}), [3])).toEqual({ questionId: "61A001", selected: [3], correct: true });
  });
});

describe("表示用の文字", () => {
  it("正解の表示", () => {
    expect(answerLabel(q({}))).toBe("3");
    expect(answerLabel(q({ pick: 2, answers: [[2, 5]] }))).toBe("2 と 5");
    expect(answerLabel(q({ answers: [[3], [4]] }))).toBe("3 / 4(どれでも正解)");
    expect(answerLabel(q({ answers: [], excluded: true }))).toBe("採点除外(全員正解)");
  });

  it("問題の見出し", () => {
    expect(questionTitle(q({ exam: 60, session: "午後", no: 12 }))).toBe("第60回 午後 問12");
    expect(questionTitle(ORIGINAL_QUESTIONS[0])).toBe("オリジナル問題");
  });
});

describe("絞り込みと並び順", () => {
  const all = [
    q({ id: "61A001" }),
    q({ id: "61B051", session: "午後", no: 51, part: "専門基礎分野" }),
    q({ id: "60A021", exam: 60, no: 21, part: "専門分野" }),
    ...ORIGINAL_QUESTIONS,
  ];

  it("回・午前午後・区分で絞り込む", () => {
    const f = filterQuestions(all, { exams: [61], sessions: ["午前"], parts: ["実地問題", "専門分野", "専門基礎分野"] });
    expect(f.map((x) => x.id)).toEqual(["61A001"]);
  });

  it("オリジナルは回に関係なく、区分で選んだときだけ出る", () => {
    const f = filterQuestions(all, { exams: [], sessions: ["午前"], parts: ["オリジナル"] });
    expect(f).toHaveLength(ORIGINAL_QUESTIONS.length);
  });

  it("新しい回 → 午前 → 番号の順", () => {
    const sorted = [all[2], all[1], all[0]].sort(examOrder).map((x) => x.id);
    expect(sorted).toEqual(["61A001", "61B051", "60A021"]);
  });
});

describe("今日の1問", () => {
  const pool = Array.from({ length: 50 }, (_, i) => q({ id: `61A${String(i + 1).padStart(3, "0")}`, no: i + 1 }));

  it("同じ日なら同じ問題", () => {
    const d = new Date(2026, 10, 22, 8);
    const d2 = new Date(2026, 10, 22, 23);
    expect(dailyQuestion(pool, d)?.id).toBe(dailyQuestion(pool, d2)?.id);
  });

  it("採点除外とオリジナルは選ばない", () => {
    const only = [q({ id: "x", excluded: true, answers: [] }), ...ORIGINAL_QUESTIONS];
    expect(dailyQuestion(only)).toBeNull();
  });
});

describe("その他", () => {
  it("シャッフルしても要素は変わらず、元の配列はそのまま", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, () => 0.3);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("採点", () => {
    const s = summarize([
      { questionId: "a", selected: [1], correct: true },
      { questionId: "b", selected: [2], correct: false },
    ]);
    expect(s).toEqual({ total: 2, correctCount: 1, rate: 50, wrongIds: ["b"] });
  });

  it("オリジナル問題の変換で、正解の番号がずれない", () => {
    ORIGINAL_QUESTIONS.forEach((o, i) => {
      const legacy = LEGACY[i];
      expect(o.choices[o.answers[0][0] - 1]).toBe(legacy.choices[legacy.answerIndex]);
    });
  });

  it("オリジナル問題のIDは重複しない", () => {
    expect(new Set(ORIGINAL_QUESTIONS.map((x) => x.id)).size).toBe(ORIGINAL_QUESTIONS.length);
  });
});
