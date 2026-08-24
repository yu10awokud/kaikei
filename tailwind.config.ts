import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 現行 Notion ページの雰囲気に合わせた薄いクリーム色
        cream: {
          DEFAULT: '#FDF6E3',
          dark: '#F5EAD0',
        },
        ink: '#1F1F1F',
        line: '#E5E1D8',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};

export default config;
