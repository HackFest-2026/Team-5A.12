import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f8f5ee",
        ink: "#25231f",
        muted: "#756f66",
        line: "#e5dfd5",
        brand: { DEFAULT: "#4263c7", soft: "#e8edff", dark: "#2d438f" },
        amber: { DEFAULT: "#bf7a17", soft: "#fbf0da" },
        coral: { DEFAULT: "#c95045", soft: "#fbe8e5" },
        background: "#ffffff",
        foreground: "#25231f",
        card: { DEFAULT: "#ffffff", foreground: "#25231f" },
        popover: { DEFAULT: "#ffffff", foreground: "#25231f" },
        primary: { DEFAULT: "#25231f", foreground: "#ffffff" },
        secondary: { DEFAULT: "#f3f0ea", foreground: "#25231f" },
        "muted-foreground": "#756f66",
        accent: { DEFAULT: "#eef1ff", foreground: "#2d438f" },
        destructive: "#c95045",
        border: "#e5dfd5",
        input: "#e5dfd5",
        ring: "#4263c7",
        sidebar: {
          DEFAULT: "#ffffff",
          foreground: "#25231f",
          primary: "#4263c7",
          "primary-foreground": "#ffffff",
          accent: "#eef1ff",
          "accent-foreground": "#2d438f",
          border: "#e5dfd5",
          ring: "#4263c7",
        },
      },
      fontFamily: {
        display: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          '"Book Antiqua"',
          "Georgia",
          "serif",
        ],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(37,35,31,.035)",
        lift: "0 20px 60px rgba(37,35,31,.13)",
      },
      borderRadius: { panel: "12px" },
    },
  },
  plugins: [],
} satisfies Config;
