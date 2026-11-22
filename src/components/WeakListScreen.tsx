import { useState } from "react";
import type { Question } from "../types/quiz";
import { answerLabel, examOrder, questionTitle } from "../logic/quiz";
import { MASTERY_STREAK, accuracy, isMastered, isWeak, type ProgressMap } from "../logic/weakness";

interface Props {
  questions: readonly Question[];
  progress: ProgressMap;
  canReset: boolean;
  onReset: () => void;
  onReview: () => void;
  onBack: () => void;
}

export function WeakListScreen({ questions, progress, canReset, onReset, onReview, onBack }: Props) {
  const [confirming, setConfirming] = useState(false);

  const weak = questions
    .filter((q) => isWeak(progress[q.id]))
    .sort((a, b) => progress[b.id].wrongCount - progress[a.id].wrongCount || examOrder(a, b));
  const masteredCount = questions.filter((q) => isMastered(progress[q.id])).length;
  const answeredCount = questions.filter((q) => progress[q.id]).length;

  return (
    <main className="screen">
      <header className="quiz-header">
        <button className="link" onClick={onBack}>
          ← ホーム
        </button>
      </header>
      <h1>苦手一覧</h1>

      <section className="card stats-row">
        <div>
          <p className="stat-num">{weak.length}</p>
          <p className="sub">苦手</p>
        </div>
        <div>
          <p className="stat-num">{masteredCount}</p>
          <p className="sub">克服</p>
        </div>
        <div>
          <p className="stat-num">
            {answeredCount}
            <span className="stat-of">/{questions.length}</span>
          </p>
          <p className="sub">解いた問題</p>
        </div>
      </section>
      <p className="sub">間違えた問題は、そのあと {MASTERY_STREAK} 回続けて正解すると「克服」になります。</p>

      {weak.length === 0 ? (
        <section className="card">
          <p>苦手な問題はありません。</p>
        </section>
      ) : (
        <>
          <button className="primary" onClick={onReview}>
            苦手な問題を全部復習する({weak.length}問)
          </button>
          <section className="card">
            {weak.map((q) => {
              const s = progress[q.id];
              return (
                <details key={q.id} className="review">
                  <summary>
                    <span className="category-tag">{q.part}</span>
                    {questionTitle(q)} {q.stem}
                    <span className="weak-meta">
                      間違い {s.wrongCount}回・正答率 {accuracy(s)}%・連続正解 {s.correctStreak}/{MASTERY_STREAK}
                    </span>
                  </summary>
                  <p>
                    正解: <strong>{answerLabel(q)}</strong>
                  </p>
                  {q.explanation ? <p>{q.explanation.text}</p> : <p className="sub">解説は準備中です。</p>}
                </details>
              );
            })}
          </section>
        </>
      )}

      {canReset && answeredCount > 0 && (
        <section className="card danger-zone">
          {confirming ? (
            <>
              <p>すべての記録(苦手・克服・正答率)を消します。元に戻せません。</p>
              <div className="button-row">
                <button
                  className="danger"
                  onClick={() => {
                    onReset();
                    setConfirming(false);
                  }}
                >
                  記録を消す
                </button>
                <button className="secondary" onClick={() => setConfirming(false)}>
                  やめる
                </button>
              </div>
            </>
          ) : (
            <button className="link" onClick={() => setConfirming(true)}>
              記録をリセット
            </button>
          )}
        </section>
      )}
    </main>
  );
}
