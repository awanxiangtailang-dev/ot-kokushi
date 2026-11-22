// ビルドしたアプリ(dist/)を、体験談サイトの ot-site/app/ にコピーする
// 使い方: npm run build:site  → ot-site フォルダをそのまま公開すれば、サイトとアプリが同じ場所で動く
import { cpSync, rmSync, existsSync } from "node:fs";

const from = "dist";
const to = "ot-site/app";
if (!existsSync(from)) throw new Error("dist/ がありません。先に npm run build を実行してください");
if (existsSync(to)) rmSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`${from}/ を ${to}/ にコピーしました`);
