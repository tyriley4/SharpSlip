import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // New premium dashboard palette (bg/win/loss/grade-*/sport-* are the new canonical names).
        // background/sidebar/positive/negative are kept as aliases so every existing className
        // across the app keeps resolving — only the hex values changed, not the tokens.
        bg: '#08090C',
        background: '#08090C',
        sidebar: '#0E1014',
        card: '#111318',
        card2: '#0E1014',
        card3: '#16191F',
        border: '#1F2229',
        border2: '#2A2D35',
        accent: '#3B9EFF',
        accent2: '#1A7FE8',
        text: '#F0F2F5',
        text2: '#8B909A',
        muted: '#4B5058',
        positive: '#10B981',
        win: '#10B981',
        negative: '#EF4444',
        loss: '#EF4444',
        warning: '#F59E0B',
        hot: '#FF6B35',
        cold: '#3B82F6',
        'grade-a': '#00E5A0',
        'grade-b': '#00B4D8',
        'grade-c': '#FFB800',
        'mlb-color': '#00E5A0',
        'nfl-color': '#EF4444',
        'nba-color': '#FF6B35',
        'nhl-color': '#3B9EFF',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
