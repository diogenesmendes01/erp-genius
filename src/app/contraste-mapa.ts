// Listas fechadas da trava de contraste (src/app/contraste.test.ts; docs/43-medicao-auditoria-ux.md §6
// item 5). O teste compara cada lista com uma cópia literal e com o que ela representa no
// tailwind.config.ts, no globals.css ou no código: mudar o mapa sem mudar a cópia (ou o contrário) falha.

/**
 * Fundos verdes que invertem no escuro, como sufixo da classe `bg-`: as shades do tailwind.config.ts que apontam
 * para var(--brand) (clareia no escuro: com texto branco dá 4,06:1) e os dois sólidos, `brand-solid` e `success`
 * (var(--brand-solid)/var(--success-solid), que viram #21c063 no escuro). Nenhum leva text-white: o texto sobre
 * os sólidos é text-on-brand (var(--on-brand-solid): branco no claro, #0a0a0a no escuro). Só as shades 500|600
 * sem texto ficam na lista fechada abaixo; brand-solid e success sem texto (barra, ponto) são livres.
 * bg-danger e bg-ai-solid não invertem e seguem com text-white.
 */
export const SHADES_FUNDO_DA_MARCA = ["brand-500", "brand-600", "brand-solid", "success"] as const;

/**
 * Superfícies sobre as quais um controle de formulário aparece: o fundo da página (body), o cartão
 * (surface, bg-surface), a superfície sutil (surface-muted, gray-50) e o neutro dos chips
 * (neutral-muted, gray-100). A borda de controle (--border-control, gray-300) passa de 3:1 sobre todas.
 */
export const SUPERFICIES = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"] as const;

/**
 * Superfícies sobre as quais fica um indicador de seleção em bg-brand-solid (aba, passo, chip, botão
 * primário): o fundo da seleção tem de se destacar delas com ≥ 3:1 (WCAG 1.4.11), nos dois temas.
 * Com os tokens do design system o --neutral-muted (gray-100: chip, hover) também entra: #ededed e
 * #2a2c2c aceitam a seleção (3,86 e 5,88:1). Antes ele ficava de fora porque, no escuro de então
 * (#2f2f2c), nenhuma cor cumpria as duas contas; o autoteste de selecaoImpossivelSobre segue com hex fixo.
 */
export const SUPERFICIES_DA_SELECAO = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"] as const;

/** Fundos sólidos (valor próprio por tema): o texto do par de TEXTO_SOBRE_SOLIDO tem ≥ 4,5:1 sobre eles nos dois temas. */
export const FUNDOS_SOLIDOS = ["--ai-solid", "--brand-solid", "--danger-solid", "--success-solid"] as const;

/**
 * Texto de cada fundo sólido. O verde (brand/success) tem texto próprio por tema, --on-brand-solid
 * (#fff no claro, #0a0a0a no escuro, onde o verde clareia); danger e ai levam branco nos dois temas.
 */
export const TEXTO_SOBRE_SOLIDO = {
  "--brand-solid": "--on-brand-solid",
  "--success-solid": "--on-brand-solid",
  "--danger-solid": "white",
  "--ai-solid": "white",
  // Iniciais brancas sobre a cor do avatar (análise parte 1 §5).
  "--avatar-1": "white",
  "--avatar-2": "white",
  "--avatar-3": "white",
  "--avatar-4": "white",
  "--avatar-5": "white",
  "--avatar-6": "white",
  "--avatar-7": "white",
  "--avatar-8": "white",
} as const;

/**
 * Usos aceitos de bg-brand-500|600, todos sem texto: arquivo + classe exata (a alternativa lida pela
 * trava) + motivo. Um uso novo tem de entrar aqui com motivo, ou usar bg-brand-solid.
 */
export const FUNDOS_DA_MARCA_SEM_TEXTO: readonly { arquivo: string; trecho: string; motivo: string }[] = [];

/** Exceções às ofensas da trava: arquivo + trecho exato + motivo. Cada uma casa com exatamente uma ofensa. */
export const EXCECOES_CONTRASTE: readonly { arquivo: string; trecho: string; motivo: string }[] = [];
