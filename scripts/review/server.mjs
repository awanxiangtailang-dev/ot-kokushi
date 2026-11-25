// 監修用のページ(手元だけで使う。公開はしない)
// 使い方: npm run review → ブラウザで http://127.0.0.1:4174 を開く
//
// - 「OK」を押すと public/data/explanations/<回>.json の reviewed が true になる
// - 「直したい」のメモは review/notes.json に保存される(Claude がそれを見て直す)
// - 自分のパソコンの中(127.0.0.1)だけで動く。外からはつながらない
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const PORT = Number(process.env.PORT || 4174);
const ROOT = process.cwd();
const NOTES = join(ROOT, "review", "notes.json");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

const exFile = (exam) => join(ROOT, "public", "data", "explanations", `${exam}.json`);
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 100_000) reject(new Error("too large"));
    });
    req.on("end", () => resolve(s));
  });
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    // 監修の結果を保存する
    if (req.method === "POST" && url.pathname === "/api/review") {
      const { id, status, note } = JSON.parse(await readBody(req));
      const m = /^(\d{2})[AB]\d{3}$/.exec(String(id));
      if (!m || !["ok", "fix", "reset"].includes(status)) return send(res, 400, { error: "bad request" });
      const exam = m[1];
      if (!existsSync(exFile(exam))) return send(res, 404, { error: "解説がありません" });
      const raw = readFileSync(exFile(exam), "utf8");
      const ex = JSON.parse(raw);
      if (!ex[id]) return send(res, 404, { error: "解説がありません" });
      ex[id].reviewed = status === "ok";
      // 元のファイルと同じ書き方(回によって1行のものと、改行ありのものがある)で保存する。差分が「reviewed」だけになるように
      const indent = /^\{\r?\n/.test(raw) ? 2 : 0;
      writeFileSync(exFile(exam), JSON.stringify(sortKeys(ex), null, indent) + (raw.endsWith("\n") ? "\n" : ""));

      const notes = readJson(NOTES, {});
      if (status === "fix") notes[id] = { note: String(note ?? "").slice(0, 2000), at: new Date().toISOString() };
      else delete notes[id];
      mkdirSync(join(ROOT, "review"), { recursive: true });
      writeFileSync(NOTES, JSON.stringify(sortKeys(notes), null, 2) + "\n");
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/notes") return send(res, 200, readJson(NOTES, {}));

    // ファイルを返す: /data/... /img/... は public/ から、それ以外は scripts/review/ から
    if (req.method !== "GET") return send(res, 405, { error: "method" });
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const base = /^\/(data|img)\//.test(path) ? join(ROOT, "public") : join(ROOT, "scripts", "review");
    const file = normalize(join(base, path));
    if (!file.startsWith(base) || !existsSync(file)) return send(res, 404, "not found", "text/plain; charset=utf-8");
    send(res, 200, readFileSync(file), TYPES[extname(file)] ?? "application/octet-stream");
  } catch (e) {
    send(res, 500, { error: String(e.message ?? e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`監修用ページ: http://127.0.0.1:${PORT}  (止めるときは Ctrl + C)`);
});
