import type { Config } from "tailwindcss";

/**
 * VANTAGE design tokens.
 *
 * All colors are defined once as HSL channel CSS variables in
 * `src/app/globals.css` and mapped here. Components must consume the
 * token-based Tailwind names (bg-surface, text-muted, border-border, ...)
 * rather than raw hex values so the whole visual system can be re-themed
 * from a single place.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        subtle: "hsl(var(--subtle) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        // Opportunity-score severity scale.
        "score-exceptional": "hsl(var(--score-exceptional) / <alpha-value>)",
        "score-high": "hsl(var(--score-high) / <alpha-value>)",
        "score-promising": "hsl(var(--score-promising) / <alpha-value>)",
        "score-moderate": "hsl(var(--score-moderate) / <alpha-value>)",
        "score-low": "hsl(var(--score-low) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.25)",
        overlay: "0 16px 40px -12px rgb(0 0 0 / 0.6)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.21, 0.47, 0.32, 0.98) both",
        "fade-in": "fade-in 0.25s ease-out both",
        "scale-in": "scale-in 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
