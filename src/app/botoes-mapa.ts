// Mapeamento travado da migração E1 (docs/42-auditoria-frontend-ux.md): para cada tela das áreas
// migradas, cada chamada a botaoClasses(...) — na ordem do fonte — com o rótulo que a localiza (texto
// visível do botão/link, ou o nome da constante) e a variante/tamanho decididos na migração.
//
// Regra aplicada na migração (preserva a intenção de cada botão):
//   fundo da marca (ou verde de sucesso) + texto branco → primario; borda neutra → secundario;
//   borda/fundo vermelho → perigo; borda verde → primario; borda azul → secundario.
//   py-1 → sm; py-1.5 ou sem py → md; py-2 / p-2 → lg.
// Trocar a variante ou o tamanho de um botão (ou incluir/remover um) quebra src/app/botoes.test.ts;
// o diff do teste mostra o mapa real para a revisão decidir.
export const MAPA_BOTOES: Record<string, string[]> = {
  "configuracao/catalogo/EntradasOfertas.tsx": [
    "<button> Salvando… · Salvar regras da oferta → secundario/md",
  ],
  "configuracao/catalogo/IdiomasPainel.tsx": [
    "<button> Adicionar → primario/lg",
  ],
  "configuracao/catalogo/ModalidadeFormulario.tsx": [
    "<button> Salvando… · Salvar modalidade → primario/lg",
    "<button> Cancelar → secundario/lg",
  ],
  "configuracao/catalogo/ModalidadesPainel.tsx": [
    "<button> Nova modalidade → primario/md",
  ],
  "configuracao/catalogo/NiveisPainel.tsx": [
    "<button> Adicionar nível → primario/lg",
  ],
  "configuracao/catalogo/PrecosPainel.tsx": [
    "<button> Novo preço → primario/md",
    "<button> Salvando… · Salvar preço → primario/lg",
    "<button> Cancelar → secundario/lg",
  ],
  "configuracao/catalogo/ProdutosPainel.tsx": [
    "<button> Adicionar produto → primario/lg",
  ],
  "configuracao/contratos/DecidirModelo.tsx": [
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "configuracao/contratos/ModeloFormulario.tsx": [
    "<button> Adicionar campo → secundario/sm",
    "<button> Adicionar seção → secundario/sm",
    "<button> Adicionar regra de assinatura → secundario/sm",
    "<button> Salvando proposta… · Salvar proposta para aprovação → primario/lg",
  ],
  "configuracao/migracao/PreparacaoMigracaoPainel.tsx": [
    "<button> Lendo… · Ler arquivo → secundario/md",
    "<button> Preparando… · Preparar lote → primario/lg",
  ],
  "configuracao/migracao/[loteId]/AplicarCadastroMigracao.tsx": [
    "<button> Processando… · Ensaiar cadastros → secundario/md",
    "<button> Processando… · Aplicar cadastros confirmados → primario/md",
  ],
  "configuracao/migracao/[loteId]/AplicarVinculoMigracao.tsx": [
    "<button> Adicionar fato → secundario/sm",
    "<button> Aplicando… · Aplicar vínculo conferido → primario/sm",
  ],
  "configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx": [
    "<button> Conferindo… · Ensaiar vínculo → secundario/sm",
    "<button> Salvar correspondência → secundario/sm",
    "<button> Revogar correspondência → secundario/sm",
  ],
  "configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx": [
    "<button> Registrando… · Registrar proposta → primario/lg",
    "<button> Registrando… · Decidir → secundario/sm",
    "<button> Registrando… · Registrar resolução → secundario/sm",
  ],
  "configuracao/operacao/OperacaoFormulario.tsx": [
    "<button> Salvando… · Salvar configuração → primario/lg",
  ],
  "configuracao/operacao/PrazosEntregaReposicaoFormulario.tsx": [
    "<button> Salvando… · Salvar prazos de reposição → secundario/md",
  ],
  "configuracao/operacao/PrazosPortalFormulario.tsx": [
    "<button> Salvando… · Salvar prazos do portal → secundario/md",
  ],
  "configuracao/operacao/avisos-diario/AvisosDiarioFormulario.tsx": [
    "<button> Salvando… · Salvar avisos → secundario/md",
  ],
  "configuracao/paises/PaisFormulario.tsx": [
    "<button> Salvando… · Salvar país → primario/lg",
    "<button> Cancelar → secundario/lg",
  ],
  "configuracao/paises/PaisesPainel.tsx": [
    "<button> Novo país → primario/lg",
  ],
  "configuracao/turmas/ImportarTurmasModal.tsx": [
    "const btnPri → primario/lg",
    "const btnSec → secundario/lg",
  ],
  "configuracao/turmas/TurmaFormulario.tsx": [
    "<button> Salvando… · Salvar turma → primario/lg",
    "<button> Cancelar → secundario/lg",
  ],
  "configuracao/turmas/TurmasPainel.tsx": [
    "<button> Nova turma → primario/lg",
  ],
  "configuracao/usuarios/UsuarioFormulario.tsx": [
    "<button> Salvando… · Salvar usuário → primario/lg",
    "<button> Cancelar → secundario/lg",
  ],
  "configuracao/usuarios/UsuariosPainel.tsx": [
    "<button> Novo usuário → primario/lg",
  ],
  "configuracao/whatsapp/AvisosAgendaPainel.tsx": [
    "<button> Salvando… · Salvar canal de agenda → primario/md",
  ],
  "configuracao/whatsapp/ComercialPainel.tsx": [
    "const btnPri → primario/md",
  ],
  "configuracao/whatsapp/NumerosPainel.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/sm",
  ],
  "configuracao/whatsapp/PoliticaPainel.tsx": [
    "const btnPri → primario/md",
    "<button> Kill switch LIGADO — destravar · Kill switch → perigo|secundario/md",
  ],
  "configuracao/whatsapp/ReguaComercialPainel.tsx": [
    "const btnPri → primario/md",
  ],
  "configuracao/whatsapp/TemplatesPainel.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/sm",
  ],
  "diario/DiarioAulas.tsx": [
    "const botao → primario/lg",
    "<button> Cancelar → secundario/lg",
    "<Link> Completar diário do encontro → secundario/lg",
    "<button> Editar registro → secundario/lg",
  ],
  "diario/encontros/[id]/ChamadaEncontro.tsx": [
    "<button> Salvando… · Salvar lançamento pendente · Registrar diário → primario/lg",
  ],
  "diario/encontros/[id]/OcorrenciaParticular.tsx": [
    "<button> Registrando… · Registrar nova versão · Registrar ocorrência → primario/lg",
  ],
  "diario/encontros/[id]/PublicarGravacao.tsx": [
    "<button> Publicando… · Publicar gravação e concluir aula → primario/lg",
  ],
  "diario/encontros/[id]/SolicitarExcecao.tsx": [
    "<button> Solicitar conclusão excepcional → secundario/lg",
  ],
  "diario/encontros/[id]/cancelamento/CancelamentoParticular.tsx": [
    "<button> Solicitar cancelamento → secundario/lg",
    "<button> Confirmar decisão → secundario/lg",
  ],
  "diario/encontros/[id]/correcao/CorrecaoAula.tsx": [
    "<button> Recarregar fonte → secundario/lg",
    "<button> Registrando… · Registrar proposta de correção → primario/lg",
    "<button> Conferindo… · Conferir impactos da proposta → secundario/lg",
    "<button> Conferindo… · Conferir impactos desta proposta → secundario/lg",
    "<button> Publicar correção → primario/lg",
    "<button> Publicando… · Confirmar publicação → primario/lg",
    "<button> Cancelar → secundario/lg",
    "<button> Rejeitar proposta → perigo/lg",
    "<button> Registrando… · Confirmar rejeição → perigo/lg",
    "<button> Cancelar → secundario/lg",
    "<button> Carregando… · Carregar propostas anteriores → secundario/lg",
  ],
  "diario/encontros/[id]/correcao/CorrecaoFonteGravacao.tsx": [
    "<button> Preparando… · Propor nova fonte para revisão → secundario/lg",
  ],
  "diario/encontros/[id]/remarcacao/RemarcacaoParticular.tsx": [
    "<button> Conferir e submeter proposta → secundario/lg",
    "<button> Confirmar decisão → secundario/lg",
  ],
  "diario/excecoes-gravacao/DecidirExcecao.tsx": [
    "<button> Aprovar exceção e concluir aula → primario/lg",
    "<button> Rejeitar solicitação → secundario/lg",
  ],
  "diario/page.tsx": [
    "<button> Buscar → secundario/md",
  ],
  "diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx": [
    "<button> Preparar proposta para revisão → secundario/lg",
    "<button> Aprovar fonte → secundario/lg",
    "<button> Rejeitar → secundario/lg",
  ],
  "diario/regularizacoes-gravacao/page.tsx": [
    "<button> Buscar → secundario/md",
  ],
  "diario/regularizacoes/GerirDesignacoes.tsx": [
    "<button> Designar → primario/lg",
    "<button> Revogar designação → secundario/lg",
  ],
  "diario/reposicoes/ExcecaoAgendaReposicao.tsx": [
    "<button> Enviando… · Propor exceção → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "diario/reposicoes/OperacaoEntregaReposicao.tsx": [
    "<button> Repetir substituição · Confirmar substituição · Confirmar de → secundario/lg",
    "<button> Usar gravação da aula original e abrir prazo → secundario/lg",
    "<button> Publicar e abrir prazo → secundario/lg",
    "<button> Prorrogar prazo conferido → secundario/lg",
    "<button> Liberar entrega específica → secundario/lg",
    "<button> Confirmar indisponibilidade e pausar prazo → secundario/lg",
    "<button> Descartar relato sem pausar → secundario/lg",
    "<button> Retomar material e prazo → secundario/lg",
  ],
  "diario/reposicoes/RelatarIndisponibilidadeReposicao.tsx": [
    "<button> Registrando… · Registrar relato → secundario/lg",
  ],
  "diario/reposicoes/ReposicaoDocente.tsx": [
    "<button> Registrar diário da particular → secundario/lg",
    "<button> Confirmar reposição → secundario/lg",
    "<button> Validando… · Confirmar reposição → secundario/lg",
    "<button> Pedir correção ao aluno → secundario/lg",
  ],
  "diario/reposicoes/ReposicoesEquipe.tsx": [
    "<button> Registrando… · Registrar pedido → secundario/lg",
    "<button> Conferindo… · Conferir agenda → secundario/lg",
    "<button> Confirmar agendamento → secundario/lg",
    "<button> Propor cancelamento → secundario/lg",
    "<button> Propor remarcação → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "diario/reposicoes/[id]/troca-fonte/TrocaFonteReposicao.tsx": [
    "<button> Preparar para decisão independente → secundario/lg",
    "<button> Aprovar adoção → secundario/lg",
    "<button> Rejeitar → secundario/lg",
  ],
  "academico/MudancasAcademicasPainel.tsx": [
    "const botao → secundario/lg",
    "const principal → primario/lg",
  ],
  "academico/admissoes/[id]/JanelaFormulario.tsx": [
    "<button> Preparando… · Preparar para decisão → primario/lg",
    "<button> Aprovar janela → secundario/lg",
    "<button> Rejeitar janela → secundario/lg",
  ],
  "academico/admissoes/excecoes/[reservaId]/FormularioExcecao.tsx": [
    "<button> Registrando… · Registrar decisão · Propor exceção → secundario/lg",
  ],
  "academico/admissoes/page.tsx": [
    "<button> Buscar → secundario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx": [
    "<button> Registrando… · Registrar versão → primario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/[codigo]/designacao/Formulario.tsx": [
    "<button> Registrando… · revogar · Revogar designação · Registrar desi → secundario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/[codigo]/designacao/page.tsx": [
    "<button> Buscar → secundario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx": [
    "<button> Aplicar fuso → secundario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/equivalencia/PrepararEquivalenciaTransferencia.tsx": [
    "<button> Conferindo… · Atualizar requisitos · Carregar requisitos e f → secundario/lg",
    "<button> Conferindo… · Revisar mapeamento selecionado → secundario/lg",
    "<button> Registrando… · Registrar proposta para decisão → primario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/fechamento/ConfirmarFechamento.tsx": [
    "<button> Confirmando… · Confirmar fechamento → primario/lg",
  ],
  "academico/avaliacoes/[alocacaoId]/fechamento/ExcecaoFrequencia.tsx": [
    "<button> Registrando… · Registrar nova proposta · Registrar proposta → primario/lg",
    "<button> Registrando… · Registrar decisão → primario/lg",
  ],
  "academico/calendario/[id]/DecidirCalendario.tsx": [
    "<button> Aprovar e publicar calendário → primario/lg",
    "<button> Rejeitar proposta → secundario/lg",
  ],
  "academico/calendario/[id]/replanejamento/EditorRevisao.tsx": [
    "<button> Remover ajuste → secundario/lg",
    "<button> Adicionar ajuste → secundario/lg",
    "<button> Conferindo… · Conferir datas e conflitos → primario/lg",
  ],
  "academico/calendario/[id]/replanejamento/SalvarRevisao.tsx": [
    "<button> Registrando… · Guardar revisão → primario/lg",
  ],
  "academico/calendario/[id]/revisoes/[revisaoId]/DecidirReplanejamento.tsx": [
    "<button> Registrando… · Aprovar e aplicar conjunto → primario/lg",
    "<button> Rejeitar revisão → secundario/lg",
  ],
  "academico/calendario/novo/PrepararCalendario.tsx": [
    "<button> Remover da proposta → secundario/lg",
    "<button> Adicionar período → secundario/lg",
    "<button> Preparando… · Preparar calendário para revisão → primario/lg",
  ],
  "academico/calendario/page.tsx": [
    "<Link> Preparar nova versão → secundario/lg",
  ],
  "academico/correcoes/PrepararCasosHistoricos.tsx": [
    "<button> Preparar casos de revisão → secundario/lg",
  ],
  "academico/correcoes/[lancamentoId]/Formularios.tsx": [
    "<button> Registrando… · Registrar proposta → primario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx": [
    "<button> Conferir prévia atual → secundario/lg",
    "<button> Propor resolução → primario/lg",
    "<button> Aprovar proposta → primario/lg",
    "<button> Rejeitar proposta → secundario/lg",
  ],
  "academico/equivalencias/[propostaId]/AcoesEquivalencia.tsx": [
    "<button> Registrando… · Registrar decisão → primario/lg",
    "<button> Efetivando… · Efetivar transferência → primario/lg",
  ],
  "academico/grades/[id]/DecidirGrade.tsx": [
    "<button> Aprovar e publicar encontros → primario/lg",
    "<button> Rejeitar proposta → secundario/lg",
  ],
  "academico/grades/nova/PrepararGrade.tsx": [
    "<button> Preparando… · Preparar para revisão → primario/lg",
  ],
  "academico/grades/nova/page.tsx": [
    "<button> Buscar turmas → secundario/lg",
  ],
  "academico/grades/page.tsx": [
    "<Link> Preparar nova grade → secundario/lg",
  ],
  "academico/indisponibilidades/DecisaoAusencia.tsx": [
    "<button> Aprovar indisponibilidade → primario/lg",
    "<button> Rejeitar → secundario/lg",
  ],
  "academico/indisponibilidades/SolicitarAusencia.tsx": [
    "<button> Registrando… · Enviar solicitação → primario/lg",
  ],
  "academico/modalidades/[id]/quantidade/AlterarQuantidadeAulas.tsx": [
    "<button> Conferindo… · Conferir impactos → secundario/lg",
    "<button> Preparando… · Preparar revisão conjunta → primario/lg",
  ],
  "academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas.tsx": [
    "<button> Aprovar e aplicar → primario/lg",
    "<button> Rejeitar → secundario/lg",
  ],
  "academico/recuperacoes/AgendaPublicada.tsx": [
    "<button> Atualizar situação → secundario/lg",
  ],
  "academico/recuperacoes/[realizacaoId]/Formularios.tsx": [
    "<button> Salvando… · Salvar versão → secundario/lg",
    "<button> Conferindo… · Registrar decisão → secundario/lg",
  ],
  "academico/recuperacoes/correcoes/[notaId]/Formularios.tsx": [
    "<button> Conferindo… · Conferir proposta e impactos → secundario/lg",
  ],
  "academico/recuperacoes/planos/AutorizarPreparacao.tsx": [
    "<button> Autorizando… · Autorizar preparação → secundario/lg",
  ],
  "academico/recuperacoes/planos/Formularios.tsx": [
    "<button> Enviando… · Propor plano → secundario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/recuperacoes/planos/[propostaId]/Formularios.tsx": [
    "<button> Registrando… → secundario/lg",
  ],
  "academico/recuperacoes/planos/[propostaId]/PreviaAgenda.tsx": [
    "<button> Conferindo… · Conferir horário → secundario/lg",
  ],
  "academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/Formulario.tsx": [
    "<button> Autorizando… · Autorizar pré-reserva → secundario/lg",
    "<button> Reservando… · Reservar tentativa autorizada → secundario/lg",
  ],
  "academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/Formulario.tsx": [
    "<button> Autorizando… · Autorizar realização especial → secundario/lg",
  ],
  "academico/recuperacoes/tentativas/[itemReservaId]/designacao/PreviaSubstituicao.tsx": [
    "<button> Conferindo… · Conferir disponibilidade → secundario/lg",
  ],
  "academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx": [
    "<button> Buscar → secundario/lg",
  ],
  "academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/DecidirSubstituicao.tsx": [
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/regras/[nivelId]/Formularios.tsx": [
    "<button> Adicionar avaliação → secundario/lg",
    "<button> Remover última avaliação → secundario/lg",
    "<button> Salvando… · Enviar proposta para conferência → primario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/regras/page.tsx": [
    "<button> Buscar → secundario/lg",
  ],
  "academico/regras/turmas/[turmaId]/Formularios.tsx": [
    "<button> Registrando… · Registrar proposta → primario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx": [
    "<button> Registrando… · Propor conferência → secundario/lg",
    "<button> Revisando… · Revisar → secundario/md",
  ],
  "academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx": [
    "<button> Registrando… · Registrar proposta → secundario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/FormularioOcorrencia.tsx": [
    "<button> Registrando… · Registrar ocorrência → secundario/lg",
  ],
  "academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx": [
    "<button> Enviar proposta → primario/lg",
    "<button> Registrar decisão → primario/lg",
    "<button> Disponibilizar e iniciar prazo → secundario/lg",
  ],
  "academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/Formulario.tsx": [
    "<button> Autorizando… · Autorizar realização especial → secundario/lg",
  ],
  "academico/segundas-chamadas/minhas/[reservaId]/Formulario.tsx": [
    "<button> Registrando… · Registrar realização → secundario/lg",
    "<button> Submetendo… · Submeter nota para conferência → secundario/lg",
  ],
  "academico/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx": [
    "<button> Salvando… · Registrar decisão → secundario/lg",
    "<button> Conferindo… · Conferir prévia → secundario/lg",
    "<button> Enviando… · Enviar proposta para decisão → secundario/lg",
  ],
  "academico/segundas-chamadas/propostas/[propostaId]/designacao/Formulario.tsx": [
    "<button> Designando… · Designar professor → secundario/lg",
  ],
  "academico/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx": [
    "<button> Buscar → secundario/lg",
  ],
  "academico/segundas-chamadas/reservas/[reservaId]/cancelamento/Formulario.tsx": [
    "<button> Salvando… · Registrar decisão · Enviar proposta → secundario/lg",
  ],
  "academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario.tsx": [
    "<button> Salvando… · Registrar decisão · Enviar proposta → secundario/lg",
  ],
  "academico/segundas-chamadas/reservas/[reservaId]/substituicao/Formulario.tsx": [
    "<button> Salvando… · Registrar decisão · Enviar proposta → secundario/lg",
  ],
  "alunos/AlunosLista.tsx": [
    "<Link> Cadastrar aluno → primario/lg",
    "<button> Buscando… · Buscar → secundario/md",
  ],
  "alunos/ImportarAlunosModal.tsx": [
    "const btnPri → primario/lg",
    "const btnSec → secundario/lg",
  ],
  "alunos/[id]/FichaAluno.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/md",
    "<button> Encerrar → perigo/md",
    "<button> Encerrar → perigo/md",
    "<button> Confirmando… · Confirmar encerramento → perigo/md",
  ],
  "alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx": [
    "<button> Guardar proposta → secundario/lg",
    "<button> Confirmar decisão → secundario/lg",
    "<button> Cancelar e liberar reserva → secundario/lg",
    "<button> Registrar execução → secundario/lg",
    "<button> Conciliar resultado → secundario/lg",
  ],
  "alunos/[id]/creditos/[creditoId]/PropostaUsoCredito.tsx": [
    "<button> Guardar proposta para conferência → secundario/lg",
    "<button> Confirmar decisão → secundario/lg",
  ],
  "alunos/[id]/financeiro/ConcluirMatriculas.tsx": [
    "<button> Concluindo… · Concluir matrícula → primario/lg",
  ],
  "alunos/[id]/financeiro/FichaFinanceira.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/sm",
    "<button> Cancelar → secundario/md",
  ],
  "alunos/[id]/financeiro/ResumoFinanceiroComercial.tsx": [
    "<button> Enviando… · Solicitar desconto → secundario/md",
  ],
  "alunos/[id]/movimentacoes/AcertoEncerramento.tsx": [
    "<button> Carregar / atualizar conferência → secundario/lg",
    "<button> Conferir se o rascunho continua atual → secundario/lg",
    "<button> Calcular componente mensal → secundario/lg",
    "<button> Salvar rascunho financeiro → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/CompensacoesPainel.tsx": [
    "<button> Registrar decisão → secundario/lg",
    "<button> Carregar compensações → secundario/lg",
    "<button> Adicionar dia → secundario/lg",
    "<button> Remover → secundario/lg",
    "<button> Enviar proposta para aprovação → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/ComprasHorasPainel.tsx": [
    "<button> Consultar compras de horas → secundario/lg",
    "<button> Reservar horas → secundario/lg",
    "<button> Registrar compra de horas → secundario/lg",
    "<button> Conferir realização → secundario/lg",
    "<button> Confirmar consumo pela realização → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/CumprimentoPainel.tsx": [
    "<button> Enviar conferência de cumprimento → secundario/lg",
    "<button> Registrar decisão de cumprimento → secundario/lg",
    "<button> Atualizar cumprimentos → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/LiberacaoHoras.tsx": [
    "<button> Preparar proposta para conferência → secundario/lg",
    "<button> Confirmar decisão → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/MovimentacoesPainel.tsx": [
    "<button> Consultar propostas → secundario/lg",
    "<button> Conferir impactos → secundario/lg",
    "<button> Próximas propostas → secundario/lg",
    "<button> Aprovar proposta → secundario/lg",
    "<button> Rejeitar proposta → secundario/lg",
    "<button> Aplicar proposta aprovada → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/NovaPausa.tsx": [
    "<button> Conferir impactos → secundario/lg",
    "<button> Registrar proposta para decisão independente → primario/lg",
  ],
  "alunos/[id]/movimentacoes/NovaRetomada.tsx": [
    "<button> Consultar períodos suspensos → secundario/lg",
    "<button> Conferir proposta completa → secundario/lg",
    "<button> Registrar proposta para decisão independente → primario/lg",
  ],
  "alunos/[id]/movimentacoes/NovoEncerramento.tsx": [
    "<button> Registrar pedido de encerramento → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/RecomposicaoPainel.tsx": [
    "<button> Consultar rascunho de recomposição → secundario/lg",
    "<button> Conferir atualidade → secundario/lg",
    "<button> Aplicar programação aprovada → secundario/lg",
    "<button> Registrar decisão da recomposição → secundario/lg",
    "<button> Conferir proposta de recomposição → secundario/lg",
    "<button> Salvar versão da recomposição → secundario/lg",
  ],
  "alunos/[id]/movimentacoes/VinculosLegados.tsx": [
    "<button> Consultar vínculos sem matrícula → secundario/lg",
    "<button> Confirmar vínculo conferido → secundario/lg",
  ],
  "alunos/[id]/portal/painel.tsx": [
    "<button> Preparar convite → primario/lg",
    "<button> Preparar validação → secundario/lg",
    "<button> Aprovar e aplicar → primario/sm",
    "<button> Rejeitar → secundario/sm",
  ],
  "financeiro/AcessoAulasPainel.tsx": [
    "const botao → secundario/md",
  ],
  "financeiro/FilaCobranca.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/sm",
    "<button> Consultar acesso → perigo/sm",
  ],
  "financeiro/FinanceiroPainel.tsx": [
    "const btnPri → primario/md",
    "const btnSec → secundario/sm",
    "<button> Aprovar → primario/sm",
    "<button> Rejeitar → secundario/sm",
  ],
  "financeiro/InformesPagamento.tsx": [
    "<button> Confirmar recebimento → primario/md",
    "<button> Rejeitar → secundario/md",
  ],
  "financeiro/PoliticasComissao.tsx": [
    "<button> Publicar nova versão → primario/lg",
  ],
  "financeiro/RetomadasPainel.tsx": [
    "const botao → secundario/lg",
    "const principal → primario/lg",
  ],
  "financeiro/acertos-taxa/DecisaoTaxa.tsx": [
    "<button> Aprovar acerto → secundario/lg",
    "<button> Rejeitar acerto → secundario/lg",
    "<button> Aplicar acerto aprovado → secundario/lg",
    "<button> Conferir e invalidar para repropor → secundario/lg",
  ],
  "financeiro/acertos-taxa/ImpactosTaxaOperacao.tsx": [
    "<button> Vincular acerto → secundario/sm",
  ],
  "financeiro/acertos-vencimento/[matriculaId]/[propostaId]/Formulario.tsx": [
    "<button> Registrado · Processando… · Repetir mesma tentativa · prepar → secundario/lg",
  ],
  "financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx": [
    "<button> Registrando… · Registrar proposta → primario/lg",
    "<button> Registrando… · Registrar decisão → secundario/sm",
  ],
  "financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx": [
    "<button> Registrando… · Registrar proposta histórica → primario/lg",
    "<button> Registrando… · Decidir → secundario/md",
  ],
  "financeiro/permuta/PermutaOperacional.tsx": [
    "<button> Enviando… · Registrar → secundario/sm",
  ],
  "financeiro/recebimentos/RecebimentoDestinadoForm.tsx": [
    "<button> Registrando… · Tentar novamente · Confirmar recebimento → primario/lg",
    "<button> Novo lançamento → secundario/lg",
  ],
  "matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario.tsx": [
    "<button> Registrando… · Registrar autorização → secundario/lg",
    "<button> Revogar autorização → secundario/lg",
  ],
  "matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx": [
    "<button> Enviando… · Propor direito de compensação → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/compensacoes/[cobrancaId]/periodo-integral/PeriodoIntegral.tsx": [
    "<button> Enviando… · Propor regularização → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
    "<button> Aplicando… · Aplicar regularização aprovada → secundario/lg",
  ],
  "matriculas/[id]/condicoes-horas/CondicoesHoras.tsx": [
    "<button> Registrando… · Preparar para revisão → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/condicoes/CondicoesFormulario.tsx": [
    "<button> Registrando… · Registrar condições de entrada → secundario/lg",
  ],
  "matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx": [
    "<button> Remover → secundario/md",
    "<button> Adicionar feriado → secundario/lg",
    "<button> Registrando… · Preparar para revisão → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/contrato/ConferirAceite.tsx": [
    "<button> Registrando… · Confirmar aceite do original assinado → secundario/lg",
  ],
  "matriculas/[id]/contrato/ConferirAssinatura.tsx": [
    "<button> Registrando… · Registrar conferência para assinatura → secundario/lg",
  ],
  "matriculas/[id]/contrato/PreservarOriginal.tsx": [
    "<button> Gerando e preservando… · Gerar e preservar original → secundario/lg",
  ],
  "matriculas/[id]/contrato/RegistrarPrevia.tsx": [
    "<button> Registrando… · Preservar esta prévia → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/AssinaturaFormulario.tsx": [
    "<button> Registrando… · Registrar conferência → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/CondicoesFormalizadasFormulario.tsx": [
    "<button> Registrando… → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/ConferenciaFinalFormulario.tsx": [
    "<button> Registrando… · Registrar conferência interna → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/Formularios.tsx": [
    "<button> Registrando… · Registrar proposta de aditivo → secundario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/OriginalFormulario.tsx": [
    "<button> Gerando… · Gerar e preservar original do aditivo → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/ParticipantesFormulario.tsx": [
    "<button> Consultar exigências e participantes → secundario/lg",
    "<button> Reabrir formulário e descartar preenchimento → secundario/lg",
    "<button> Documentos anteriores → secundario/lg",
    "<button> Próximos documentos → secundario/lg",
    "<button> Aguarde… · Registrar conferência dos signatários → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/ProcessoFormulario.tsx": [
    "<button> Preparando… · Preparar processo de assinatura → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/[propostaId]/alcadas/Formulario.tsx": [
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx": [
    "<button> Conferindo… · Conferir alterações → secundario/lg",
    "<button> Registrando… · Registrar fotografia da agenda → secundario/lg",
  ],
  "matriculas/[id]/contrato/previas/[previaId]/participantes/Formulario.tsx": [
    "<button> Registrando… · Registrar conferência dos participantes → secundario/lg",
  ],
  "matriculas/[id]/contrato/previas/[previaId]/participantes/page.tsx": [
    "<button> Atualizar papéis exigidos → secundario/lg",
  ],
  "matriculas/[id]/contrato/substituicoes/Formularios.tsx": [
    "<button> Registrando… · Registrar proposta de substituição → secundario/lg",
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/desistencia/EfetivacaoFormulario.tsx": [
    "<button> Efetivando… · Confirmar desistência e liberar reservas → secundario/lg",
  ],
  "matriculas/[id]/desistencia/PedidoFormulario.tsx": [
    "<button> Registrando… · Registrar pedido → secundario/lg",
  ],
  "matriculas/[id]/desistencia/administracao/DecisaoFormulario.tsx": [
    "<button> Registrando… · Registrar decisão administrativa → secundario/lg",
  ],
  "matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx": [
    "<button> Preparando… · Reapresentar memória contratual · Preparar mem → secundario/lg",
    "<button> Registrando… · Registrar decisão independente → secundario/lg",
    "<button> Aplicando… · Aplicar acerto aprovado → secundario/lg",
  ],
  "matriculas/[id]/desistencia/financeiro/Formularios.tsx": [
    "<button> Registrando… · Submeter proposta financeira → secundario/lg",
    "<button> Registrando… · Registrar decisão independente → secundario/lg",
  ],
  "matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx": [
    "<button> Reconciliando… · Reconciliar mesma tentativa → secundario/lg",
    "<button> Preparando… · Preparar reconferência → secundario/lg",
    "<button> Registrando… · Registrar decisão administrativa · Registrar → secundario/lg",
    "<button> Aplicando… · Aplicar reconferência → secundario/lg",
  ],
  "matriculas/[id]/disponibilidade-oferta/DisponibilidadeOferta.tsx": [
    "<button> Enviar para conferência → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/emissao/ConfirmarEmissao.tsx": [
    "<button> Conferindo e emitindo… · Confirmar conferência e emitir cobr → secundario/lg",
  ],
  "matriculas/[id]/fechamentos-horas/DecidirFechamento.tsx": [
    "<button> Registrando… · Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx": [
    "<button> Emitindo… · Emitir cobrança aprovada → secundario/lg",
  ],
  "matriculas/[id]/fechamentos-horas/PrepararFechamento.tsx": [
    "<button> Conferindo… · Salvar rascunho do período conferido · Conferi → secundario/lg",
  ],
  "matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx": [
    "<button> Registrando… · Registrar relato → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/indisponibilidade-oferta/[registroId]/termino/TerminoIndisponibilidadeOferta.tsx": [
    "<button> Registrando… · Propor último dia → secundario/lg",
    "<button> Registrar decisão → secundario/lg",
  ],
  "matriculas/[id]/nova-reserva/Formulario.tsx": [
    "<button> Buscar → secundario/lg",
    "<button> Adicionar encontro → secundario/lg",
    "<button> Revisar horários e condições → secundario/lg",
    "<button> Confirmar nova reserva → secundario/lg",
  ],
  "matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx": [
    "<button> Conferir prévia → secundario/lg",
    "<button> Registrar conferência → secundario/lg",
  ],
  "matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx": [
    "<button> Preparar revisão financeira → secundario/lg",
    "<button> Rejeitar revisão incompleta → secundario/lg",
    "<button> Aprovar sem alteração de valores → secundario/lg",
    "<button> Rejeitar → secundario/lg",
  ],
  "matriculas/[id]/pagador/PagadorFormulario.tsx": [
    "<button> Registrando… · Registrar pagador desta matrícula → secundario/lg",
  ],
  "matriculas/[id]/preparacao/DecidirPreco.tsx": [
    "<button> Aprovar exceção de preço → secundario/lg",
    "<button> Rejeitar exceção → secundario/lg",
  ],
  "matriculas/[id]/reserva/ReservarFormulario.tsx": [
    "<button> Conferindo e reservando… · Confirmar reserva de vaga → secundario/lg",
  ],
  "matriculas/nova/MatriculaFormulario.tsx": [
    "<button> Próximo: curso e contrato → → primario/lg",
    "<button> ← Voltar → secundario/lg",
    "<button> Processando… · Salvar matrícula → secundario/lg",
  ],
};
