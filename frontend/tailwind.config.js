/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kosha: {
          blue: "#1D6FD6",
          light: "#5EB0FF",
          sky: "#BAE0FD",
          deep: "#14509E",
          navy: "#12304F",
          gold: "#FBBF24",
          amber: "#D97706",
          danger: "#E11D48",
          card: "rgba(255, 255, 255, 0.78)",
        },
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      boxShadow: {
        glass: "0 20px 40px -15px rgba(29, 111, 214, 0.08), 0 0 1px 1px rgba(255, 255, 255, 0.9)",
        "glass-lg": "0 25px 60px -15px rgba(18, 48, 79, 0.1), 0 0 2px 1px rgba(255, 255, 255, 0.9)",
        "glass-sm": "0 8px 24px -6px rgba(29, 111, 214, 0.06), 0 0 1px rgba(255, 255, 255, 0.8)",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
    },
  },
  plugins: [],
}
