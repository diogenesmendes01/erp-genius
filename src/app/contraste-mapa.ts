// Listas fechadas da trava de contraste (src/app/contraste.test.ts; docs/43-medicao-auditoria-ux.md §6
// item 5). O teste compara cada lista com uma cópia literal e com o que ela representa no
// tailwind.config.ts, no globals.css ou no código: mudar o mapa sem mudar a cópia (ou o contrário) falha.

/**
 * Shades do tailwind.config.ts que apontam para var(--brand). --brand clareia no tema escuro (#6b6ef5) e,
 * com texto branco, dá 4,06:1 — abaixo dos 4,5:1 da WCAG 1.4.3. Fundo com texto branco é bg-brand-solid.
 */
export const SHADES_FUNDO_DA_MARCA = ["500", "600"] as const;

/**
 * Superfícies sobre as quais um controle de formulário aparece: o fundo da página (body), o cartão
 * (surface, bg-surface), a superfície sutil (surface-muted, gray-50) e o neutro dos chips
 * (neutral-muted, gray-100). A borda de controle (--border-control, gray-300) passa de 3:1 sobre todas.
 */
export const SUPERFICIES = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"] as const;

/**
 * Superfícies sobre as quais fica um indicador de seleção em bg-brand-solid (aba, passo, chip, botão
 * primário): o fundo da seleção tem de se destacar delas com ≥ 3:1 (WCAG 1.4.11), nos dois temas.
 * Fica de fora --neutral-muted (gray-100): ele é o vizinho da seleção (passo seguinte, chip
 * desmarcado, hover da aba inativa), não o fundo sob ela — e no escuro nenhuma cor cumpre as duas
 * contas sobre ele (3:1 exige luminância ≥ 0,1846; 4,5:1 com branco, ≤ 0,1833). A trava confere essa
 * impossibilidade pelos tokens: se --neutral-muted mudar e ela sumir, ele volta para a lista.
 */
export const SUPERFICIES_DA_SELECAO = ["--bg-page", "--surface", "--surface-muted"] as const;

/** Fundos sólidos (não invertem no escuro) que levam texto branco: ≥ 4,5:1 nos dois temas. */
export const FUNDOS_SOLIDOS = ["--ai-solid", "--brand-solid", "--danger-solid", "--success-solid"] as const;

/**
 * Usos aceitos de bg-brand-500|600, todos sem texto: arquivo + classe exata (a alternativa lida pela
 * trava) + motivo. Um uso novo tem de entrar aqui com motivo, ou usar bg-brand-solid.
 */
export const FUNDOS_DA_MARCA_SEM_TEXTO: readonly { arquivo: string; trecho: string; motivo: string }[] = [
  {
    arquivo: "src/app/(app)/home/HomeVendedor.tsx",
    trecho: "h-full bg-brand-600",
    motivo: "barra de progresso da meta do mês: preenchimento sem texto, não é fundo de leitura",
  },
];

/** Exceções às ofensas da trava: arquivo + trecho exato + motivo. Cada uma casa com exatamente uma ofensa. */
export const EXCECOES_CONTRASTE: readonly { arquivo: string; trecho: string; motivo: string }[] = [];
