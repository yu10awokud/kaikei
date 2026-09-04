import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2933',
        sub: '#6b7684',
        line: '#e3e8ee',
        bg: '#f6f8fa',
        brand: '#0f6fc5',
        brandDark: '#0b5699',
        danger: '#d64545',
      },
    },
  },
  plugins: [],
};

export default config;
