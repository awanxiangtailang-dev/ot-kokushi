/** 問題の区分(国試は各100問: 1〜20 実地、21〜50 専門、51〜100 専門基礎) */
export const PARTS = ["実地問題", "専門分野", "専門基礎分野", "オリジナル"] as const;
export type Part = (typeof PARTS)[number];

export type Session = "午前" | "午後";

/** 解説 */
export interface Explanation {
  /** 全体の解説 */
  text: string;
  /** 選択肢ごとの解説(選択肢と同じ数) */
  choiceNotes?: string[];
  /** 作業療法士が内容を確認済みか */
  reviewed: boolean;
  /** 根拠にした資料 */
  refs?: string[];
}

/** 1問 */
export interface Question {
  /** 例: "61A012"(第61回 午前 問12)、オリジナルは "risk-001" など */
  id: string;
  /** 第何回か(オリジナル問題は 0) */
  exam: number;
  session?: Session;
  /** 問題番号 */
  no?: number;
  part: Part;
  /** 2問以上で共通の事例文 */
  caseText?: string;
  /** 問題文 */
  stem: string;
  /** 選択肢(国試は5つ、オリジナルは4つ) */
  choices: string[];
  /** 選択肢が図になっていて、文字では表せない */
  choicesFromImage?: boolean;
  /** いくつ選ぶか */
  pick: 1 | 2;
  /** 正解の組み合わせ(1始まりの番号)。複数あるときはどれでも正解。空なら採点除外 */
  answers: number[][];
  /** 採点除外(全員正解扱い)になった問題 */
  excluded?: boolean;
  /** 問題の画像(図・表がある問題、OCRで読んだ回) */
  image?: string | null;
  /** 別冊の画像 */
  bessatsu?: string[];
  /** 文字起こしをOCRで行った(誤字の可能性あり) */
  ocr?: boolean;
  /** 訂正などの注記 */
  note?: string;
  explanation?: Explanation;
}

/** 回の一覧(public/data/index.json) */
export interface ExamIndexEntry {
  exam: number;
  year: number;
  count: number;
  source: string;
}

/** 1問ぶんの回答記録 */
export interface AnswerRecord {
  questionId: string;
  /** 選んだ番号(1始まり) */
  selected: number[];
  correct: boolean;
}

/** 結果のまとめ */
export interface QuizSummary {
  total: number;
  correctCount: number;
  /** 正答率(0〜100 の整数) */
  rate: number;
  wrongIds: string[];
}

// ───────── 以前の4択オリジナル問題の形(src/data/questions.ts) ─────────

export const LEGACY_CATEGORIES = [
  "リスク管理",
  "脳血管疾患",
  "運動器疾患",
  "呼吸・循環器",
  "ICU・せん妄",
  "ADL・嚥下",
] as const;
export type LegacyCategory = (typeof LEGACY_CATEGORIES)[number];
export type ChoiceIndex = 0 | 1 | 2 | 3;
export type Four<T> = readonly [T, T, T, T];

export interface LegacyQuestion {
  id: string;
  category: LegacyCategory;
  question: string;
  choices: Four<string>;
  answerIndex: ChoiceIndex;
  explanation: string;
  choiceNotes?: Four<string>;
  reference?: string;
}
