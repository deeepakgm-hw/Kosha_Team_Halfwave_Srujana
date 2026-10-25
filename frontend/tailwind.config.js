/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paypal: {
          navy: "#001C64",       // Deep PayPal Navy
          blue: "#003087",       // Classic PayPal Dark Blue
          bright: "#0070E0",     // Iconic Vivid PayPal Blue
          accent: "#00457C",     // Mid Navy Accent
          yellow: "#FFC439",     // Iconic PayPal Gold / Yellow Button
          yellowHover: "#F6B623",
          bg: "#F5F7FA",         // PayPal Clean Canvas Gray
          card: "#FFFFFF",       // Clean White Card
          border: "#E1E7EC",     // Subtle Card Border
          dark: "#0C0C0D",       // Header / Body Text
          subtext: "#545D68",    // Supporting text
          emerald: "#007B40",    // Success
          rose: "#D9383A",       // Alert / Error
        },
        kosha: {
          blue: "#0070E0",       // PayPal Vivid Blue
          light: "#EBF3FC",      // PayPal Light Blue Tint
          sky: "#D0E4FA",        // Light accent
          deep: "#003087",       // Classic PayPal Deep Blue
          navy: "#001C64",       // Deep PayPal Navy
          gold: "#FFC439",       // PayPal Gold
          amber: "#D97706",
          danger: "#D9383A",
          card: "#FFFFFF",
        },
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#007B40",
          600: "#006837",
          700: "#00532c",
          800: "#003e21",
          900: "#002b17",
        },
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "2xs": "0 1px 1px 0 rgba(0, 0, 0, 0.03)",
        paypal: "0 2px 12px 0 rgba(0, 0, 0, 0.04), 0 0 0 1px #E1E7EC",
        "paypal-lg": "0 8px 24px -4px rgba(0, 28, 100, 0.08), 0 0 0 1px #E1E7EC",
        "paypal-hover": "0 12px 32px -4px rgba(0, 112, 224, 0.12), 0 0 0 1px #0070E0",
        glass: "0 2px 12px 0 rgba(0, 0, 0, 0.04), 0 0 0 1px #E1E7EC",
        "glass-lg": "0 8px 24px -4px rgba(0, 28, 100, 0.08), 0 0 0 1px #E1E7EC",
        "glass-sm": "0 1px 4px 0 rgba(0, 0, 0, 0.03), 0 0 0 1px #E1E7EC",
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
