import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EF",      // goose white / paper cream — surfaces
        ink: "#1A1712",        // off-black leather — text, dark base
        beak: "#B83D1C",       // darker orange keeps cream button labels readable
        acid: "#F5D90A",       // acid yellow — sparing highlights only
        mint: "#B8E0D2", lilac: "#D6C6E8", sky: "#A8D0E6", blush: "#F4C6D0", // deck tags only
      },
      fontFamily: { display: ["Archivo", "system-ui", "sans-serif"] },
      borderRadius: { lg: "0.375rem", xl: "0.5rem", "2xl": "0.75rem", "3xl": "1rem" },
    },
  },
  plugins: [],
} satisfies Config;
