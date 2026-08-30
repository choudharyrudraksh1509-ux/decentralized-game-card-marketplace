/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian:  "#0d0d0d",
        charcoal:  "#1a1a1a",
        graphite:  "#252525",
        ash:       "#333333",
        ivory:     "#f5f0e8",
        parchment: "#d4c9b0",
        muted:     "#8a8070",
        gold: {
          DEFAULT: "#d4a017",
          light:   "#e8b84b",
          dark:    "#a07810",
        },
        crimson: {
          DEFAULT: "#c0392b",
          light:   "#e74c3c",
          dark:    "#922b21",
        },
        amber: {
          DEFAULT: "#e67e22",
          light:   "#f39c12",
          dark:    "#ca6f1e",
        },
      },
      fontFamily: {
        display: ["Cinzel", "Georgia", "serif"],
        body:    ["Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card:  "0 4px 24px rgba(0,0,0,0.6)",
        glow:  "0 0 16px rgba(212,160,23,0.4)",
      },
      backgroundImage: {
        "card-gradient":
          "linear-gradient(135deg, #252525 0%, #1a1a1a 60%, #111111 100%)",
        "gold-gradient":
          "linear-gradient(90deg, #a07810 0%, #d4a017 50%, #a07810 100%)",
      },
    },
  },
  plugins: [],
};