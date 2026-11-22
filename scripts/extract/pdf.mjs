// pdf.js を Node で使うための共通設定
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

export async function openPdf(file) {
  return getDocument({
    data: new Uint8Array(readFileSync(file)),
    verbosity: 0,
    cMapUrl: "node_modules/pdfjs-dist/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
}

/** 対象の回(第52回〜第61回) */
export const EXAMS = [52, 53, 54, 55, 56, 57, 58, 59, 60, 61];
/** 午前=a, 午後=b */
export const SESSIONS = [
  { key: "a", label: "午前", idPrefix: "A" },
  { key: "b", label: "午後", idPrefix: "B" },
];

/** 厚労省の掲載ページ(出典表示に使う) */
export const SOURCE_PAGES = {
  52: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp170425-08_09.html",
  53: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp180511-08_09.html",
  54: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp190415-08_09.html",
  55: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp200414-08_09.html",
  56: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp210416-08_09.html",
  57: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp220421-08_09.html",
  58: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp230524-08_09.html",
  59: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp240424-08_09.html",
  60: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp250428-08_09.html",
  61: "https://www.mhlw.go.jp/seisakunitsuite/bunya/kenkou_iryou/iryou/topics/tp260424-08_09.html",
};

/** 実施年(西暦) */
export const EXAM_YEAR = { 52: 2017, 53: 2018, 54: 2019, 55: 2020, 56: 2021, 57: 2022, 58: 2023, 59: 2024, 60: 2025, 61: 2026 };

/** 文字コードが壊れている(フォントに正しい対応表がない)文字か */
export function isBrokenChar(ch) {
  const c = ch.codePointAt(0);
  return c < 0x20 || (c >= 0x7f && c <= 0xff);
}

/** 壊れた文字の目印: ⟦フォント名:16進コード⟧ */
export function glyphKey(fontName, ch) {
  // "g_d3_f12" の "g_d3_" は開いた順番で変わるので取り除く
  return `${fontName.replace(/^g_d\d+_/, "")}:${ch.codePointAt(0).toString(16).padStart(4, "0")}`;
}
