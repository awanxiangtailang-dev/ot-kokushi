import { useState } from "react";
import type { ExamIndexEntry, Part, Question, Session } from "../types/quiz";
import { PARTS } from "../types/quiz";
import { dailyQuestion, filterQuestions, questionTitle, type QuizFilter } from "../logic/quiz";
import { MODE_LABELS, availableCount, weakQuestions, type ProgressMap, type QuizMode } from "../logic/weakness";
import { SITE } from "../config/site";
import type { QuizSettings } from "../App";
import { SourceNote } from "./SourceNote";

interface Props {
  exams: readonly ExamIndexEntry[];
  questions: readonly Question[];
  progress: ProgressMap;
  initial: QuizSettings;
  loadState: "loading" | "ready" | "failed";
  storeKind: "cloud" | "local";
  saveError: string | null;
  onStart: (settings: QuizSettings) => void;
  onStartQuestions: (questions: Question[]) => void;
  onOpenWeakList: () => void;
}

const COUNT_OPTIONS = [10, 20, 50, 100] as const;
const MODES: QuizMode[] = ["normal", "unanswered", "focus", "weakOnly"];
const MODE_HELP: Record<QuizMode, string> = {
  normal: "範囲の中から出題します",
  unanswered: "まだ一度も解いていない問題だけを出題します",
  focus: "苦手な問題を多めに、ほかの問題もまぜて出題します",
  weakOnly: "苦手な問題だけを出題します",
};
const SESSIONS: Session[] = ["午前", "午後"];

function toggle<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function HomeScreen(props: Props) {
  const { exams, questions, progress, initial, loadState, storeKind, saveError } = props;
  const [filter, setFilter] = useState<QuizFilter>(initial.filter);
  const [count, setCount] = useState<number>(initial.count);
  const [mode, setMode] = useState<QuizMode>(initial.mode);
  const [ordered, setOrdered] = useState<boolean>(initial.ordered);

  const pool = filterQuestions(questions, filter);
  const available = availableCount(pool, mode, progress);
  const options = [
    ...COUNT_OPTIONS.filter((n) => n < available).map((n) => ({ label: `${n}問`, value: n })),
    { label: `全部(${available}問)`, value: available },
  ];
  const actualCount = Math.min(count, available);
  const totalWeak = weakQuestions(questions, progress).length;
  const answered = questions.filter((q) => progress[q.id]).length;
  const today = dailyQuestion(questions);
  const allExams = exams.map((e) => e.exam);
  const allSelected = allExams.every((e) => filter.exams.includes(e));

  return (
    <main className="screen">
      <p className="eyebrow">
        <a href={SITE.blogUrl}>OT国試ノート</a>
      </p>
      <h1>{SITE.appName}</h1>
      <p className="sub lead">
        作業療法士国家試験の第{Math.min(...allExams)}回〜第{Math.max(...allExams)}回、{questions.length - questions.filter((q) => q.part === "オリジナル").length}問を収録。正答は厚生労働省の発表どおりです。
      </p>

      {loadState === "loading" && <p className="notice">記録を読み込んでいます…</p>}
      {loadState === "failed" && (
        <p className="notice warn">記録を読み込めませんでした。今回の回答は保存されません。通信状態を確認して開き直してください。</p>
      )}
      {saveError && <p className="notice warn">{saveError}</p>}

      {today && (
        <section className="card today">
          <p className="today-label">今日の1問</p>
          <p className="today-title">{questionTitle(today)}</p>
          <p className="today-stem">{(today.caseText ? today.caseText + " " : "") + today.stem}</p>
          <button className="secondary" onClick={() => props.onStartQuestions([today])}>
            解いてみる
          </button>
        </section>
      )}

      <section className="card weak-summary">
        <div>
          <p className="weak-count">
            苦手な問題 <strong>{totalWeak}</strong> 問
          </p>
          <p className="sub">
            解いた問題 {answered} / {questions.length}・
            {storeKind === "cloud" ? "記録はスマホと PC で共有されます" : "記録はこのブラウザに保存されます"}
          </p>
        </div>
        <button className="secondary small" onClick={props.onOpenWeakList}>
          苦手一覧
        </button>
      </section>

      <section className="card">
        <h2>回</h2>
        <div className="option-grid">
          <button
            className={`chip ${allSelected ? "selected" : ""}`}
            aria-pressed={allSelected}
            onClick={() => setFilter({ ...filter, exams: allSelected ? [] : allExams })}
          >
            全部
          </button>
          {exams.map((e) => (
            <button
              key={e.exam}
              className={`chip ${filter.exams.includes(e.exam) ? "selected" : ""}`}
              aria-pressed={filter.exams.includes(e.exam)}
              onClick={() => setFilter({ ...filter, exams: toggle(filter.exams, e.exam) })}
            >
              第{e.exam}回<span className="chip-sub">{e.year}</span>
            </button>
          ))}
        </div>
        <h3>午前・午後</h3>
        <div className="option-grid">
          {SESSIONS.map((s) => (
            <button
              key={s}
              className={`chip ${filter.sessions.includes(s) ? "selected" : ""}`}
              aria-pressed={filter.sessions.includes(s)}
              onClick={() => setFilter({ ...filter, sessions: toggle(filter.sessions, s) })}
            >
              {s}
            </button>
          ))}
        </div>
        <h3>区分</h3>
        <div className="option-grid">
          {PARTS.map((p: Part) => {
            const weak = weakQuestions(filterQuestions(questions, { ...filter, parts: [p] }), progress).length;
            return (
              <button
                key={p}
                className={`chip ${filter.parts.includes(p) ? "selected" : ""}`}
                aria-pressed={filter.parts.includes(p)}
                onClick={() => setFilter({ ...filter, parts: toggle(filter.parts, p) })}
              >
                {p}
                {weak > 0 && <span className="weak-badge">苦手 {weak}</span>}
              </button>
            );
          })}
        </div>
        <p className="sub">実地問題=各回の問1〜20、専門分野=問21〜50、専門基礎分野=問51〜100。オリジナルは急性期OTの自作問題です。</p>
      </section>

      <section className="card">
        <h2>出題のしかた</h2>
        <div className="option-grid">
          {MODES.map((m) => (
            <button key={m} className={`chip ${mode === m ? "selected" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="sub">{MODE_HELP[mode]}</p>
        {(mode === "normal" || mode === "unanswered") && (
          <div className="option-grid order-row">
            <button className={`chip ${!ordered ? "selected" : ""}`} aria-pressed={!ordered} onClick={() => setOrdered(false)}>
              ランダム
            </button>
            <button className={`chip ${ordered ? "selected" : ""}`} aria-pressed={ordered} onClick={() => setOrdered(true)}>
              番号順(本番と同じ並び)
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>問題数</h2>
        {available === 0 ? (
          <p className="sub">
            {mode === "weakOnly"
              ? "この範囲に苦手な問題はありません。"
              : mode === "unanswered"
                ? "この範囲の問題はすべて解きました。"
                : "出題範囲を選んでください。"}
          </p>
        ) : (
          <div className="option-grid">
            {options.map((o) => (
              <button
                key={o.label}
                className={`chip ${actualCount === o.value ? "selected" : ""}`}
                aria-pressed={actualCount === o.value}
                onClick={() => setCount(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <button
        className="primary start"
        disabled={available === 0 || loadState === "loading"}
        onClick={() => props.onStart({ filter, count: actualCount, mode, ordered })}
      >
        スタート
      </button>

      <section className="card blog-links">
        <h2>勉強のしかたに迷ったら</h2>
        <p className="sub">現役の作業療法士が、自分の国試勉強を振り返って書いた体験談です。</p>
        <ul className="plain-list">
          <li>
            <a href={SITE.scheduleUrl}>国試までの勉強スケジュール</a>
          </li>
          <li>
            <a href={SITE.textbooksUrl}>国試対策で実際に使った参考書・問題集</a>
            <span className="pr-inline">PR</span>
          </li>
        </ul>
      </section>

      {exams.length > 0 && <SourceNote exams={exams} />}
    </main>
  );
}
