// できあがった問題データ(public/data)の検査
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const index = JSON.parse(readFileSync("public/data/index.json", "utf8"));
const exams = index.exams.map((e) => JSON.parse(readFileSync(`public/data/exams/${e.exam}.json`, "utf8")));
const all = exams.flatMap((e) => e.questions);

describe("問題データ", () => {
  it("第52回〜第61回の10回ぶん、各200問(午前100・午後100)", () => {
    expect(exams.map((e) => e.exam).sort()).toEqual([52, 53, 54, 55, 56, 57, 58, 59, 60, 61]);
    for (const e of exams) {
      expect(e.questions.filter((q) => q.session === "午前")).toHaveLength(100);
      expect(e.questions.filter((q) => q.session === "午後")).toHaveLength(100);
    }
  });

  it("ID は重複しない", () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
  });

  it("選択肢は5つ、正解は1〜5、選ぶ数と正解の数がそろっている", () => {
    for (const q of all) {
      expect(q.choices, q.id).toHaveLength(5);
      for (const set of q.answers) {
        expect(set.length, q.id).toBe(q.pick);
        for (const n of set) expect(n >= 1 && n <= 5, q.id).toBe(true);
      }
      if (q.answers.length === 0) expect(q.excluded, q.id).toBe(true);
    }
  });

  it("選択肢に、図のラベル「別冊No.」がくっついていない", () => {
    for (const q of all) for (const c of q.choices) expect(/別冊\s*No/.test(c), `${q.id}: ${c}`).toBe(false);
  });

  it("選択肢を画像で見せる問題には、画像がある", () => {
    for (const q of all.filter((q) => q.choicesFromImage)) expect(q.image, q.id).toBeTruthy();
  });

  it("参照している画像ファイルがすべてある", () => {
    for (const q of all) {
      for (const src of [q.image, ...(q.bessatsu ?? [])].filter(Boolean)) {
        expect(existsSync(`public/${src}`), `${q.id}: ${src}`).toBe(true);
      }
    }
  });

  it("読めない文字の印が残っていない", () => {
    for (const q of all) expect(/⟦/.test(q.stem + q.choices.join("")), q.id).toBe(false);
  });

  it("厚労省の発表どおり: 第54回 午前93 は複数正解、午前56 は採点除外", () => {
    const byId = new Map(all.map((q) => [q.id, q]));
    expect(byId.get("54A093").answers.length).toBeGreaterThan(1);
    expect(byId.get("54A056").excluded).toBe(true);
  });
});

describe("合格率データ(content/goukaku.json)", () => {
  const g = JSON.parse(readFileSync("content/goukaku.json", "utf8")).exams;
  it("合格率は人数から計算した値と合い、満点は一般+実地", () => {
    for (const r of g) {
      expect(Math.round((r.passed / r.examinees) * 1000) / 10, `第${r.exam}回`).toBe(r.rate);
      expect(Math.round((r.newPassed / r.newExaminees) * 1000) / 10, `第${r.exam}回 新卒`).toBe(r.newRate);
      expect(r.generalMax + r.practicalMax, `第${r.exam}回`).toBe(r.totalMax);
      expect(r.source, `第${r.exam}回`).toMatch(/^https:\/\/www\.mhlw\.go\.jp\//);
    }
  });
});

describe("解説データ", () => {
  it("解説のある問題は実在し、選択肢ごとの解説は5つ", () => {
    const ids = new Set(all.map((q) => q.id));
    for (const e of index.exams) {
      const file = `public/data/explanations/${e.exam}.json`;
      if (!existsSync(file)) continue;
      const ex = JSON.parse(readFileSync(file, "utf8"));
      for (const [id, v] of Object.entries(ex)) {
        expect(ids.has(id), id).toBe(true);
        expect(typeof v.text, id).toBe("string");
        expect(typeof v.reviewed, id).toBe("boolean");
        if (v.choiceNotes) expect(v.choiceNotes, id).toHaveLength(5);
      }
    }
  });

  it("選択肢の解説で「正解」と書いた番号が、厚労省の正答と合っている", () => {
    // 「正解。〜」「誤り(正解)。」「正解扱い。」など、(正解) や 正解 で始まるものを正解の印とみなす
    const MARK = /^正解|[(（]正解[)）]/;
    const byId = new Map(all.map((q) => [q.id, q]));
    const bad = [];
    for (const e of index.exams) {
      const file = `public/data/explanations/${e.exam}.json`;
      if (!existsSync(file)) continue;
      for (const [id, v] of Object.entries(JSON.parse(readFileSync(file, "utf8")))) {
        const q = byId.get(id);
        if (!v.choiceNotes || q.excluded || !q.answers.length) continue;
        const want = [...new Set(q.answers.flat())].sort().join(",");
        const marked = v.choiceNotes.map((n, i) => (MARK.test(n) ? i + 1 : 0)).filter(Boolean).join(",");
        if (want !== marked) bad.push(`${id}(正答 ${want} / 解説 ${marked || "なし"})`);
      }
    }
    expect(bad).toEqual([]);
  });
});
