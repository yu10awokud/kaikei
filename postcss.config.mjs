// Tailwind CSS v4 は PostCSS プラグインとして読み込みます。
// v3 までと違い tailwind.config.js は不要で、CSS 側 (app/globals.css) で設定します。
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
