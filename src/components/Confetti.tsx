import { useMemo } from "react";

const COLORS = ["#0fb5a0", "#3d8bfd", "#6d5df6", "#ffc845", "#ff6b57", "#4ade80"];

/** 正解したときの紙ふぶき(動きを減らす設定の端末では CSS 側で止まる) */
export function Confetti({ count = 22 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${((i * 37) % 30) / 100}s`,
        color: COLORS[i % COLORS.length],
        rotate: `${(i * 53) % 360}deg`,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: p.left, animationDelay: p.delay, background: p.color, rotate: p.rotate }} />
      ))}
    </div>
  );
}
