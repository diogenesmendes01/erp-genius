export const CAPACIDADES_LISTA = [
  "dados.exportar_alunos", "dados.exportar_leads", "pagamento.caixa", "comissao.configurar",
  "financeiro.aprovar_acertos",
  "financeiro.executar_devolucoes",
] as const;

export const CAPACIDADES_LABEL: Record<(typeof CAPACIDADES_LISTA)[number], string> = {
  "financeiro.aprovar_acertos": "Aprovar acertos e compensações financeiras",
  "financeiro.executar_devolucoes": "Executar devoluções financeiras aprovadas",
  "dados.exportar_alunos": "Exportar alunos (campos já autorizados)",
  "dados.exportar_leads": "Exportar leads (carteira autorizada)",
  "pagamento.caixa": "Registrar recebimento no caixa",
  "comissao.configurar": "Configurar política de comissão",
};
