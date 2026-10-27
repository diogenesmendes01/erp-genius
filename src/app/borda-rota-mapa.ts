export const ROTAS_COM_LOADING = [
  "src/app/(app)",
  "src/app/portal-aluno",
  "src/app/(app)/alunos/(lista)",
  "src/app/(app)/funil",
  "src/app/(app)/tarefas",
  "src/app/(app)/carteira",
  "src/app/(app)/contatos",
  "src/app/(app)/aria",
  "src/app/(app)/comissoes",
  "src/app/(app)/relatorios",
  "src/app/(app)/inbox",
  "src/app/(app)/financeiro/(painel)",
  "src/app/(app)/financeiro/continuidade",
  "src/app/(app)/academico/segundas-chamadas/minhas",
  "src/app/(app)/matriculas/[id]",
  "src/app/(app)/academico",
  "src/app/(app)/diario",
  "src/app/(app)/secretaria",
  "src/app/(app)/configuracao",
  "src/app/login",
  "src/app/pagar/[token]",
  "src/app/certificado/[codigo]",
  "src/app/(app)/matriculas/nova",
  "src/app/(app)/configuracao/whatsapp",
] as const;

export const ROTAS_COM_ERROR = [
  "src/app/(app)",
  "src/app/portal-aluno",
  "src/app/(app)/academico",
  "src/app/(app)/alunos",
  "src/app/(app)/carteira",
  "src/app/(app)/aria",
  "src/app/(app)/comissoes",
  "src/app/(app)/configuracao",
  "src/app/(app)/contatos",
  "src/app/(app)/diario",
  "src/app/(app)/empresas",
  "src/app/(app)/financeiro",
  "src/app/(app)/funil",
  "src/app/(app)/inbox",
  "src/app/(app)/matriculas/[id]",
  "src/app/(app)/oportunidades",
  "src/app/(app)/relatorios",
  "src/app/(app)/secretaria",
  "src/app/(app)/tarefas",
  "src/app/pagar/[token]",
  "src/app/certificado/[codigo]",
] as const;

export const ERROR_SEM_RESET: Record<string, string> = {
  "src/app/portal-aluno": "a saída é \"Entrar de novo\": a falha comum é a sessão do aluno, que o reset não renova",
};

export const SUSPENSE_OBRIGATORIO = [
  { pagina: "src/app/(app)/academico/reposicoes/page.tsx", componente: "Conteudo" },
  { pagina: "src/app/(app)/matriculas/[id]/preparacao/page.tsx", componente: "PendenciasPreparacao" },
] as const;
