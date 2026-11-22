// フォルダをそのまま配信する簡易サーバー(公開前の確認用)
// 使い方: node scripts/serve-static.mjs ot-site 4173  → http://localhost:4173
import http from "node:http";
import { readFile } from "node:fs";
import { join, resolve, extname } from "node:path";

const root = resolve(process.argv[2] ?? "ot-site");
const port = Number(process.argv[3] ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = join(root, p);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("not found");
      }
      res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`${root} を http://localhost:${port} で配信中`));
