import type { ProgressMap, QuestionStat } from "../logic/weakness";

/**
 * 成績の保存先
 * - 公開版(claude.ai): Claude のデータ保存機能(本人専用の領域)。スマホと PC で共有
 * - それ以外(npm run dev など): このブラウザの localStorage
 */
export interface ProgressStore {
  kind: "cloud" | "local";
  load(): Promise<ProgressMap>;
  save(progress: ProgressMap): Promise<void>;
}

const LOCAL_KEY = "ot-quiz:progress:v1";
const LOAD_TIMEOUT_MS = 10_000;

// ── claude.ai の公開ページで使える機能(必要な部分だけの型) ──
interface DocSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface Db {
  doc(path: string): DocRef;
}
interface UserNs {
  id(): Promise<string | null>;
}
interface ClaudeRuntime {
  use(name: "db"): Promise<Db | null>;
  use(name: "user"): Promise<UserNs | null>;
}
declare global {
  interface Window {
    claude?: ClaudeRuntime;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** 保存データの中身を確かめて、正しい形のものだけ取り出す */
export function parseProgress(raw: unknown): ProgressMap {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, QuestionStat> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);
    const attempts = num(s.attempts);
    const wrongCount = num(s.wrongCount);
    const correctStreak = num(s.correctStreak);
    const lastAnsweredAt = num(s.lastAnsweredAt) ?? 0;
    if (attempts === null || wrongCount === null || correctStreak === null) continue;
    out[id] = { attempts, wrongCount, correctStreak, lastAnsweredAt };
  }
  return out;
}

function localStore(): ProgressStore {
  return {
    kind: "local",
    async load() {
      try {
        const text = localStorage.getItem(LOCAL_KEY);
        return text ? parseProgress(JSON.parse(text)) : {};
      } catch {
        return {};
      }
    },
    async save(progress) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
      } catch {
        throw new Error("このブラウザでは記録を保存できません");
      }
    },
  };
}

function cloudStore(db: Db, userId: string): ProgressStore {
  // 1人1件のドキュメントに全問の成績をまとめて保存する
  const ref = db.doc(`data/users/${userId}/progress`);

  // 書き込みは1件ずつ順番に。待っている間に来た分は最新だけ書く
  let writing: Promise<void> | null = null;
  let pending: ProgressMap | null = null;

  const flush = async (): Promise<void> => {
    while (pending) {
      const next = pending;
      pending = null;
      await ref.set({ stats: next, updatedAt: Date.now() });
    }
  };

  return {
    kind: "cloud",
    async load() {
      const snap = await withTimeout(ref.get(), LOAD_TIMEOUT_MS);
      return snap.exists ? parseProgress(snap.data()?.stats) : {};
    },
    save(progress) {
      pending = progress;
      if (!writing) {
        writing = flush().finally(() => {
          writing = null;
        });
      }
      return writing;
    },
  };
}

/** 使える保存先を選ぶ */
export async function createProgressStore(): Promise<ProgressStore> {
  const claude = window.claude;
  if (!claude) return localStore();
  try {
    const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    const id = user ? await user.id() : null;
    if (db && id) return cloudStore(db, id);
  } catch {
    // 使えなければブラウザ内に保存
  }
  return localStore();
}
