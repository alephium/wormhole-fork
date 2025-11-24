/// <reference types="vite/client" />

interface ImportMetaEnv {
  // env
  REACT_APP_WIDGET_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
