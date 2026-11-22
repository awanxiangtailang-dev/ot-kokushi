import type { Part } from "../types/quiz";

/**
 * サイト・アフィリエイトの設定
 * - アプリは体験談サイト(ot-site)の app/ フォルダに置く想定(npm run build:site)
 * - リンク先を変えるときは、このファイルだけ直せばOK
 */
export const SITE = {
  appName: "OT国試 過去問10年",
  /** 体験談サイトのトップ(アプリから見た位置) */
  blogUrl: "../index.html",
  /** 参考書レビュー記事(アフィリエイトのメイン) */
  textbooksUrl: "../articles/textbooks.html",
  /** 勉強スケジュール記事 */
  scheduleUrl: "../articles/schedule.html",
  /** 公開後のアプリのURL(Xでシェアするとき使う)。site.config.json の siteUrl から自動で決まる。空なら今開いているURL */
  publicAppUrl: import.meta.env.VITE_SITE_URL ? `${import.meta.env.VITE_SITE_URL.replace(/\/$/, "")}/app/` : "",
  hashtags: ["作業療法士", "OT国試", "国試対策"],
};

/** 商品リンク(Amazon・楽天・ASPで作ったリンクを貼る) */
export interface AffiliateItem {
  name: string;
  /** ひとこと(実際に使った感想) */
  comment: string;
  url: string;
  shop: "Amazon" | "楽天" | "公式サイト";
}

/**
 * 区分ごとのおすすめ
 * - items が空のあいだは、参考書レビュー記事への案内だけを出す
 * - 実際に使った商品だけを入れること(ステマ規制)
 */
export const AFFILIATE: Record<Part, { lead: string; items: AffiliateItem[] }> = {
  実地問題: {
    lead: "実地問題は、症例の読み取り方を身につけると安定します。",
    items: [],
  },
  専門分野: {
    lead: "評価法・治療法は、一覧で整理できる参考書があると覚えやすくなります。",
    items: [],
  },
  専門基礎分野: {
    lead: "解剖・生理・運動学は、図の多い参考書で何度も見返すのが近道です。",
    items: [],
  },
  オリジナル: {
    lead: "臨床で役立つ知識も、国試の勉強とつながっています。",
    items: [],
  },
};
