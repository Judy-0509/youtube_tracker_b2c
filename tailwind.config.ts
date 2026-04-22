import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // "상록의 숲" Design System (Clickyy App.html 팔레트)
        primary: {
          DEFAULT: '#1F3A2E',  // 딥 포레스트
          2: '#2C4B3B',
        },
        surface: {
          DEFAULT: '#F4F0E6',  // 오트 크림
          2: '#FBF8EF',
        },
        card: '#FFFFFF',
        sage: {
          DEFAULT: '#5A7A5E',
          2: '#8CA890',
        },
        terracotta: {
          DEFAULT: '#C97B5A',
          2: '#E8B59A',
        },
        bone: {
          DEFAULT: '#E8E1CC',
          2: '#D7CDB0',
        },
        ink: {
          DEFAULT: '#0F1F17',
          2: '#3C4A41',
          3: '#6B7870',
          4: '#9AA49C',
        },
        line: {
          DEFAULT: '#E3DCC7',
          2: '#D0C6AB',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'Pretendard Variable', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        pulse: {
          '0%, 100%': { boxShadow: '0 0 0 4px rgba(201,123,90,0.15)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201,123,90,0.05)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        pulse: 'pulse 2s infinite',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
