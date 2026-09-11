/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        command: {
          bg: "#070b14",
          panel: "#0f172a",
          border: "#1e293b",
          cyan: "#00f0ff",
          amber: "#ffb703",
          crimson: "#ff003b",
          safe: "#00f0ff",
          warning: "#ffb703",
          danger: "#ff003b",
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
