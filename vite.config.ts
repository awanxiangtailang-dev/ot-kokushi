/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" にしておくと、どこに公開しても(GitHub Pages など)そのまま動きます
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    // バックアップや体験談サイトのフォルダはテストしない
    exclude: ["node_modules/**", "dist/**", "backup-*/**", "ot-site/**"],
  },
});
