import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f5ef",
        ink: "#18201c",
        muted: "#6d756f",
        line: "#dfe3dc",
        brand: { DEFAULT: "#176b50", soft: "#e5f1eb", dark: "#0d4936" },
        amber: { DEFAULT: "#bf7a17", soft: "#fbf0da" },
        coral: { DEFAULT: "#c95045", soft: "#fbe8e5" },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(24,32,28,.04), 0 12px 32px rgba(24,32,28,.05)",
        lift: "0 18px 48px rgba(24,32,28,.12)",
      },
      borderRadius: { panel: "16px" },
    },
  },
  plugins: [],
} satisfies Config;
