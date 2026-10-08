// Lista FECHADA das ações irreversíveis ou de efeito externo cobertas pelo <ConfirmarAcao>
// (docs/42-auditoria-frontend-ux.md, E1 e padrão 8; docs/43-medicao-auditoria-ux.md §6 item 1, fatia A:
// efeito externo ou financeiro). Para cada uma, a trava em src/app/confirmacoes.test.ts exige, pelo AST:
// - no arquivo listado, toda referência à action (inclusive importada com outro nome) está DENTRO da prop
//   `acao` de um <ConfirmarAcao> importado de "@/components/ConfirmarAcao" — fora disso, só com exceção
//   ancorada abaixo; e ao menos uma referência está numa confirmação;
// - nenhum outro arquivo de src/app ou src/components importa a action (nem o módulo inteiro dela);
// - nenhum window.confirm no app (a confirmação é o componente).
// Tirar uma ação daqui ou mudar uma exceção exige mudar também a cópia literal no teste.
//
// Fatia B (ainda sem confirmação, docs/43 §6 item 1): encerrar país, "Faltou" no check-in, vincular
// contato e opt-out na inbox, aprovar replanejamento/quantidade de aulas/presença histórica, desativar
// usuário/preço/idioma e inativar empresa.

export type AcaoConfirmada = {
  /** Tela (caminho a partir da raiz do repositório). */
  arquivo: string;
  /** Módulo de onde a action é importada. */
  modulo: string;
  /** Nome exportado da server action. */
  acao: string;
  /** Linha do achado em docs/42-auditoria-frontend-ux.md. */
  achado: string;
  /** O que a action faz que não volta atrás pela tela. */
  efeito: string;
};

export const ACOES_CONFIRMADAS: AcaoConfirmada[] = [
  {
    arquivo: "src/app/(app)/financeiro/FilaCobranca.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "enfileirarCobrancaWhatsApp",
    achado: "L2014",
    efeito: "envia a cobrança real por WhatsApp ao responsável (\"Cobrar\"/\"Lembrar\" da linha e \"Enviar via WhatsApp (API)\" do detalhe)",
  },
  {
    arquivo: "src/app/(app)/financeiro/FinanceiroPainel.tsx",
    modulo: "@/server/financeiro/acoes",
    acao: "fecharMesComissoes",
    achado: "L2016",
    efeito: "marca como pagas todas as comissões aprovadas (fecha o mês)",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx",
    modulo: "@/server/matricula/desistencia-acerto-aplicacao",
    acao: "aplicarAcertoDesistenciaContratual",
    achado: "L799",
    efeito: "ajusta os valores das cobranças da matrícula e cria crédito do excedente",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx",
    modulo: "@/server/matricula/desistencia-reconferencia-delta",
    acao: "aplicarReconferenciaDeltaDesistencia",
    achado: "L799",
    efeito: "aplica a diferença da reconferência às cobranças e cria crédito novo",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx",
    modulo: "@/server/matricula/fechamento-horas-emissao",
    acao: "emitirFechamentoHoras",
    achado: "L906",
    efeito: "emite uma cobrança real do fechamento de horas",
  },
  {
    arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx",
    modulo: "@/server/empresas/acoes",
    acao: "pagarFaturaB2B",
    achado: "L2281",
    efeito: "baixa em lote todas as cobranças da fatura B2B",
  },
  {
    arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx",
    modulo: "@/server/empresas/acoes",
    acao: "cancelarFaturaB2B",
    achado: "L2281",
    efeito: "cancela a fatura B2B e solta as cobranças dela",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "acionarKillSwitchRegua",
    achado: "L2516",
    efeito: "congela ou destrava toda a automação de cobrança",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "salvarPoliticaRegua",
    achado: "L2517",
    efeito: "ativa a régua de cobrança (estado ATIVA: mensagens reais aos clientes)",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx",
    modulo: "@/server/comercial/acoes",
    acao: "salvarConfigComercial",
    achado: "L2517",
    efeito: "ativa a saudação automática ou os alertas do gestor (mensagens reais)",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx",
    modulo: "@/server/comercial/acoes",
    acao: "salvarReguaComercial",
    achado: "L2517",
    efeito: "ativa a régua comercial ou desliga o modo piloto (go-live geral)",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "salvarTemplateWhatsApp",
    achado: "L2518",
    efeito: "salva template aprovado, que volta a rascunho e tira do ar os degraus que o usam",
  },
];

/**
 * Chamada de uma action da lista FORA do <ConfirmarAcao>: o mesmo salvar serve a um caso sem efeito
 * irreversível. Ancorada no arquivo e no trecho EXATO da chamada (espaços normalizados); cada exceção tem
 * de casar com exatamente uma chamada. O caso irreversível continua obrigado a passar pela confirmação
 * (a trava exige ao menos uma referência dentro dela) — e o teste da tela prova a condição.
 */
export type ExcecaoConfirmacao = { arquivo: string; trecho: string; motivo: string };

export const EXCECOES_CONFIRMACAO: ExcecaoConfirmacao[] = [
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx",
    trecho: "salvarPoliticaRegua(dadosPolitica())",
    motivo: "salvar sem passar a régua de desligada/ensaio para ATIVA não liga envio novo; a ativação (`ativando`) abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx",
    trecho: "salvarConfigComercial(dadosComerciais())",
    motivo: "salvar sem ativar a saudação nem os alertas do gestor não liga envio novo; a ativação abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx",
    trecho: "salvarReguaComercial(dadosRegua())",
    motivo: "salvar sem ativar a régua e sem desligar o modo piloto não amplia o envio; ativação e go-live abrem o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx",
    trecho: "salvarTemplateWhatsApp(dados)",
    motivo: "template novo, em rascunho, em revisão ou rejeitado não derruba degrau nenhum ao salvar; o aprovado abre o ConfirmarAcao",
  },
];

/**
 * Import que sai do `src` (relativo, ou `@/` com `..`): a trava não lê o que ele carrega, então só passa o que
 * está aqui, ancorado no arquivo e no especificador EXATO (R2 da #154, C6). Cópia literal no teste.
 */
export type ImportForaDoSrc = { arquivo: string; especificador: string; motivo: string };

export const IMPORTS_FORA_DO_SRC: ImportForaDoSrc[] = [
  {
    arquivo: "src/test/setup-integracao.ts",
    especificador: "../../vitest.integration.config",
    motivo: "o setup das integrações lê a URL do banco descartável da configuração do vitest; não chama action nem tela",
  },
];
