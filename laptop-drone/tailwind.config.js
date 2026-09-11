/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          950: '#030712',
          900: '#080d1a',
          850: '#0e1626',
          800: '#141f36',
          750: '#1a2948',
          700: '#22355c',
          600: '#2f497d',
          500: '#4365aa',
          400: '#6889cc',
        },
        cyber: {
          cyan: '#00f0ff',
          blue: '#00a8ff',
          sky: '#38bdf8',
          amber: '#ffb800',
          orange: '#ff7700',
          red: '#ff2e63',
          green: '#00f59b',
          emerald: '#10b981',
          purple: '#a855f7',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Share Tech Mono', 'ui-monospace', 'monospace'],
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 240, 255, 0.4)',
        'cyan-glow-lg': '0 0 25px rgba(0, 240, 255, 0.6)',
        'red-glow': '0 0 15px rgba(255, 46, 99, 0.45)',
        'red-glow-lg': '0 0 25px rgba(255, 46, 99, 0.7)',
        'amber-glow': '0 0 15px rgba(255, 184, 0, 0.4)',
        'green-glow': '0 0 15px rgba(0, 245, 155, 0.4)',
        'purple-glow': '0 0 15px rgba(168, 85, 247, 0.4)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'sweep 4s linear infinite',
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'beacon': 'beacon 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        beacon: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
