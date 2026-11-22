import type { AnswerRecord, Part, Question } from "../types/quiz";
import { answerLabel, questionTitle, summarize } from "../logic/quiz";
import { diffProgress, type ProgressMap } from "../logic/weakness";
import { AffiliateBox } from "./AffiliateBox";

interface Props {
  questions: readonly Question[];
  records: readonly AnswerRecord[];
  before: ProgressMap;
  after: ProgressMap;
  saveError: string | null;
  onRetry: () => void;
  onHome: () => void;
}

export function ResultScreen({ questions, records, before, after, saveError, onRetry, onHome }: Props) {
  const summary = summarize(records);
  const answeredIds = records.map((r) => r.questionId);
  const { newlyMastered, newlyWeak } = diffProgress(before, after, answeredIds);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const wrong = questions.filter((q) => summary.wrongIds.includes(q.id));

  // いちばん間違えが多かった区分に合わせて、参考書の案内を出す
  const wrongParts = wrong.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.part]: (acc[q.part] ?? 0) + 1 }), {});
  const weakestPart = (Object.entries(wrongParts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? questions[0]?.part) as Part;

  return (
    <main className="screen">
      <h1>結果</h1>
      {saveError && <p className="notice warn">{saveError}</p>}

      <section className="card score">
        <p className="score-main">
          {summary.correctCount} / {summary.total} 問正解
        </p>
        <p className="score-rate">正答率 {summary.rate}%</p>
      </section>

      {newlyMastered.length > 0 && (
        <section className="card mastered">
          <h2>克服した問題({newlyMastered.length})</h2>
          <ul className="plain-list">
            {newlyMastered.map((id) => {
              const q = byId.get(id);
              return <li key={id}>{q ? questionTitle(q) : id}</li>;
            })}
          </ul>
        </section>
      )}

      {newlyWeak.length > 0 && (
        <section className="card">
          <h2>新しく苦手になった問題({newlyWeak.length})</h2>
          <p className="sub">次回「苦手を重点」「苦手だけ復習」で多めに出題されます。</p>
        </section>
      )}

      {wrong.length > 0 ? (
        <section className="card">
          <h2>間違えた問題</h2>
          {wrong.map((q) => (
            <details key={q.id} className="review">
              <summary>
                <span className="weak-meta-inline">{questionTitle(q)}</span> {q.stem}
              </summary>
              <p>
                正解: <strong>{answerLabel(q)}</strong>
              </p>
              {q.explanation ? <p>{q.explanation.text}</p> : <p className="sub">解説は準備中です。</p>}
            </details>
          ))}
        </section>
      ) : (
        <section className="card">
          <p>全問正解です 🎉</p>
        </section>
      )}

      {weakestPart && <AffiliateBox part={weakestPart} />}

      <button className="primary" onClick={onRetry}>
        同じ条件でもう一度
      </button>
      <button className="secondary" onClick={onHome}>
        ホームに戻る
      </button>
    </main>
  );
}
