import type { ExamIndexEntry, Explanation, Question } from "../types/quiz";
import { ORIGINAL_QUESTIONS } from "./original";

/** public/ に置いたデータの場所(公開先のどこに置いても動くよう相対パス) */
export function assetUrl(path: string): string {
  return `./${path.replace(/^\.?\//, "")}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`${path} を読み込めませんでした (${res.status})`);
  return (await res.json()) as T;
}

interface ExamFile {
  exam: number;
  year: number;
  source: string;
  questions: Question[];
}

export interface QuestionBank {
  exams: ExamIndexEntry[];
  questions: Question[];
  byId: Map<string, Question>;
}

/** すべての回の問題と解説を読み込む */
export async function loadQuestionBank(): Promise<QuestionBank> {
  const { exams } = await getJson<{ exams: ExamIndexEntry[] }>("data/index.json");
  const files = await Promise.all(
    exams.map(async (e) => {
      const [file, explanations] = await Promise.all([
        getJson<ExamFile>(`data/exams/${e.exam}.json`),
        // 解説はまだない回もあるので、なければ空にする
        getJson<Record<string, Explanation>>(`data/explanations/${e.exam}.json`).catch(
          () => ({}) as Record<string, Explanation>,
        ),
      ]);
      return file.questions.map((q) => (explanations[q.id] ? { ...q, explanation: explanations[q.id] } : q));
    }),
  );
  const questions = [...files.flat(), ...ORIGINAL_QUESTIONS];
  return { exams, questions, byId: new Map(questions.map((q) => [q.id, q])) };
}
