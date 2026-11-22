import { SITE } from "../config/site";
import { questionTitle } from "../logic/quiz";
import type { Question } from "../types/quiz";

/** この問題へのリンク(?q=ID で直接開ける) */
export function questionLink(q: Question): string {
  const base = SITE.publicAppUrl || `${location.origin}${location.pathname}`;
  return `${base}?q=${encodeURIComponent(q.id)}`;
}

/** X(旧Twitter)でこの問題をシェアする */
export function ShareButton({ question, label = "この問題をXでシェア" }: { question: Question; label?: string }) {
  const text = `${questionTitle(question)}、解けますか？\n作業療法士国家試験の過去問10年分を無料で解けます。`;
  const href =
    "https://x.com/intent/tweet?text=" +
    encodeURIComponent(text) +
    "&url=" +
    encodeURIComponent(questionLink(question)) +
    "&hashtags=" +
    encodeURIComponent(SITE.hashtags.join(","));
  return (
    <a className="share-x" href={href} target="_blank" rel="noopener">
      {label}
    </a>
  );
}
