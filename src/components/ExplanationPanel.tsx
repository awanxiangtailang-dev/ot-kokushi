import { answerLabel, correctNumbers, isExcluded } from "../logic/quiz";
import type { Question } from "../types/quiz";
import { Confetti } from "./Confetti";
import { SITE } from "../config/site";

interface Props {
  question: Question;
  selected: readonly number[];
  correct: boolean;
  /** いま何問続けて正解しているか */
  combo?: number;
}

/** 正解・解説 */
export function ExplanationPanel({ question: q, selected, correct, combo = 0 }: Props) {
  const ex = q.explanation;
  const right = correctNumbers(q);
  const excluded = isExcluded(q);
  return (
    <section className={`explanation ${correct ? "ok" : "ng"}`} aria-live="polite">
      {correct && !excluded && <Confetti />}
      <p className="verdict">{excluded ? "採点除外の問題" : correct ? "正解！" : "おしい！"}</p>
      <p className="verdict-sub">
        {excluded
          ? "この問題は正答率・苦手には数えません。解説で中身だけおさえておこう。"
          : correct
          ? combo >= 3
            ? `🔥 ${combo}問連続正解！ この調子！`
            : "ナイス！ 解説でもう一度おさえておこう。"
          : "間違えた問題は「苦手」に入りました。解説を読めば、次は取れます。"}
      </p>
      <p>
        正解: <strong>{answerLabel(q)}</strong>
        {selected.length > 0 && <span className="sub"> (あなたの答え: {selected.join(" と ")})</span>}
      </p>
      {excluded && <p className="sub">この問題は厚生労働省の発表で、採点の対象から外されました(国試の点数に数えない問題です)。</p>}
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
          {q.exam > 0 && q.no && (
            <p className="reference">
              <a href={`${SITE.kakomonUrl}${q.exam}/${q.session === "午前" ? "a" : "b"}${String(q.no).padStart(3, "0")}.html`}>
                この問題の解説ページを開く →
              </a>
            </p>
          )}
        </>
      ) : (
        <p className="sub">この問題の解説は準備中です。</p>
      )}
    </section>
  );
}
