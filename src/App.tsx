import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerRecord, ExamIndexEntry, Question } from "./types/quiz";
import { loadQuestionBank } from "./data/load";
import { ORIGINAL_QUESTIONS } from "./data/original";
import { filterQuestions, type QuizFilter } from "./logic/quiz";
import { applyAnswer, prepareQuizByMode, type ProgressMap, type QuizMode } from "./logic/weakness";
import { createProgressStore, type ProgressStore } from "./storage/progress";
import { HomeScreen } from "./components/HomeScreen";
import { QuizScreen } from "./components/QuizScreen";
import { ResultScreen } from "./components/ResultScreen";
import { WeakListScreen } from "./components/WeakListScreen";

type Screen =
  | { name: "home" }
  | { name: "weak" }
  | { name: "quiz"; questions: Question[]; runId: number; before: ProgressMap; retry: QuizSettings | Question[] }
  | { name: "result"; questions: Question[]; records: AnswerRecord[]; before: ProgressMap; retry: QuizSettings | Question[] };

export interface QuizSettings {
  filter: QuizFilter;
  count: number;
  mode: QuizMode;
  /** 番号順に出すか */
  ordered: boolean;
}

type LoadState = "loading" | "ready" | "failed";

const DEFAULT_SETTINGS: QuizSettings = {
  filter: { exams: [], sessions: ["午前", "午後"], parts: ["実地問題", "専門分野", "専門基礎分野"] },
  count: 10,
  mode: "normal",
  ordered: false,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
  const [questions, setQuestions] = useState<Question[]>([...ORIGINAL_QUESTIONS]);
  const [exams, setExams] = useState<ExamIndexEntry[]>([]);
  const [bankState, setBankState] = useState<LoadState>("loading");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storeKind, setStoreKind] = useState<ProgressStore["kind"]>("local");
  const storeRef = useRef<ProgressStore | null>(null);
  const progressRef = useRef<ProgressMap>({});
  const loadStateRef = useRef<LoadState>("loading");
  loadStateRef.current = loadState;

  // 問題データを読み込む。URL に ?q=61A012 があれば、その問題をすぐ開く
  useEffect(() => {
    let cancelled = false;
    loadQuestionBank()
      .then((bank) => {
        if (cancelled) return;
        setQuestions(bank.questions);
        setExams(bank.exams);
        // 最初は、いちばん新しい回だけを選んでおく
        setSettings((s) => (s.filter.exams.length ? s : { ...s, filter: { ...s.filter, exams: bank.exams.slice(0, 1).map((e) => e.exam) } }));
        setBankState("ready");
        const id = new URLSearchParams(location.search).get("q");
        const q = id ? bank.byId.get(id) : undefined;
        if (q) setScreen({ name: "quiz", questions: [q], runId: Date.now(), before: progressRef.current, retry: [q] });
      })
      .catch(() => !cancelled && setBankState("failed"));
    return () => {
      cancelled = true;
    };
  }, []);

  // 記録を読み込む
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = await createProgressStore();
      storeRef.current = store;
      if (!cancelled) setStoreKind(store.kind);
      try {
        const loaded = await store.load();
        if (cancelled) return;
        progressRef.current = loaded;
        setProgress(loaded);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: ProgressMap) => {
    progressRef.current = next;
    setProgress(next);
    // 読み込みに失敗したときは、保存済みの記録を上書きしないよう保存しない
    if (!storeRef.current || loadStateRef.current !== "ready") return;
    storeRef.current
      .save(next)
      .then(() => setSaveError(null))
      .catch(() => setSaveError("記録を保存できませんでした。通信状態を確認してください。"));
  }, []);

  const startWith = (qs: Question[], retry: QuizSettings | Question[]) => {
    if (qs.length === 0) return;
    setScreen({ name: "quiz", questions: qs, runId: Date.now(), before: progressRef.current, retry });
  };

  const start = (next: QuizSettings) => {
    setSettings(next);
    const pool = filterQuestions(questions, next.filter);
    startWith(prepareQuizByMode(pool, next.count, next.mode, progressRef.current, { ordered: next.ordered }), next);
  };

  const retry = (r: QuizSettings | Question[]) => (Array.isArray(r) ? startWith(r, r) : start(r));

  const goHome = () => {
    // ?q= で開いたあとホームに戻ったら、URL からも消す
    if (location.search) history.replaceState(null, "", location.pathname);
    setScreen({ name: "home" });
  };

  if (bankState === "failed") {
    return (
      <main className="screen">
        <h1>読み込みに失敗しました</h1>
        <p className="notice warn">問題データを読み込めませんでした。通信状態を確認して、ページを開き直してください。</p>
      </main>
    );
  }
  if (bankState === "loading") {
    return (
      <main className="screen">
        <p className="notice">問題を読み込んでいます…</p>
      </main>
    );
  }

  switch (screen.name) {
    case "home":
      return (
        <HomeScreen
          exams={exams}
          questions={questions}
          progress={progress}
          initial={settings}
          loadState={loadState}
          storeKind={storeKind}
          saveError={saveError}
          onStart={start}
          onStartQuestions={(qs) => startWith(qs, qs)}
          onOpenWeakList={() => setScreen({ name: "weak" })}
        />
      );
    case "weak":
      return (
        <WeakListScreen
          questions={questions}
          progress={progress}
          canReset={loadState === "ready"}
          onReset={() => persist({})}
          onReview={() =>
            start({ filter: { exams: exams.map((e) => e.exam), sessions: ["午前", "午後"], parts: ["実地問題", "専門分野", "専門基礎分野", "オリジナル"] }, count: questions.length, mode: "weakOnly", ordered: false })
          }
          onBack={goHome}
        />
      );
    case "quiz":
      return (
        <QuizScreen
          key={screen.runId}
          questions={screen.questions}
          onAnswer={(q, correct) => persist(applyAnswer(progressRef.current, q.id, correct))}
          onFinish={(records) =>
            setScreen({ name: "result", questions: screen.questions, records, before: screen.before, retry: screen.retry })
          }
          onQuit={goHome}
        />
      );
    case "result":
      return (
        <ResultScreen
          questions={screen.questions}
          records={screen.records}
          before={screen.before}
          after={progress}
          saveError={saveError}
          onRetry={() => retry(screen.retry)}
          onHome={goHome}
        />
      );
  }
}
