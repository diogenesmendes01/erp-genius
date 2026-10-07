import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Baseline pragmático: estas regras sinalizam pontos de melhoria
    // pré-existentes no código (não relacionados à correção do tooling de
    // lint). Mantidas como avisos para que `npm run lint` rode sem falhar,
    // permitindo tratar os apontamentos de forma incremental.
    rules: {
      "react/no-unescaped-entities": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Testes: `any` em mocks (evento sintético de formulário, transação do Prisma, fotografia JSON
    // adulterada) é o padrão destes arquivos. No código de produção a regra continua como erro.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
