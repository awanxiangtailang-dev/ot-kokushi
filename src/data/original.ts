import type { Question } from "../types/quiz";
import { QUESTIONS as LEGACY } from "./questions";

/** 以前のオリジナル4択問題(急性期OT)を、国試と同じ形に変換したもの */
export const ORIGINAL_QUESTIONS: readonly Question[] = LEGACY.map((q) => ({
  id: q.id,
  exam: 0,
  part: "オリジナル",
  stem: `【${q.category}】${q.question}`,
  choices: [...q.choices],
  pick: 1,
  answers: [[q.answerIndex + 1]],
  explanation: {
    text: q.explanation,
    choiceNotes: q.choiceNotes ? [...q.choiceNotes] : undefined,
    reviewed: true,
    refs: q.reference ? [q.reference] : undefined,
  },
}));
