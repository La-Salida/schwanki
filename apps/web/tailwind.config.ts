import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",      // index-card stock — surfaces
        ink: "#14213D",        // navy ink — text, dark base
        ruled: "#2346B8",      // the card's ruled-line blue — primary actions, links. One per view
        lines: "#DCE5F5",      // faint ruled lines behind content
        margin: "#C8372D",     // the card's red margin rule — one line per page, plus errors
        acid: "#F5D90A",       // highlighter — the vocabulary word only
        mint: "#B8E0D2", lilac: "#D6C6E8", sky: "#A8D0E6", blush: "#F4C6D0", // deck tags only
      },
      fontFamily: { display: ["Archivo", "system-ui", "sans-serif"] },
      borderRadius: { lg: "0.375rem", xl: "0.5rem", "2xl": "0.75rem", "3xl": "1rem" },
    },
  },
  plugins: [],
} satisfies Config;
