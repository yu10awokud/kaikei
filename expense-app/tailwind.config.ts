import type { Config } from 'tailwindcss';

// ============================================================
// 既存サイト（メニュー特戦隊）と同じ配色・角丸・影にそろえる
// ============================================================
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 日本語（本文の既定）
        sans: ['var(--font-jp)', 'system-ui', 'sans-serif'],
        // 数字・英字（月名や金額に使う）
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
        // 未精算などの注意を示す色
        alert: {
          DEFAULT: '#C2410C',
          soft: '#FFF4ED',
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
