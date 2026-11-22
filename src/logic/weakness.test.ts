import { describe, expect, it } from "vitest";
import { ORIGINAL_QUESTIONS } from "../data/original";
import {
  applyAnswer,
  accuracy,
  availableCount,
  diffProgress,
  isMastered,
  isWeak,
  prepareQuizByMode,
  questionWeight,
  weightedSample,
  type ProgressMap,
} from "./weakness";

function seededRng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("回答の記録と苦手・克服の判定", () => {
  it("間違えると苦手になる", () => {
    const p = applyAnswer({}, "q1", false, 1);
    expect(p.q1).toEqual({ attempts: 1, wrongCount: 1, correctStreak: 0, lastAnsweredAt: 1 });
    expect(isWeak(p.q1)).toBe(true);
  });

  it("間違えたあと1回正解ではまだ苦手、2回続けて正解で克服", () => {
    let p = applyAnswer({}, "q1", false);
    p = applyAnswer(p, "q1", true);
    expect(isWeak(p.q1)).toBe(true);
    p = applyAnswer(p, "q1", true);
    expect(isWeak(p.q1)).toBe(false);
    expect(isMastered(p.q1)).toBe(true);
  });

  it("正解→間違い→正解 は連続ではないので克服しない", () => {
    let p = applyAnswer({}, "q1", false);
    p = applyAnswer(p, "q1", true);
    p = applyAnswer(p, "q1", false);
    p = applyAnswer(p, "q1", true);
    expect(isWeak(p.q1)).toBe(true);
    expect(p.q1.wrongCount).toBe(2);
  });

  it("克服後にまた間違えると苦手に戻る", () => {
    let p = applyAnswer({}, "q1", false);
    p = applyAnswer(p, "q1", true);
    p = applyAnswer(p, "q1", true);
    p = applyAnswer(p, "q1", false);
    expect(isWeak(p.q1)).toBe(true);
  });

  it("一度も間違えていない問題は苦手でも克服でもない", () => {
    const p = applyAnswer({}, "q1", true);
    expect(isWeak(p.q1)).toBe(false);
    expect(isMastered(p.q1)).toBe(false);
  });

  it("元の記録は変更しない", () => {
    const before: ProgressMap = {};
    applyAnswer(before, "q1", false);
    expect(before).toEqual({});
  });

  it("正答率", () => {
    let p = applyAnswer({}, "q1", false);
    p = applyAnswer(p, "q1", true);
    p = applyAnswer(p, "q1", true);
    expect(accuracy(p.q1)).toBe(67);
    expect(accuracy(undefined)).toBeNull();
  });
});

describe("重みづけ", () => {
  it("苦手は4〜6、未回答は1、正解済みは0.5", () => {
    expect(questionWeight(undefined)).toBe(1);
    expect(questionWeight({ attempts: 1, wrongCount: 1, correctStreak: 0, lastAnsweredAt: 0 })).toBe(4);
    expect(questionWeight({ attempts: 5, wrongCount: 5, correctStreak: 0, lastAnsweredAt: 0 })).toBe(6);
    expect(questionWeight({ attempts: 2, wrongCount: 0, correctStreak: 2, lastAnsweredAt: 0 })).toBe(0.5);
  });

  it("weightedSample は重複なしで指定数を返す", () => {
    const out = weightedSample([1, 2, 3, 4, 5], () => 1, 3, seededRng(1));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it("重いものほど選ばれやすい", () => {
    const rng = seededRng(7);
    let heavy = 0;
    for (let i = 0; i < 2000; i++) {
      const [x] = weightedSample(["heavy", "a", "b", "c", "d"], (s) => (s === "heavy" ? 6 : 0.5), 1, rng);
      if (x === "heavy") heavy++;
    }
    // 期待値は 6 / (6 + 0.5*4) = 75%
    expect(heavy / 2000).toBeGreaterThan(0.7);
    expect(heavy / 2000).toBeLessThan(0.8);
  });
});

describe("モード別の出題", () => {
  const QUESTIONS = ORIGINAL_QUESTIONS;
  const wrongId = QUESTIONS[0].id;
  const rightId = QUESTIONS[1].id;
  let progress = applyAnswer({}, wrongId, false);
  progress = applyAnswer(progress, rightId, true);

  it("苦手だけ復習 は苦手な問題だけを出す", () => {
    const qs = prepareQuizByMode(QUESTIONS, 10, "weakOnly", progress, { rng: seededRng(1) });
    expect(qs.map((q) => q.id)).toEqual([wrongId]);
    expect(availableCount(QUESTIONS, "weakOnly", progress)).toBe(1);
  });

  it("苦手がなければ 苦手だけ復習 は0問", () => {
    expect(prepareQuizByMode(QUESTIONS, 10, "weakOnly", {})).toHaveLength(0);
  });

  it("まだ解いていない問題 は、解いた問題を出さない", () => {
    const qs = prepareQuizByMode(QUESTIONS, 100, "unanswered", progress, { rng: seededRng(2) });
    expect(qs).toHaveLength(QUESTIONS.length - 2);
    expect(qs.some((q) => q.id === wrongId || q.id === rightId)).toBe(false);
    expect(availableCount(QUESTIONS, "unanswered", progress)).toBe(QUESTIONS.length - 2);
  });

  it("苦手を重点 では苦手な問題が出やすい", () => {
    const rng = seededRng(3);
    let hit = 0;
    for (let i = 0; i < 500; i++) {
      const qs = prepareQuizByMode(QUESTIONS, 5, "focus", progress, { rng });
      if (qs.some((q) => q.id === wrongId)) hit++;
    }
    // 通常のランダムなら 5/18 ≒ 28%。重みづけでそれより明らかに高くなる
    expect(hit / 500).toBeGreaterThan(0.6);
  });

  it("選択肢は並べ替えない(国試は番号に意味がある)", () => {
    const original = new Map(QUESTIONS.map((q) => [q.id, q]));
    for (const mode of ["normal", "unanswered", "focus", "weakOnly"] as const) {
      for (const q of prepareQuizByMode(QUESTIONS, 18, mode, progress, { rng: seededRng(5) })) {
        expect(q.choices).toEqual(original.get(q.id)!.choices);
      }
    }
  });
});
describe("前後の比較", () => {
  it("克服した問題と新しく苦手になった問題を見分ける", () => {
    let before = applyAnswer({}, "a", false);
    before = applyAnswer(before, "a", true);
    let after = applyAnswer(before, "a", true); // a: 克服
    after = applyAnswer(after, "b", false); // b: 新しく苦手
    after = applyAnswer(after, "c", true); // c: 変化なし
    expect(diffProgress(before, after, ["a", "b", "c"])).toEqual({
      newlyMastered: ["a"],
      newlyWeak: ["b"],
    });
  });
});
