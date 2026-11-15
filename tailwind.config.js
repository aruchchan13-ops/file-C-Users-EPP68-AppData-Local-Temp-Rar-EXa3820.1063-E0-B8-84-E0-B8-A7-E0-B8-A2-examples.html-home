/** Design tokens come from CSS variables in src/styles/index.css (palette supplied by the team). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chrome: 'rgb(var(--c-chrome) / <alpha-value>)',
        'on-chrome': { DEFAULT: 'rgb(var(--c-on-chrome-bg) / <alpha-value>)', fg: 'rgb(var(--c-on-chrome-fg) / <alpha-value>)' },
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          hover: 'rgb(var(--c-brand-hover) / <alpha-value>)',
          ink: 'rgb(var(--c-brand-ink) / <alpha-value>)',
        },
        page: 'rgb(var(--c-page) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        alt: 'rgb(var(--c-alt) / <alpha-value>)',
        ink: { DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', muted: 'rgb(var(--c-ink-muted) / <alpha-value>)' },
        link: 'rgb(var(--c-link) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        danger: { DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)', bg: 'rgb(var(--c-danger-bg) / <alpha-value>)' },
        caution: { DEFAULT: 'rgb(var(--c-caution) / <alpha-value>)', bg: 'rgb(var(--c-caution-bg) / <alpha-value>)' },
        safe: { DEFAULT: 'rgb(var(--c-safe) / <alpha-value>)', bg: 'rgb(var(--c-safe-bg) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      maxWidth: { content: '72rem' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
    },
  },
  plugins: [],
};
