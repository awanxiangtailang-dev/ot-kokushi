import { assetUrl } from "../data/load";
import { questionTitle } from "../logic/quiz";
import type { Question } from "../types/quiz";

/** 問題文・図・別冊の表示(選択肢は含まない) */
export function QuestionView({ question: q }: { question: Question }) {
  // OCR の回は文字に誤りがありうるので、元の問題画像をメインに見せる
  const imageFirst = !!q.image && (q.ocr || q.choicesFromImage);
  return (
    <>
      <p className="q-meta">
        <span className="category-tag">{q.part}</span>
        <span>{questionTitle(q)}</span>
        {q.pick === 2 && <span className="pick-two">2つ選ぶ</span>}
      </p>

      {q.caseText && <p className="case-text">{q.caseText}</p>}

      {imageFirst ? (
        <>
          {/* 画像に問題文と選択肢が入っているので、文字版は折りたたんでおく */}
          <QuestionImage src={q.image!} alt={`${questionTitle(q)}の問題`} />
          <details className="ocr-text">
            <summary>{q.ocr ? "文字で読む(自動読み取りのため誤字があります)" : "問題文を文字で読む"}</summary>
            <p>{q.stem}</p>
          </details>
        </>
      ) : (
        <>
          <h2 className="question">{q.stem}</h2>
          {q.image && <QuestionImage src={q.image} alt={`${questionTitle(q)}の図`} />}
        </>
      )}

      {q.bessatsu && q.bessatsu.length > 0 && (
        <div className="bessatsu">
          <p className="sub">別冊</p>
          {q.bessatsu.map((src) => (
            <QuestionImage key={src} src={src} alt="別冊の図" />
          ))}
        </div>
      )}
      {q.note && <p className="sub">※ {q.note}</p>}
    </>
  );
}

function QuestionImage({ src, alt }: { src: string; alt: string }) {
  const url = assetUrl(src);
  return (
    <a className="q-image" href={url} target="_blank" rel="noopener" title="タップで拡大">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  );
}
