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
          950: '#05070a',
          900: '#0a0d14',
          850: '#0f1420',
          800: '#141b2d',
          700: '#1e2942',
          600: '#2d3c5f',
          500: '#475b87',
        },
        cyber: {
          cyan: '#00ffcc',
          blue: '#00b4d8',
          amber: '#ffb700',
          red: '#ff2a5f',
          green: '#00ff66',
          purple: '#b5179e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Share Tech Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 255, 204, 0.35)',
        'red-glow': '0 0 15px rgba(255, 42, 95, 0.45)',
        'amber-glow': '0 0 15px rgba(255, 183, 0, 0.35)',
        'green-glow': '0 0 15px rgba(0, 255, 102, 0.35)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'sweep 4s linear infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
