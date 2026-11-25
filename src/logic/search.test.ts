import { describe, expect, it } from "vitest";
import type { Question } from "../types/quiz";
import { kakomonPath, parseRef, searchQuestions } from "./search";

const q = (id: string, exam: number, session: "午前" | "午後", no: number, stem: string, extra: Partial<Question> = {}): Question => ({
  id,
  exam,
  session,
  no,
  part: "専門分野",
  stem,
  choices: ["あ", "い", "う", "え", "お"],
  pick: 1,
  answers: [[1]],
  ...extra,
});

const bank: Question[] = [
  q("60A021", 60, "午前", 21, "FIM の採点で正しいのはどれか。"),
  q("60B005", 60, "午後", 5, "脳卒中の患者。"),
  q("59A021", 59, "午前", 21, "Ｆｉｍ について。"),
  q("58A010", 58, "午前", 10, "上肢の評価。", { explanation: { text: "FIM ではなく BI で評価します。", reviewed: false } }),
];

describe("問題番号の読み取り", () => {
  it.each([
    ["60A21", { exam: 60, session: "午前", no: 21 }],
    ["60a021", { exam: 60, session: "午前", no: 21 }],
    ["60B5", { exam: 60, session: "午後", no: 5 }],
    ["60P5", { exam: 60, session: "午後", no: 5 }],
    ["６０Ａ２１", { exam: 60, session: "午前", no: 21 }],
    ["第60回 午前21", { exam: 60, session: "午前", no: 21 }],
    ["第60回午前 問21", { exam: 60, session: "午前", no: 21 }],
    ["60回 午後 5問", { exam: 60, session: "午後", no: 5 }],
    ["60 午前 21", { exam: 60, session: "午前", no: 21 }],
    ["第60回", { exam: 60 }],
  ])("%s", (input, ref) => {
    expect(parseRef(input).ref).toEqual(ref);
  });

  it("言葉はそのまま残る", () => {
    expect(parseRef("第60回 FIM").rest).toBe("fim");
  });
});

describe("問題をさがす", () => {
  it("問題番号でその問題だけ", () => {
    const r = searchQuestions(bank, "60A21");
    expect(r.hits.map((h) => h.question.id)).toEqual(["60A021"]);
  });

  it("言葉は全角・大文字小文字を区別しない。問題文で当たったものが先", () => {
    const r = searchQuestions(bank, "fim");
    expect(r.hits.map((h) => h.question.id)).toEqual(["60A021", "59A021", "58A010"]);
  });

  it("回と言葉をまぜて絞りこめる", () => {
    expect(searchQuestions(bank, "第59回 FIM").hits.map((h) => h.question.id)).toEqual(["59A021"]);
  });

  it("空白で区切った言葉は、すべてふくむものだけ", () => {
    expect(searchQuestions(bank, "FIM 採点").hits.map((h) => h.question.id)).toEqual(["60A021"]);
  });

  it("空の検索では何も出さない", () => {
    expect(searchQuestions(bank, "  ").total).toBe(0);
  });

  it("解説ページの場所", () => {
    expect(kakomonPath(bank[3])).toBe("../kakomon/58/a010.html");
    expect(kakomonPath(bank[0])).toBeNull(); // 解説がない
  });
});
