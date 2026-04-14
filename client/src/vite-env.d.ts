/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When the static UI and the Fastify API use different origins, set this at build time (no trailing slash). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
