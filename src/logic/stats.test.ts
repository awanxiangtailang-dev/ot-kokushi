import { describe, expect, it } from "vitest";
import { cheer, daysUntil, overallAccuracy, studyStreak } from "./stats";
import type { ProgressMap } from "./weakness";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const stat = (t: number, attempts = 1, wrong = 0) => ({ attempts, wrongCount: wrong, correctStreak: 0, lastAnsweredAt: t });

describe("試験までの日数", () => {
  it("前日は1、当日は0", () => {
    expect(daysUntil("2027-02-21", new Date(2027, 1, 20, 23))).toBe(1);
    expect(daysUntil("2027-02-21", new Date(2027, 1, 21, 9))).toBe(0);
    expect(daysUntil("2027-02-21", new Date(2026, 10, 22))).toBe(91);
  });
});

describe("連続学習日数", () => {
  const now = new Date(2026, 10, 22, 20);

  it("今日・昨日・おとといと続けば3日", () => {
    const p: ProgressMap = { a: stat(at(2026, 11, 22)), b: stat(at(2026, 11, 21)), c: stat(at(2026, 11, 20)) };
    expect(studyStreak(p, now)).toBe(3);
  });

  it("今日まだ解いていなくても、昨日まで続いていれば途切れない", () => {
    const p: ProgressMap = { a: stat(at(2026, 11, 21)), b: stat(at(2026, 11, 20)) };
    expect(studyStreak(p, now)).toBe(2);
  });

  it("おととい以前で止まっていれば0", () => {
    expect(studyStreak({ a: stat(at(2026, 11, 19)) }, now)).toBe(0);
    expect(studyStreak({}, now)).toBe(0);
  });
});

describe("正答率とひとこと", () => {
  it("正答率", () => {
    expect(overallAccuracy({ a: stat(0, 3, 1), b: stat(0, 1, 0) })).toBe(75);
    expect(overallAccuracy({})).toBeNull();
  });

  it("合格ライン(6割)を境にメッセージが変わる", () => {
    expect(cheer(100).title).toBe("パーフェクト！");
    expect(cheer(60).title).toBe("合格ライン突破！");
    expect(cheer(59).title).toBe("あと少しで合格ライン！");
  });
});
