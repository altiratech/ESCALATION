import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0b0e11',
        panel: '#11161b',
        panelRaised: '#191f26',
        borderTone: '#29333d',
        accent: '#ffb100',
        warning: '#ff9d2f',
        positive: '#7ed321',
        textMain: '#f2f4f6',
        textMuted: '#a9b2bc'
      },
      fontFamily: {
        display: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', '"Segoe UI"', 'sans-serif'],
        body: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        hard: 'inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 18px 42px rgba(0, 0, 0, 0.34)'
      },
      backgroundImage: {
        texture: 'radial-gradient(circle at 10% -10%, rgba(255, 177, 0, 0.07) 0%, transparent 45%), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 12px), linear-gradient(180deg, rgba(11, 14, 17, 1) 0%, rgba(5, 6, 7, 1) 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
