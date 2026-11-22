import { AFFILIATE, SITE } from "../config/site";
import type { Part } from "../types/quiz";

/** 区分に合わせた参考書の案内(広告であることを明示する) */
export function AffiliateBox({ part }: { part: Part }) {
  const { lead, items } = AFFILIATE[part];
  return (
    <aside className="affiliate" aria-label="広告">
      <p className="pr-tag">PR</p>
      <p className="affiliate-lead">{lead}</p>
      {items.length > 0 && (
        <ul className="affiliate-items">
          {items.map((it) => (
            <li key={it.url}>
              <a href={it.url} target="_blank" rel="sponsored noopener">
                <strong>{it.name}</strong>
                <span className="shop">{it.shop}で見る →</span>
              </a>
              <span className="sub">{it.comment}</span>
            </li>
          ))}
        </ul>
      )}
      <a className="affiliate-link" href={SITE.textbooksUrl}>
        現役OTが国試で使った参考書のレビューを読む →
      </a>
    </aside>
  );
}
