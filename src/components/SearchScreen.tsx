import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "../types/quiz";
import { questionTitle } from "../logic/quiz";
import { kakomonPath, normalize, parseRef, searchQuestions } from "../logic/search";

interface Props {
  questions: readonly Question[];
  initialQuery: string;
  onStartQuestions: (questions: Question[]) => void;
  onBack: () => void;
}

const EXAMPLES = ["FIM", "半側空間無視", "60A21", "第61回 午後5", "第59回 認知症"];

/** 当たった言葉に印をつける */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) => (words.includes(part.toLowerCase()) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
    </>
  );
}

export function SearchScreen({ questions, initialQuery, onStartQuestions, onBack }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const { hits, total } = useMemo(() => searchQuestions(questions, query), [questions, query]);
  const words = useMemo(() => parseRef(query).rest.split(" ").filter(Boolean), [query]);
  const trimmed = normalize(query);

  // 問題番号ぴったり(1問だけ)なら、そのまま解けるボタンを大きく出す
  const exact = total === 1 && words.length === 0 ? hits[0].question : null;

  return (
    <main className="screen">
      <header className="quiz-header">
        <button className="link" onClick={onBack}>
          ← ホーム
        </button>
      </header>
      <h1>問題をさがす</h1>

      <form
        className="search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          inputRef.current?.blur();
        }}
      >
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワード(例: FIM)や 問題番号(例: 60A21)"
          aria-label="キーワードか問題番号"
        />
      </form>

      {!trimmed ? (
        <section className="card">
          <p className="sub">問題文・選択肢・解説から、キーワードでさがせます。問題番号でもさがせます。</p>
          <div className="chip-row">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => setQuery(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <p className="sub">
            問題番号の書き方: 「60A21」(第60回 午前21)、「60B5」(午後5)、「第60回 午前21」。
            空白で言葉を区切ると、すべてふくむ問題だけを出します。
          </p>
        </section>
      ) : total === 0 ? (
        <section className="card">
          <p>見つかりませんでした。</p>
          <p className="sub">言葉を短くしたり、ひらがな・カタカナを変えたりしてみてください(例: 「半側空間無視」→「無視」)。</p>
        </section>
      ) : (
        <>
          <p className="sub search-count">
            {total}問見つかりました{total > hits.length ? `(上から${hits.length}問を表示)` : ""}
          </p>
          {exact ? (
            <button className="primary" onClick={() => onStartQuestions([exact])}>
              {questionTitle(exact)} を解く
            </button>
          ) : (
            <button className="primary" onClick={() => onStartQuestions(hits.map((h) => h.question))}>
              見つかった{hits.length}問をまとめて解く
            </button>
          )}
          <ul className="search-results">
            {hits.map(({ question: q, snippet }) => {
              const page = kakomonPath(q);
              return (
                <li key={q.id} className="card search-hit">
                  <p className="search-title">
                    <span className="category-tag">{q.part}</span>
                    {questionTitle(q)}
                  </p>
                  <p className="search-snippet">
                    <Highlight text={snippet} words={words} />
                  </p>
                  <div className="button-row">
                    <button className="secondary" onClick={() => onStartQuestions([q])}>
                      この問題を解く
                    </button>
                    {page && (
                      <a className="search-link" href={page}>
                        解説ページ →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
