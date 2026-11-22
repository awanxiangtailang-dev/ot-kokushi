import { answerLabel, correctNumbers } from "../logic/quiz";
import type { Question } from "../types/quiz";

interface Props {
  question: Question;
  selected: readonly number[];
  correct: boolean;
}

/** 正解・解説 */
export function ExplanationPanel({ question: q, selected, correct }: Props) {
  const ex = q.explanation;
  const right = correctNumbers(q);
  return (
    <section className={`explanation ${correct ? "ok" : "ng"}`} aria-live="polite">
      <p className="verdict">{correct ? "正解！" : "不正解"}</p>
      <p>
        正解: <strong>{answerLabel(q)}</strong>
        {selected.length > 0 && <span className="sub"> (あなたの答え: {selected.join(" と ")})</span>}
      </p>
      {q.excluded && <p className="sub">この問題は厚生労働省の発表で採点除外(全員正解扱い)になりました。</p>}
      {q.answers.length > 1 && <p className="sub">この問題は厚生労働省の発表で、複数の答えが正解として扱われました。</p>}

      {ex ? (
        <>
          <h3>
            解説
            {!ex.reviewed && <span className="unreviewed">未監修</span>}
          </h3>
          <p className="ex-text">{ex.text}</p>
          {ex.choiceNotes && (
            <ul className="notes">
              {ex.choiceNotes.map((note, i) => {
                const n = i + 1;
                const cls = right.has(n) ? "note-answer" : selected.includes(n) ? "note-selected" : "";
                return (
                  <li key={n} className={cls}>
                    <strong>{n}.</strong> {note}
                  </li>
                );
              })}
            </ul>
          )}
          {ex.refs && ex.refs.length > 0 && <p className="reference">参考: {ex.refs.join(" / ")}</p>}
        </>
      ) : (
        <p className="sub">この問題の解説は準備中です。</p>
      )}
    </section>
  );
}
