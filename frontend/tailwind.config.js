/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: { 950: "#0c0b0a", 900: "#151311", 800: "#1e1b18", 700: "#2a2622", 600: "#3a352f", 400: "#8a8176", 200: "#d9d0c3" },
        brass: { 300: "#e9c98a", 400: "#d8ae5f", 500: "#c0913d", 600: "#9a7128" },
      },
    },
  },
  plugins: [],
};
