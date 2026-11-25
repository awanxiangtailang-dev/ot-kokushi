import { describe, it, expect } from "vitest";
import { parsePost, mdToHtml } from "./make-blog.mjs";

describe("臨床ノート", () => {
  it("先頭の --- からタイトルなどを読む", () => {
    const { meta, body } = parsePost("---\ntitle: テスト\ndate: 2026-12-01\ntags: 身体障害, 評価\ndraft: true\n---\n本文");
    expect(meta.title).toBe("テスト");
    expect(meta.date).toBe("2026-12-01");
    expect(meta.tags).toEqual(["身体障害", "評価"]);
    expect(meta.draft).toBe(true);
    expect(body).toBe("本文");
  });

  it("--- がないとエラーにする", () => {
    expect(() => parsePost("本文だけ")).toThrow();
  });

  it("見出し・段落・箇条書き・太字・リンクを HTML にする", () => {
    const html = mdToHtml("## 見出し\n\n段落の**太字**と[アプリ](../app/)\n\n- 1つ目\n- 2つ目");
    expect(html).toContain("<h2>見出し</h2>");
    expect(html).toContain("<strong>太字</strong>");
    expect(html).toContain('<a href="../app/">アプリ</a>');
    expect(html).toContain("<ul><li>1つ目</li><li>2つ目</li></ul>");
  });

  it("HTML のタグはそのまま出さない(書いた文字として表示する)", () => {
    expect(mdToHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("javascript: のリンクは作らない", () => {
    expect(mdToHtml("[x](javascript:alert(1))")).not.toContain("href");
  });
});
