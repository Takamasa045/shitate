import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(here, "index.html"),
    resolve(here, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // 和紙 (washi) — 背景・面
        washi: {
          50: "#faf7f0",   // 基調（最も薄い和紙）
          100: "#f5f1e6",
          200: "#ede6d3",
          300: "#e0d6bc",
          400: "#c8bb9b",
        },
        // 墨 (sumi) — テキスト・線
        sumi: {
          50: "#eeeae0",
          100: "#c9c0ae",
          200: "#8f8676",
          300: "#5e5649",
          500: "#3a342b",
          700: "#231f19",
          900: "#14110d",
        },
        // 朱 (shu) — 警告・印判・アクセント
        shu: {
          50: "#fbeae7",
          100: "#f2c3bc",
          300: "#d9695a",
          500: "#b83a2e",   // 印判の朱
          700: "#8e2a21",
          900: "#5c1811",
        },
        // 金茶 (kincha) — stable / 吉兆
        kincha: {
          100: "#efe4c8",
          300: "#d7b97a",
          500: "#a88541",
          700: "#6c5225",
        },
        // 藍 (ai) — info / 情報
        ai: {
          100: "#d8dde8",
          300: "#7c8daf",
          500: "#3a527a",
          700: "#1f3454",
        },
        // 若草 (wakakusa) — experimental / 進行中
        wakakusa: {
          100: "#dde4ca",
          300: "#8fa56a",
          500: "#5c7538",
          700: "#3e4f25",
        },
      },
      fontFamily: {
        serif: [
          '"Noto Serif JP"',
          "Georgia",
          '"Hiragino Mincho ProN"',
          "serif",
        ],
        sans: [
          "Inter",
          '"Noto Sans JP"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        "wa-title": "0.08em",
        "wa-heading": "0.12em",
      },
      backgroundImage: {
        "washi-texture":
          "radial-gradient(circle at 12% 18%, rgba(155, 133, 88, 0.06) 0, transparent 40%), radial-gradient(circle at 87% 75%, rgba(92, 70, 42, 0.05) 0, transparent 45%), radial-gradient(circle at 58% 42%, rgba(0,0,0,0.03) 0, transparent 35%)",
      },
      boxShadow: {
        washi:
          "0 1px 2px rgba(36, 28, 18, 0.04), 0 8px 24px -12px rgba(36, 28, 18, 0.08)",
        hanko:
          "0 1px 0 rgba(0,0,0,0.04), inset 0 0 0 1px rgba(184, 58, 46, 0.6)",
      },
    },
  },
  plugins: [],
};
