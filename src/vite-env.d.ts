/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公開先のサイトの URL(例: https://example.com)。npm run release で設定される */
  readonly VITE_SITE_URL?: string;
  /** まだ公開しない記事(カンマ区切り。例: articles/schedule.html)。npm run release で site.config.json の drafts から設定される */
  readonly VITE_DRAFTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
