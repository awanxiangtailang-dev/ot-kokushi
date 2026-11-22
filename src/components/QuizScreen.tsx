import { useState } from "react";
import type { AnswerRecord, Question } from "../types/quiz";
import { correctNumbers, recordAnswer } from "../logic/quiz";
import { ExplanationPanel } from "./ExplanationPanel";
import { QuestionView } from "./QuestionView";
import { AffiliateBox } from "./AffiliateBox";
import { ShareButton } from "./ShareButton";

interface Props {
  questions: readonly Question[];
  onAnswer: (question: Question, correct: boolean) => void;
  onFinish: (records: AnswerRecord[]) => void;
  onQuit: () => void;
}

export function QuizScreen({ questions, onAnswer, onFinish, onQuit }: Props) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [answered, setAnswered] = useState<AnswerRecord | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  // 連続正解の数(このクイズの中で)
  const [combo, setCombo] = useState(0);

  const q = questions[index];
  const isLast = index === questions.length - 1;
  const right = correctNumbers(q);

  const submit = (selected: number[]) => {
    const record = recordAnswer(q, selected);
    setAnswered(record);
    setRecords((prev) => [...prev, record]);
    setCombo((c) => (record.correct ? c + 1 : 0));
    onAnswer(q, record.correct);
  };

  const tap = (n: number) => {
    if (answered) return; // 回答後は変更不可
    if (q.pick === 1) {
      setPicked([n]);
      submit([n]);
      return;
    }
    // 2つ選ぶ問題: もう一度押すと取り消し。2つ選んだら「回答する」
    setPicked((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < 2 ? [...prev, n] : prev));
  };

  const next = () => {
    if (isLast) {
      onFinish(records);
      return;
    }
    setIndex(index + 1);
    setPicked([]);
    setAnswered(null);
    window.scrollTo({ top: 0 });
  };

  const choiceClass = (n: number) => {
    if (!answered) return picked.includes(n) ? "choice picked" : "choice";
    if (right.has(n)) return "choice correct";
    if (picked.includes(n)) return "choice wrong";
    return "choice dim";
  };

  return (
    <main className="screen">
      <header className="quiz-header">
        <button className="link" onClick={onQuit}>
          ← やめる
        </button>
        {combo >= 2 && (
          <span className="combo" key={combo}>
            🔥 {combo}連続
          </span>
        )}
        <span className="progress">
          {index + 1} / {questions.length}
        </span>
      </header>
      <div className="progress-bar">
        <div style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <QuestionView question={q} />

      <div className={`choices ${q.choicesFromImage ? "numbers-only" : ""}`}>
        {q.choices.map((c, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              className={choiceClass(n)}
              onClick={() => tap(n)}
              disabled={!!answered}
              aria-pressed={picked.includes(n)}
            >
              <span className="choice-label">{n}</span>
              {!q.choicesFromImage && <span>{c}</span>}
            </button>
          );
        })}
      </div>
      {q.choicesFromImage && !answered && <p className="sub">選択肢は上の図を見て、番号で答えてください。</p>}

      {q.pick === 2 && !answered && (
        <button className="primary" disabled={picked.length !== 2} onClick={() => submit(picked)}>
          {picked.length === 2 ? "この2つで回答する" : `あと${2 - picked.length}つ選んでください`}
        </button>
      )}

      {answered && (
        <>
          <ExplanationPanel question={q} selected={answered.selected} correct={answered.correct} combo={combo} />
          <button className="primary" onClick={next}>
            {isLast ? "結果を見る" : "次の問題へ"}
          </button>
          <div className="after-answer">
            <ShareButton question={q} />
          </div>
          <AffiliateBox part={q.part} />
        </>
      )}
    </main>
  );
}
