// Borda de rota (E10; docs/43 §6 item 10 e §7.5; docs/42 §3 ganho rápido 2, §5.3 e §7.1). Listas fechadas,
// conferidas por src/app/borda-rota.test.ts contra uma cópia literal e contra o sistema de arquivos, e
// renderizadas por src/app/borda-rota.render.test.ts. Arquivo novo de borda entra aqui, ou a trava falha.

/**
 * Segmentos com loading.tsx PRÓPRIO. Os da E10 têm o formato da tela (título, abas e tabela/cartões no
 * lugar certo); o (app)/loading.tsx genérico cobre o resto por herança, mas sem esse formato.
 */
export const ROTAS_COM_LOADING = [
  // Shell e portal do aluno (#64): genéricos.
  "src/app/(app)",
  "src/app/portal-aluno",
  // Formato da tela (#81 e anteriores).
  "src/app/(app)/alunos/(lista)",
  "src/app/(app)/leads/(lista)",
  "src/app/(app)/inbox",
  "src/app/(app)/financeiro/(painel)",
  "src/app/(app)/financeiro/continuidade",
  "src/app/(app)/academico/segundas-chamadas/minhas",
  // E10: as rotas que a medição deixou sem loading próprio.
  "src/app/(app)/matriculas/[id]",
  "src/app/(app)/academico",
  "src/app/(app)/diario",
  "src/app/(app)/secretaria",
  "src/app/(app)/configuracao",
  "src/app/login",
  "src/app/pagar/[token]",
  "src/app/certificado/[codigo]",
] as const;

/**
 * Segmentos com error.tsx PRÓPRIO. Os de área (E10) são os que o doc 42 pede (alunos #4, secretaria #6,
 * matriculas/[id] L762, academico T1, diario troca-fonte, financeiro #7 e L2031, lote comercial L2190,
 * configuracao #1); os públicos trocam o global-error ("fale com um administrador", texto de equipe) por
 * uma saída para quem recebeu o link.
 */
export const ROTAS_COM_ERROR = [
  "src/app/(app)",
  "src/app/portal-aluno",
  "src/app/(app)/academico",
  "src/app/(app)/alunos",
  "src/app/(app)/comissoes",
  "src/app/(app)/configuracao",
  "src/app/(app)/diario",
  "src/app/(app)/empresas",
  "src/app/(app)/financeiro",
  "src/app/(app)/inbox",
  "src/app/(app)/leads",
  "src/app/(app)/matriculas/[id]",
  "src/app/(app)/secretaria",
  "src/app/pagar/[token]",
  "src/app/certificado/[codigo]",
] as const;

/**
 * error.tsx sem "Tentar de novo": o portal do aluno manda entrar de novo, porque a causa comum ali é a
 * sessão do aluno (ganho rápido 3 do doc 42) e repetir a mesma requisição não resolve.
 */
export const ERROR_SEM_RESET: Record<string, string> = {
  "src/app/portal-aluno": "a saída é \"Entrar de novo\": a falha comum é a sessão do aluno, que o reset não renova",
};

/**
 * Telas pesadas em que a seção lenta fica num <Suspense> em volta de um Server Component assíncrono
 * (docs/42 §7.1: "≥ 1 nas 3 páginas com consulta pesada"). /financeiro já não precisa: desde a E8 cada aba é
 * uma rota com as próprias consultas, e o (painel)/loading.tsx cobre a espera dentro do layout.
 */
export const SUSPENSE_OBRIGATORIO = [
  // docs/42 /academico/reposicoes #2: Conteudo faz a consulta principal e uma por gravação autorizada.
  { pagina: "src/app/(app)/academico/reposicoes/page.tsx", componente: "Conteudo" },
  // docs/42 /matriculas/[id] #3: "/preparacao faz 2 consultas encadeadas" — a segunda, a prontidão da Secretaria.
  { pagina: "src/app/(app)/matriculas/[id]/preparacao/page.tsx", componente: "PendenciasPreparacao" },
] as const;
