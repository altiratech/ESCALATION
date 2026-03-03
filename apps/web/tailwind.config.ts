import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f1419',
        panel: '#151c23',
        panelRaised: '#1b2530',
        borderTone: '#2d3b49',
        accent: '#c9a86a',
        warning: '#cc7f49',
        positive: '#6aa285',
        textMain: '#e6e5df',
        textMuted: '#9ca7b3'
      },
      fontFamily: {
        display: ['"Chakra Petch"', '"Source Serif 4"', 'Georgia', 'serif'],
        body: ['"IBM Plex Sans"', '"Segoe UI"', 'sans-serif']
      },
      boxShadow: {
        hard: '0 0 0 1px rgba(201, 168, 106, 0.18), 0 16px 34px rgba(0, 0, 0, 0.38)'
      },
      backgroundImage: {
        texture: 'radial-gradient(circle at 20% 10%, rgba(201, 168, 106, 0.06) 0%, transparent 35%), radial-gradient(circle at 90% 80%, rgba(58, 75, 94, 0.18) 0%, transparent 45%)'
      }
    }
  },
  plugins: []
} satisfies Config;
