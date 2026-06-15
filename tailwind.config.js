/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1e40af',
          700: '#1e3a8a',
          800: '#1e3a8a',
          900: '#172554',
          950: '#0b1329',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        slate: {
          950: '#070a13', // Deep slate for rich dark backgrounds
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(17, 24, 39, 0.05), 0 2px 10px -1px rgba(17, 24, 39, 0.03)',
        'premium-dark': '0 4px 30px -2px rgba(0, 0, 0, 0.3), 0 2px 15px -1px rgba(0, 0, 0, 0.2)',
        'glow-primary': '0 0 15px rgba(59, 130, 246, 0.15)',
        'glow-success': '0 0 15px rgba(16, 185, 129, 0.15)',
        'glow-warning': '0 0 15px rgba(245, 158, 11, 0.15)',
        'glow-danger': '0 0 15px rgba(239, 68, 68, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
