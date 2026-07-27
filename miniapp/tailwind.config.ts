import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #ffffff)',
          text: 'var(--tg-theme-text-color, #000000)',
          hint: 'var(--tg-theme-hint-color, #999999)',
          link: 'var(--tg-theme-link-color, #2481cc)',
          button: 'var(--tg-theme-button-color, #2481cc)',
          'button-text': 'var(--tg-theme-button-text-color, #ffffff)',
          'secondary-bg': 'var(--tg-theme-secondary-bg-color, #efeff4)',
          'header-bg': 'var(--tg-theme-header-bg-color, #2481cc)',
          'section-bg': 'var(--tg-theme-section-bg-color, #ffffff)',
          'section-separator': 'var(--tg-theme-section-separator-color, #efeff4)',
          'subtitle-text': 'var(--tg-theme-subtitle-text-color, #999999)',
          'destructive': 'var(--tg-theme-destructive-text-color, #e53935)',
        },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
