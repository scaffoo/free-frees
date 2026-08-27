import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        table: "#0f5c43",
        felt: "#0b3f31",
        ink: "#162018",
        cream: "#f4efe4"
      }
    }
  },
  plugins: []
} satisfies Config;
