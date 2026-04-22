/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'liceo-primary': '#0D47A1',
        'liceo-secondary': '#4FC3F7',
        'liceo-accent': '#FFC107',
        'liceo-success': '#4CAF50',
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light"],
  },
}
