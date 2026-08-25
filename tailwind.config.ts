import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
    // ★ lib/markdown.ts の中でマニュアル本文の class 名を組み立てているため、
    //    ここを含めないと余白や文字サイズの指定が CSS に出力されない
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // 日本語（本文の既定）
        sans: ['var(--font-jp)', 'system-ui', 'sans-serif'],
        // 数字・英字（見出しの月名や回数などに使う）
        en: ['var(--font-en)', 'var(--font-jp)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 主役の色：プールの水をイメージしたブルー
        aqua: {
          50: '#F0F7FC',
          100: '#DDEDF8',
          200: '#BADCF1',
          300: '#8AC4E6',
          400: '#4FA6D8',
          500: '#2489C7',
          600: '#166FA6',
          700: '#125983',
          800: '#0F4869',
          900: '#0D3B56',
        },
        // 文字と罫線（黒すぎない墨色 / 目立ちすぎない線）
        ink: {
          DEFAULT: '#14202B',
          soft: '#4A5866',
          faint: '#8A97A3',
        },
        line: {
          DEFAULT: '#E4E9ED',
          soft: '#EFF2F5',
        },
        // 旧デザインの名残（マニュアル本文で使用中）
        cream: {
          DEFAULT: '#F0F7FC',
          dark: '#DDEDF8',
        },
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 32, 43, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
