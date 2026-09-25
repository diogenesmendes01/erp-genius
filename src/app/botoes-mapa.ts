// Mapeamento travado da migração E1 (docs/42-auditoria-frontend-ux.md): para cada tela das áreas
// migradas, cada chamada a botaoClasses(...) — na ordem do fonte — com o rótulo que a localiza (texto
// visível do botão/link, ou o nome da constante) e a variante/tamanho decididos na migração.
//
// Regra aplicada na migração (preserva a intenção de cada botão):
//   fundo da marca + texto branco → primario; borda neutra → secundario; borda/fundo vermelho →
//   perigo; borda verde → primario; borda azul → secundario.
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
};
