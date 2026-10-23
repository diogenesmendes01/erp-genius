// Lista FECHADA das ações irreversíveis ou de efeito externo cobertas pelo <ConfirmarAcao>
// (docs/42-auditoria-frontend-ux.md, E1 e padrão 8; docs/43-medicao-auditoria-ux.md §6 item 1 e §7.5 item 1;
// fatia A, #154: efeito externo ou financeiro; fatia B, #169: as demais ações irreversíveis). Para cada uma, a
// trava em src/app/confirmacoes.test.ts exige, pelo AST:
// - no arquivo listado, toda referência à action (inclusive importada com outro nome) está DENTRO da prop
//   `acao` de um <ConfirmarAcao> importado de "@/components/ConfirmarAcao" — fora disso, só com exceção
//   ancorada abaixo; e ao menos uma referência está numa confirmação;
// - nenhum outro arquivo de src/app ou src/components importa a action (nem o módulo inteiro dela);
// - nenhum window.confirm no app (a confirmação é o componente).
// Tirar uma ação daqui ou mudar uma exceção exige mudar também a cópia literal no teste.
//
// Fatia B (#169): encerrar país, "Faltou" no check-in, vincular contato e opt-out na inbox, aprovar
// replanejamento/quantidade de aulas/presença histórica, desativar usuário/preço/idioma, inativar empresa,
// revogar cobertura e aprovar o lote da fila de cobrança. A ativação da régua (L2517) ganhou a estimativa de
// alcance (estimarAlcanceRegua, só leitura) dentro da confirmação que já existia.

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
  // Fatia B (#169).
  {
    arquivo: "src/app/(app)/financeiro/FilaCobranca.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "aprovarLoteCobranca",
    achado: "L2018",
    efeito: "aprova o lote e manda uma mensagem real de cobrança por cobrança selecionada",
  },
  {
    arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx",
    modulo: "@/server/paises/acoes",
    acao: "alterarStatusPais",
    achado: "L2428",
    efeito: "encerra o país: transição terminal, sem volta pela tela (sai das novas matrículas e das ofertas)",
  },
  {
    arquivo: "src/app/(app)/home/HomeProfessor.tsx",
    modulo: "@/server/comercial/acoes",
    acao: "checkinExperimental",
    achado: "L2693",
    efeito: "marca o lead como no-show e dispara a recuperação de no-show, sem correção pela tela",
  },
  {
    arquivo: "src/app/(app)/inbox/AcoesContato.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "vincularContatoWhatsApp",
    achado: "L2298",
    efeito: "amarra o histórico da conversa a um aluno, responsável ou oportunidade; só a administração ou o gerente do setor desfaz, com motivo",
  },
  {
    arquivo: "src/app/(app)/inbox/AcoesContato.tsx",
    modulo: "@/server/whatsapp/desvincular-contato",
    acao: "desvincularContatoWhatsApp",
    achado: "L2298",
    efeito: "solta o contato do aluno, responsável ou oportunidade (D8): as próximas mensagens saem do cadastro; desfazer exige vincular de novo",
  },
  {
    arquivo: "src/app/(app)/inbox/OptOutContato.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "registrarOptOutContato",
    achado: "L2298",
    efeito: "bloqueia toda mensagem ao contato; só a administração desfaz, com evidência",
  },
  {
    arquivo: "src/app/(app)/academico/calendario/[id]/revisoes/[revisaoId]/DecidirReplanejamento.tsx",
    modulo: "@/server/agenda/replanejamento-decisao",
    acao: "decidirEAplicarReplanejamentoConjunto",
    achado: "L1102",
    efeito: "aprova e aplica o conjunto: reescreve as datas dos encontros previstos de todas as turmas",
  },
  {
    arquivo: "src/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas.tsx",
    modulo: "@/server/agenda/modalidade-quantidade",
    acao: "decidirAlteracaoQuantidadeAulasModalidade",
    achado: "L1218",
    efeito: "aprova e aplica a nova quantidade de aulas em todas as turmas impactadas, na mesma operação",
  },
  {
    arquivo: "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx",
    modulo: "@/server/migracao/presenca-historica",
    acao: "decidirPresencaHistoricaMigracao",
    achado: "L2499",
    efeito: "aprova e aplica a presença histórica no diário de aulas",
  },
  {
    arquivo: "src/app/(app)/configuracao/usuarios/UsuariosPainel.tsx",
    modulo: "@/server/acesso/acoes",
    acao: "definirUsuarioAtivo",
    achado: "L2413",
    efeito: "desativa o usuário: a pessoa perde o acesso ao sistema na hora",
  },
  {
    arquivo: "src/app/(app)/configuracao/catalogo/IdiomasPainel.tsx",
    modulo: "@/server/catalogo/acoes",
    acao: "definirIdiomaAtivo",
    achado: "L2340",
    efeito: "desativa o idioma usado pelos produtos do catálogo",
  },
  {
    arquivo: "src/app/(app)/configuracao/catalogo/PrecosPainel.tsx",
    modulo: "@/server/catalogo/acoes",
    acao: "definirPrecoAtivo",
    achado: "L2340",
    efeito: "desativa o preço de referência; a combinação pode ficar sem preço para novas matrículas",
  },
  {
    arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx",
    modulo: "@/server/empresas/acoes",
    acao: "definirSituacaoEmpresa",
    achado: "L2281",
    efeito: "inativa a empresa (contratos e faturas continuam como estão)",
  },
  {
    arquivo: "src/app/(app)/carteira/CoberturasPainel.tsx",
    modulo: "@/server/acesso/coberturas",
    acao: "revogarCobertura",
    achado: "L2244",
    efeito: "tira do substituto o acesso à carteira do titular na hora; voltar exige conceder nova cobertura",
  },
  {
    arquivo: "src/app/(app)/contatos/FichaContato.tsx",
    modulo: "@/server/crm/contatos-acoes",
    acao: "registrarOptOutDaFicha",
    achado: "F2-T24",
    efeito: "o contato deixa de receber mensagens em todos os telefones; não há desfazer pela tela",
  },
  {
    arquivo: "src/app/(app)/contatos/MesclarContatos.tsx",
    modulo: "@/server/crm/contatos-acoes",
    acao: "mesclarContatosDaLista",
    achado: "F2-T24",
    efeito: "a pessoa secundária vira lápide e telefones, oportunidades e histórico passam para a principal; não há desfazer pela tela",
  },
  // Fase 2, Task 35 (F2-I): estorno de comissão pelo FINANCEIRO no painel /comissoes.
  {
    arquivo: "src/app/(app)/comissoes/EstornarComissao.tsx",
    modulo: "@/server/crm/comissoes-estorno-acao",
    acao: "estornarComissaoDoPainel",
    achado: "F2-T35",
    efeito: "estorna a comissão: o valor sai dos totais a pagar e não há reativação pela tela",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "desconectarNumero",
    achado: "Fase 4D",
    efeito: "faz logout do número no motor: o número para de enviar e receber até novo pareamento por QR ou código",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "desativarNumeroWhatsApp",
    achado: "Fase 4D",
    efeito: "desativa o número e faz logout no motor: ele para de enviar e receber até ser ativado e pareado de novo",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx",
    modulo: "@/server/whatsapp/acoes",
    acao: "excluirNumeroWhatsApp",
    achado: "Fase 4D",
    efeito: "desativa o número, faz logout no motor e o tira da tela de Números; só um novo cadastro do mesmo telefone o traz de volta",
  },
  {
    arquivo: "src/app/(app)/inbox/AcoesMensagem.tsx",
    modulo: "@/server/whatsapp/motor/acoes-mensagem",
    acao: "apagarMensagemWhatsApp",
    achado: "Fase 4D",
    efeito: "apaga a mensagem para todos no WhatsApp do contato; não há como desfazer pela tela",
  },
  {
    arquivo: "src/app/(app)/inbox/AcoesMensagem.tsx",
    modulo: "@/server/whatsapp/motor/acoes-mensagem",
    acao: "encaminharMensagemWhatsApp",
    achado: "Fase 4D",
    efeito: "envia a mensagem pelo WhatsApp a outro contato do mesmo número (message.forward); não há como desfazer pela tela",
  },
  // Confirmações que faltavam (#175; triagem B6). A L2019 (motivo na rejeição de desconto) aguarda decisão de produto.
  {
    arquivo: "src/app/(app)/financeiro/permuta/PermutaOperacional.tsx",
    modulo: "@/server/financeiro/permuta-servico",
    acao: "decidirCompensacaoPermuta",
    achado: "L2142",
    efeito: "aprova a compensação e abate o valor do serviço do saldo das mensalidades destinadas; não há desfazer pela tela",
  },
  {
    arquivo: "src/app/(app)/alunos/[id]/portal/painel.tsx",
    modulo: "@/server/portal-aluno/actions",
    acao: "decidirTrocaEmailPortalAluno",
    achado: "L325",
    efeito: "troca o e-mail do portal do aluno, apaga a senha e revoga na hora as sessões e os links de acesso anteriores",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/[realizacaoId]/Formularios.tsx",
    modulo: "@/server/avaliacoes/recuperacao-nota",
    acao: "decidirNotaRecuperacao",
    achado: "L1479",
    efeito: "oficializa a versão da nota de recuperação; depois ela só muda por fluxo de correção aprovado",
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
  // Fatia B (#169): a mesma action serve à ida irreversível (confirmada) e à volta, que tem caminho pela tela.
  {
    arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx",
    trecho: "alterarStatusPais(id, alvo)",
    motivo: "ativar, pausar e reativar têm volta na própria linha; Encerrar (terminal) não chega aqui: escolherTransicao abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/home/HomeProfessor.tsx",
    trecho: "checkinExperimental(id, true)",
    motivo: "Compareceu segue o funil (proposta comercial) sem disparar a recuperação de no-show; o Faltou abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/academico/calendario/[id]/revisoes/[revisaoId]/DecidirReplanejamento.tsx",
    trecho: "decidirEAplicarReplanejamentoConjunto({ calendarioId, revisaoId, aprovar: false, motivo, excecoesAutorizadas: [] })",
    motivo: "rejeitar só encerra a revisão, sem mexer na agenda; aprovar e aplicar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas.tsx",
    trecho: "decidirAlteracaoQuantidadeAulasModalidade({ propostaId, aprovar: false, motivo })",
    motivo: "rejeitar só encerra a proposta (REJEITADA), sem mudar turma nenhuma; aprovar e aplicar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx",
    trecho: "decidirPresencaHistoricaMigracao({propostaId:p.id,aprovada:false,motivo,chaveIdempotencia:chaveAtual()})",
    motivo: "rejeitar não toca o diário (a proposta só fica REJEITADA); aprovar e aplicar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/usuarios/UsuariosPainel.tsx",
    trecho: "definirUsuarioAtivo(id, true)",
    motivo: "ativar devolve o acesso e tem volta na própria linha; desativar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/catalogo/IdiomasPainel.tsx",
    trecho: "definirIdiomaAtivo(id, true)",
    motivo: "ativar o idioma tem volta na própria linha; desativar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/configuracao/catalogo/PrecosPainel.tsx",
    trecho: "definirPrecoAtivo(id, true)",
    motivo: "reativar um preço do histórico tem volta na própria linha; desativar o ativo abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx",
    trecho: "definirSituacaoEmpresa(empresa.id, true)",
    motivo: "reativar a empresa tem volta pelo mesmo botão; inativar abre o ConfirmarAcao",
  },
  // Confirmações que faltavam (#175; triagem B6).
  {
    arquivo: "src/app/(app)/financeiro/permuta/PermutaOperacional.tsx",
    trecho: "decidirCompensacaoPermuta({ propostaId: proposta.id, aprovar: false, motivo: motivoDecisao })",
    motivo: "rejeitar não abate nada (a proposta só fica rejeitada); aprovar e compensar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/alunos/[id]/portal/painel.tsx",
    trecho: "decidirTrocaEmailPortalAluno({ solicitacaoId, aprovar: false, motivo })",
    motivo: "rejeitar não mexe na conta do portal (a solicitação só fica rejeitada); aprovar e aplicar abre o ConfirmarAcao",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/[realizacaoId]/Formularios.tsx",
    trecho: "decidirNotaRecuperacao({ notaId, entradaHash, aprovada: false, motivo })",
    motivo: "rejeitar a versão não oficializa nada (o professor lança outra versão); oficializar abre o ConfirmarAcao",
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
