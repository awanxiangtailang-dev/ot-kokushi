import type { ExamIndexEntry } from "../types/quiz";

/** 出典の表示(公共データ利用規約 PDL1.0 に沿って、出典と加工したことを書く) */
export function SourceNote({ exams }: { exams: readonly ExamIndexEntry[] }) {
  return (
    <footer className="source-note">
      <p>
        問題・正答の出典: 厚生労働省ホームページ「作業療法士国家試験の問題および正答について」
        (第{Math.min(...exams.map((e) => e.exam))}回〜第{Math.max(...exams.map((e) => e.exam))}回)
        をもとに、本アプリが文字起こし・画像化などの加工をして作成しています。
      </p>
      <details>
        <summary>各回の出典ページ</summary>
        <ul>
          {exams.map((e) => (
            <li key={e.exam}>
              <a href={e.source} target="_blank" rel="noopener">
                第{e.exam}回({e.year}年)
              </a>
            </li>
          ))}
        </ul>
      </details>
      <p>
        解説は本アプリ独自のもので、厚生労働省が作成したものではありません。「未監修」の解説は内容を確認中です。正確な情報は教科書・最新のガイドラインで確認してください。
      </p>
    </footer>
  );
}
