/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公開先のサイトの URL(例: https://example.com)。npm run release で設定される */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
