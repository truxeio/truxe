import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.css",
    "./docs/**/*.{md,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        lg: "2.5rem",
      },
    },
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        primary: "var(--color-primary)", // Electric Blue #3B82F6
        "primary-dark": "var(--color-primary-dark)", // #2563EB
        "primary-light": "var(--color-primary-light)", // Sky #0EA5E9
        success: "var(--color-success)", // #10B981
        warning: "var(--color-warning)", // #F59E0B
        error: "var(--color-error)", // #EF4444
        border: "var(--color-border)",
        ring: "var(--color-ring)",
        // Graphite neutrals
        graphite: {
          900: "#0B0F14",
          800: "#121820",
          700: "#1F2732",
          400: "#94A3B8",
          200: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      maxWidth: {
        "8xl": "96rem",
      },
    },
  },
  plugins: [],
};

export default config;
