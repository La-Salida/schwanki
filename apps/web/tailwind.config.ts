import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EF",      // goose white / paper cream — surfaces
        ink: "#1C1A17",        // off-black leather — text, dark base
        beak: "#F26722",       // beak orange — CTAs, streaks, due badges
        acid: "#F5D90A",       // acid yellow — sparing highlights only
        mint: "#B8E0D2", lilac: "#D6C6E8", sky: "#A8D0E6", blush: "#F4C6D0", // deck tags only
      },
      fontFamily: { display: ["Archivo", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
