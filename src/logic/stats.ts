import type { ProgressMap } from "./weakness";

/** 次の国家試験(カウントダウン用) */
export const NEXT_EXAM = {
  name: "第62回",
  /** 筆記試験の日(厚生労働省の発表: 2027年2月21日) */
  date: "2027-02-21",
};

/** 試験日まであと何日か(当日は 0、過ぎたら負の数) */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 連続学習日数
 * - 問題を解いた日が、今日(または昨日)からさかのぼって何日続いているか
 * - 記録は問題ごとの「最後に解いた日時」なので、だいたいの目安
 */
export function studyStreak(progress: ProgressMap, now: Date = new Date()): number {
  const days = new Set(Object.values(progress).map((s) => dayKey(s.lastAnsweredAt)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 今日まだ解いていなければ、昨日から数える(今日解けば続く)
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** これまでの正答率(0〜100、まだ解いていなければ null) */
export function overallAccuracy(progress: ProgressMap): number | null {
  let attempts = 0;
  let wrong = 0;
  for (const s of Object.values(progress)) {
    attempts += s.attempts;
    wrong += s.wrongCount;
  }
  return attempts === 0 ? null : Math.round(((attempts - wrong) / attempts) * 100);
}

/** 結果画面のひとこと(作業療法士国試の合格ラインはおよそ6割) */
export function cheer(rate: number): { title: string; message: string } {
  if (rate === 100) return { title: "パーフェクト！", message: "全問正解です。この調子で、範囲を広げてみましょう。" };
  if (rate >= 80) return { title: "合格ライン、余裕で突破！", message: "かなり仕上がっています。苦手な問題だけ見直せば完璧です。" };
  if (rate >= 60) return { title: "合格ライン突破！", message: "国試の合格ラインはおよそ6割。間違えた問題を復習して、もう一段上へ。" };
  if (rate >= 40) return { title: "あと少しで合格ライン！", message: "間違えた問題は「苦手」に入りました。もう一度解けば、ぐっと伸びます。" };
  return { title: "伸びしろ、たっぷり！", message: "最初はみんなここから。解説を読んで、苦手だけ復習で取り返しましょう。" };
}
