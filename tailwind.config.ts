import type { Config } from "tailwindcss";

// Estilo flat/minimalista com tokens via CSS variables (ver docs/18-design-system.md).
// As shades abaixo apontam para variáveis que invertem no .dark — o tema troca sozinho.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // branco real (mantido p/ texto sobre botões coloridos)
        white: "#ffffff",
        // superfícies
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        // neutros (texto/borda) — shades mapeadas para os tokens
        gray: {
          50: "var(--surface-muted)",
          100: "var(--neutral-muted)",
          200: "var(--border)",
          300: "var(--border)",
          400: "var(--text-terciary)",
          500: "var(--text-secondary)",
          600: "var(--text-secondary)",
          700: "var(--text-primary)",
          800: "var(--text-primary)",
          900: "var(--text-primary)",
        },
        // marca
        brand: {
          50: "var(--brand-bg)",
          100: "var(--brand-bg)",
          200: "var(--brand-border)",
          300: "var(--brand-border)",
          500: "var(--brand)",
          600: "var(--brand)",
          700: "var(--brand-text)",
          800: "var(--brand-text)",
        },
        // semânticas (bg = tom claro/escuro; texto inverte)
        green: { 50: "var(--success-bg)", 100: "var(--success-bg)", 600: "var(--success-text)", 700: "var(--success-text)" },
        red: { 50: "var(--danger-bg)", 100: "var(--danger-bg)", 200: "var(--danger-bg)", 500: "var(--danger-text)", 600: "var(--danger-text)", 700: "var(--danger-text)" },
        amber: { 50: "var(--warning-bg)", 100: "var(--warning-bg)", 200: "var(--warning-bg)", 600: "var(--warning-text)", 700: "var(--warning-text)", 800: "var(--warning-text)" },
        blue: { 50: "var(--info-bg)", 100: "var(--info-bg)", 600: "var(--info-text)", 700: "var(--info-text)" },
        indigo: { 100: "var(--info-bg)", 700: "var(--info-text)" },
        orange: { 100: "var(--warning-bg)", 700: "var(--warning-text)" },
        // ações sólidas
        danger: "var(--danger-solid)",
        success: "var(--success-solid)",
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
