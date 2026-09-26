// Manifesto da trava de estados vazios (src/app/estados-vazios.test.ts). Gerado a partir das telas;
// qualquer mudança aqui aparece no diff da revisão.
//
// EXCECOES_ESTADO_VAZIO: ramos de "lista vazia" que não são estado vazio, ancorados em arquivo +
// condição + folha (texto exato do fonte, espaços normalizados). Cada um tem de casar com exatamente
// um ramo.
//
// MAPA_ESTADOS_VAZIOS: cada <EstadoVazio>/<EstadoVazioLinha> de cada arquivo, na ordem do fonte —
// variante (compacto/bloco/linha) e mensagem. Trocar um por outra coisa, apagá-lo ou mudar a variante
// muda o mapa e falha a trava; src/components/EstadoVazio.test.ts confere a contagem por outro caminho.

export type ExcecaoEstadoVazio = { arquivo: string; condicao: string; folha: string; motivo: string };

export const EXCECOES_ESTADO_VAZIO: readonly ExcecaoEstadoVazio[] = [
  {
    arquivo: "src/app/(app)/academico/calendario/novo/PrepararCalendario.tsx",
    condicao: "!periodos.length",
    folha: "<p>A proposta não contém períodos não letivos.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/planos/[propostaId]/PreviaAgenda.tsx",
    condicao: "dado.pendencias.length",
    folha: "<p>Nenhum impedimento encontrado nesta conferência. O horário ainda não está agendado.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/PreviaSubstituicao.tsx",
    condicao: "dado.pendencias.length",
    folha: "<p>Nenhum impedimento identificado nesta conferência. A substituição ainda não foi aplicada.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/page.tsx",
    condicao: "p.conferenciaOriginal.pendencias.length > 0",
    folha: "<p>Conferência de origem sem pendências registradas.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx",
    condicao: "!professores.length",
    folha: "<p role=\"alert\">Não há professor elegível disponível para esta agenda.</p>",
    motivo: "aviso (role=alert): não há professor para agendar",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx",
    condicao: "naoLetivos.length",
    folha: "<p>Não há período não letivo afetado.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx",
    condicao: "item.calendario.periodos.length",
    folha: "<p>Não há período não letivo afetado.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx",
    condicao: "p.calendario.periodosNaoLetivos.length > 0",
    folha: "<p>Não há período não letivo afetado.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/Formulario.tsx",
    condicao: "previa.pendencias.length",
    folha: "<p>Não há pendência apontada nesta conferência.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx",
    condicao: "produtos.length === 0",
    folha: "<span className=\"text-xs text-gray-400\">Cadastre produtos no Catálogo.</span>",
    motivo: "dica curta dentro de uma linha de checkboxes do formulário",
  },
  {
    arquivo: "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx",
    condicao: "pilotoLeads.length === 0",
    folha: "<p className=\"text-xs text-amber-700\"> Lista vazia = ninguém recebe. Adicione os leads do piloto abaixo. </p>",
    motivo: "aviso ou instrução (o que falta para seguir), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/home/HomeVendedor.tsx",
    condicao: "fila.length === 0",
    folha: "<p className=\"flex items-center gap-1.5 text-sm text-gray-400\"> <IconCircleCheck className=\"h-4 w-4 text-green-600\" /> Tudo em dia </p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/leads/[id]/contratacao/AgendaParticularFormulario.tsx",
    condicao: "revisao.impedimentos.length",
    folha: "<label className=\"block\"><input type=\"checkbox\" checked={confirmado} onChange={(e) => { setConfirmado(e.target.checked); onChange(e.target.checked ? { ...agenda(), estadoHash: revisao.estadoHash, horariosAcordadosConferidos: true } : null); }} /> Conferi os horários acordados e apresentados acima.</label>",
    motivo: "sem itens, a tela mostra o passo seguinte (confirmação/formulário), não uma mensagem",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx",
    condicao: "!diasSelecionaveis.length",
    folha: "<p role=\"status\">Todos os dias confirmados já possuem direito reconhecido.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx",
    condicao: "resultado.pendencias.length",
    folha: "<RegistrarFotografia matriculaId={matriculaId} resultado={resultado} />",
    motivo: "sem itens, a tela mostra o passo seguinte (confirmação/formulário), não uma mensagem",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/desistencia/page.tsx",
    condicao: "conferencia.pendencias.length",
    folha: "<p>Nenhum avanço formal identificado nos registros consultados. A equipe ainda deve conferir os requisitos antes da efetivação.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx",
    condicao: "!previa.pendencias.length",
    folha: "<form onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); iniciar(async () => { const entrada = { ...origem, estadoPrevia: previa.estadoPrevia, motivo: String(f.get(\"motivo\")) }, serial = JSON.stringify(entrada); if (chave.current.entrada !== serial) chave.current = { entrada: serial, valor: crypto.randomUUID() }; try { const r = await conferirOcorrenciaHoras({ ...entrada, chaveIdempotencia: chave.current.valor }); setMensagem(r.ok ? \"Conferência registrada.\" : r.erro); if (r.ok) { setPrevia(null); router.refresh(); } } catch { setMensagem(\"Atualize o histórico para conferir o resultado antes de repetir.\"); } }); }}><label className=\"block\">Justificativa da conferência<CampoTexto className=\"block w-full rounded border p-2\" name=\"motivo\" required minLength={5} maxLength={2000} disabled={ocupado} /></label> <button className={`${botaoClasses({ variante: \"secundario\", tamanho: \"lg\" })} mt-2`} disabled={ocupado}>Registrar conferência</button></form>",
    motivo: "sem itens, a tela mostra o passo seguinte (confirmação/formulário), não uma mensagem",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/preparacao/page.tsx",
    condicao: "prontidao.dado.pendencias.length",
    folha: "<p>Conferências básicas atendidas; prossiga com a conferência contratual completa.</p>",
    motivo: "veredito positivo de uma conferência (nada pendente), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/reserva/page.tsx",
    condicao: "!r.podeReservar && !r.reservas.length && r.prazoMinutos",
    folha: "<p>A situação da matrícula ou uma alocação existente impede nova reserva. Confira a contratação.</p>",
    motivo: "aviso ou instrução (o que falta para seguir), não lista sem itens",
  },
  {
    arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx",
    condicao: "!documentoId && !fontesOriginaisEnviados.length",
    folha: "<p className=\"text-sm\">Confirme o contrato ou aguarde o envio externo confirmado de um original para preparar estas condições.</p>",
    motivo: "aviso ou instrução (o que falta para seguir), não lista sem itens",
  },
  {
    arquivo: "src/components/CopilotoSugestoes.tsx",
    condicao: "sugestoes.length === 0",
    folha: "<p className=\"mt-1 text-xs text-ai-600/80\">Sem sugestões pendentes.</p>",
    motivo: "painel do copiloto: paleta própria (ai-*), fora do visual das listas",
  },
];

export const MAPA_ESTADOS_VAZIOS: Record<string, string[]> = {
  "src/app/(app)/academico/MudancasAcademicasPainel.tsx": [
    "compacto · Não há turma de destino disponível no mesmo idioma, modalidade e formato.",
    "bloco · Nenhuma solicitação acadêmica neste filtro.",
    "compacto · Nenhum parecer registrado.",
  ],
  "src/app/(app)/academico/admissoes/[id]/page.tsx": [
    "bloco · Nenhuma versão nesta página.",
  ],
  "src/app/(app)/academico/admissoes/excecoes/[reservaId]/page.tsx": [
    "compacto · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/admissoes/excecoes/page.tsx": [
    "bloco · Nenhuma reserva encontrada.",
  ],
  "src/app/(app)/academico/admissoes/page.tsx": [
    "bloco · Nenhuma turma encontrada.",
  ],
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/designacao/page.tsx": [
    "bloco · Nenhuma designação registrada.",
  ],
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx": [
    "bloco · Nenhuma nota registrada.",
  ],
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/equivalencia/PrepararEquivalenciaTransferencia.tsx": [
    "compacto · Nenhum registro oficial desta habilidade está disponível para indicar.",
  ],
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/page.tsx": [
    "bloco · Nenhuma habilidade deste vínculo ativo exige oportunidade extra neste momento.",
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx": [
    "bloco · Nenhuma avaliação disponível para este acesso.",
  ],
  "src/app/(app)/academico/avaliacoes/page.tsx": [
    "bloco · Nenhum vínculo disponível neste filtro.",
  ],
  "src/app/(app)/academico/calendario/[id]/page.tsx": [
    "compacto · Nenhum feriado, recesso ou férias nesta versão.",
  ],
  "src/app/(app)/academico/calendario/[id]/replanejamento/ConteudoRevisao.tsx": [
    "compacto · Nenhuma turma com encontro previsto futuro encontrada.",
  ],
  "src/app/(app)/academico/calendario/[id]/revisoes/page.tsx": [
    "bloco · Nenhuma revisão nesta página.",
  ],
  "src/app/(app)/academico/calendario/page.tsx": [
    "bloco · Nenhuma proposta encontrada.",
  ],
  "src/app/(app)/academico/correcoes/[lancamentoId]/[propostaId]/page.tsx": [
    "bloco · Nenhuma mudança aprovada ou executada identificada para este vínculo.",
  ],
  "src/app/(app)/academico/correcoes/[lancamentoId]/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/correcoes/page.tsx": [
    "bloco · Nenhum caso identificado.",
  ],
  "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx": [
    "compacto · Nenhuma proposta de resolução foi registrada.",
  ],
  "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx": [
    "compacto · Nenhuma fonte oficial foi preservada nesta proposta.",
    "compacto · Nenhuma fonte foi indicada; os requisitos permanecem pendentes para acompanhamento.",
  ],
  "src/app/(app)/academico/equivalencias/page.tsx": [
    "compacto · Nenhuma proposta autorizada aguarda execução nesta página.",
    "bloco · Nenhuma proposta de aproveitamento foi encontrada para esta matrícula.",
  ],
  "src/app/(app)/academico/grades/nova/page.tsx": [
    "bloco · Nenhuma turma planejada sem histórico ou agenda publicada foi encontrada.",
  ],
  "src/app/(app)/academico/grades/page.tsx": [
    "bloco · Nenhuma proposta encontrada.",
  ],
  "src/app/(app)/academico/indisponibilidades/SolicitarAusencia.tsx": [
    "compacto · Nenhum professor ativo disponível.",
  ],
  "src/app/(app)/academico/indisponibilidades/page.tsx": [
    "bloco · Nenhuma solicitação encontrada.",
    "compacto · Nenhuma aula prevista coincide atualmente com o período solicitado.",
    "compacto · Nenhuma aula prevista ou reserva particular conflita atualmente com este período.",
  ],
  "src/app/(app)/academico/recuperacoes/[realizacaoId]/page.tsx": [
    "bloco · Nenhuma versão de nota registrada nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/page.tsx": [
    "bloco · Sem propostas nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/designadas/page.tsx": [
    "bloco · Nenhuma tentativa disponível nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/page.tsx": [
    "bloco · Nenhuma realização disponível nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/page.tsx": [
    "bloco · Nenhuma autorização especial registrada.",
  ],
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/page.tsx": [
    "bloco · Nenhuma reserva nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx": [
    "bloco · Nenhuma proposta nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/planos/autorizacoes-preparacao/page.tsx": [
    "bloco · Nenhuma autorização de preparação registrada.",
  ],
  "src/app/(app)/academico/recuperacoes/planos/page.tsx": [
    "bloco · Nenhuma proposta nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page.tsx": [
    "compacto · Nenhuma proposta de cancelamento registrada.",
  ],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/agenda/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx": [
    "bloco · Nenhuma autorização especial registrada.",
  ],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx": [
    "bloco · Nenhuma designação nesta página.",
  ],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/regras/page.tsx": [
    "bloco · Nenhum nível encontrado.",
  ],
  "src/app/(app)/academico/regras/turmas/[turmaId]/historica/page.tsx": [
    "compacto · Nenhuma conferência registrada.",
  ],
  "src/app/(app)/academico/regras/turmas/[turmaId]/page.tsx": [
    "bloco · Nenhuma mudança proposta.",
  ],
  "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx": [
    "compacto · Não há correções nesta página.",
    "compacto · Não há encontro próprio ministrado com presença disponível para esta correção.",
    "compacto · Não há entrega completa disponível para esta correção.",
  ],
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx": [
    "compacto · Nenhuma proposta nesta avaliação.",
  ],
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/page.tsx": [
    "bloco · Nenhuma autorização especial registrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page.tsx": [
    "bloco · Nenhuma reserva registrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/agendas/page.tsx": [
    "bloco · Nenhuma agenda de segunda chamada foi encontrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/minhas/page.tsx": [
    "bloco · Nenhuma segunda chamada designada está disponível.",
  ],
  "src/app/(app)/academico/segundas-chamadas/pendentes-agenda/page.tsx": [
    "bloco · Nenhuma segunda chamada pendente de agenda foi encontrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx": [
    "bloco · Nenhuma agenda inicial foi preparada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx": [
    "bloco · Nenhuma designação registrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx": [
    "bloco · Nenhuma proposta de substituição foi registrada.",
  ],
  "src/app/(app)/alunos/AlunosLista.tsx": [
    "linha · {totalBase === 0 ? \"Nenhum aluno cadastrado no seu alcance.\" : filtrando ? ( <>Nenhum aluno com esse",
  ],
  "src/app/(app)/alunos/[id]/AcademicoAluno.tsx": [
    "compacto · Nenhum teste registrado.",
    "compacto · Nenhum certificado emitido.",
  ],
  "src/app/(app)/alunos/[id]/FichaAluno.tsx": [
    "compacto · Sem turma (lista de espera).",
    "compacto · Sem movimentações.",
  ],
  "src/app/(app)/alunos/[id]/agenda-aditivo/page.tsx": [
    "bloco · Não há matrícula particular ativa com encontro futuro disponível.",
  ],
  "src/app/(app)/alunos/[id]/creditos/[creditoId]/PropostaUsoCredito.tsx": [
    "compacto · Nenhuma cobrança em aberto disponível nesta matrícula.",
  ],
  "src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx": [
    "compacto · Sem ajustes.",
    "compacto · Sem comissão.",
    "compacto · Sem movimentações de cobrança.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesEncerramento.tsx": [
    "compacto · Nenhuma compensação registrada nesta consulta.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx": [
    "compacto · Nenhuma compra de horas registrada nesta matrícula.",
    "compacto · Nenhuma cobrança de particular por hora paga e sem compra vinculada.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/CumprimentoPainel.tsx": [
    "compacto · Nenhum dia de compensação programado para esta matrícula.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx": [
    "compacto · Nenhuma proposta encontrada.",
    "compacto · Nenhum período calculado nesta proposta.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/NovaPausa.tsx": [
    "compacto · Nenhum contrato ativo disponível para seleção.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/NovaRetomada.tsx": [
    "compacto · Nenhum contrato pausado disponível.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/NovoEncerramento.tsx": [
    "compacto · Nenhum contrato disponível.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx": [
    "compacto · Nenhum direito disponível sem programação.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/VinculosLegados.tsx": [
    "compacto · Nenhum vínculo ativo sem matrícula identificado.",
    "compacto · Não há contrato ativo compatível. Confira o cadastro contratual antes de associar.",
  ],
  "src/app/(app)/alunos/[id]/movimentacoes/page.tsx": [
    "compacto · Nenhum pedido registrado nesta página.",
  ],
  "src/app/(app)/alunos/[id]/portal/painel.tsx": [
    "compacto · Nenhuma solicitação.",
  ],
  "src/app/(app)/alunos/turma/[id]/page.tsx": [
    "linha · Nenhum aluno alocado.",
  ],
  "src/app/(app)/carteiras/CoberturasPainel.tsx": [
    "compacto · Nenhuma cobertura cadastrada.",
  ],
  "src/app/(app)/comissoes/page.tsx": [
    "bloco · {status ? <>Nenhuma comissão nesta situação. <Link href=\"/comissoes\" className=\"text-brand-700 hover",
  ],
  "src/app/(app)/configuracao/catalogo/EntradasOfertas.tsx": [
    "compacto · Cadastre a oferta do produto no país para configurar sua entrada.",
  ],
  "src/app/(app)/configuracao/catalogo/NiveisPainel.tsx": [
    "compacto · Sem níveis.",
  ],
  "src/app/(app)/configuracao/catalogo/PrecosPainel.tsx": [
    "linha · Nenhum preço cadastrado.",
  ],
  "src/app/(app)/configuracao/contratos/[codigo]/page.tsx": [
    "compacto · Sem campos variáveis.",
  ],
  "src/app/(app)/configuracao/contratos/page.tsx": [
    "bloco · Nenhum modelo cadastrado.",
  ],
  "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx": [
    "compacto · Ainda não há ensaio registrado para esta fotografia.",
  ],
  "src/app/(app)/configuracao/migracao/page.tsx": [
    "bloco · Nenhum lote foi preparado ainda.",
  ],
  "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx": [
    "compacto · Nenhuma proposta.",
  ],
  "src/app/(app)/configuracao/paises/PaisFormulario.tsx": [
    "compacto · Nenhum documento. Adicione ao menos um para poder ativar o país.",
  ],
  "src/app/(app)/configuracao/paises/PaisesPainel.tsx": [
    "bloco · Nenhum país cadastrado ainda.",
  ],
  "src/app/(app)/configuracao/turmas/TurmasPainel.tsx": [
    "bloco · Nenhuma turma cadastrada.",
  ],
  "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx": [
    "compacto · Nada simulado ainda. Em ensaio (shadow), cada 1º inbound registra aqui a saudação que teria sido env",
  ],
  "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx": [
    "bloco · Nenhum número cadastrado — o canal começa aqui.",
  ],
  "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx": [
    "compacto · Nada simulado ainda. Em ensaio, cada degrau devido registra aqui o que teria sido enviado.",
  ],
  "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx": [
    "bloco · Nenhum template — rode o seed ou crie o primeiro.",
  ],
  "src/app/(app)/diario/DiarioAulas.tsx": [
    "compacto · Nenhum aluno elegível na data selecionada.",
    "bloco · {mensagemVazio ?? \"Nenhuma aula registrada neste histórico.\"}",
  ],
  "src/app/(app)/diario/encontros/[id]/OcorrenciaParticular.tsx": [
    "compacto · Nenhum informe registrado.",
  ],
  "src/app/(app)/diario/encontros/[id]/correcao/CorrecaoAula.tsx": [
    "compacto · Esta proposta não registrou diferenças legíveis.",
    "compacto · Não há simulações disponíveis para esta proposta.",
  ],
  "src/app/(app)/diario/encontros/[id]/page.tsx": [
    "compacto · Nenhum aluno elegível identificado para esta chamada.",
  ],
  "src/app/(app)/diario/encontros/page.tsx": [
    "bloco · Nenhum encontro disponível.",
  ],
  "src/app/(app)/diario/excecoes-gravacao/page.tsx": [
    "bloco · Nenhuma solicitação encontrada.",
  ],
  "src/app/(app)/diario/pendencias/page.tsx": [
    "compacto · Nenhuma pendência de diário encontrada.",
  ],
  "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx": [
    "compacto · Não há propostas de regularização.",
  ],
  "src/app/(app)/diario/regularizacoes/GerirDesignacoes.tsx": [
    "compacto · Nenhuma designação registrada.",
  ],
  "src/app/(app)/diario/regularizacoes/page.tsx": [
    "compacto · {modo === \"HISTORICO\" ? \"Nenhuma designação encontrada no histórico.\" : \"Nenhuma regularização pende",
  ],
  "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx": [
    "compacto · Nenhuma reposição encontrada no escopo consultado.",
  ],
  "src/app/(app)/diario/reposicoes/[id]/troca-fonte/TrocaFonteReposicao.tsx": [
    "compacto · Nenhuma troca de fonte foi proposta para esta reposição.",
  ],
  "src/app/(app)/diario/reposicoes/page.tsx": [
    "bloco · Nenhuma reposição pendente para sua atuação.",
    "compacto · Nenhuma conclusão disponível para sua consulta.",
  ],
  "src/app/(app)/empresas/EmpresasCliente.tsx": [
    "bloco · {totalBase === 0 ? \"Nenhuma empresa ainda. Crie a primeira para registrar o responsável financeiro d",
  ],
  "src/app/(app)/empresas/[id]/FichaEmpresa.tsx": [
    "compacto · Nenhum contrato individual vinculado a esta empresa ainda.",
    "compacto · Nenhuma fatura histórica vinculada a esta empresa.",
  ],
  "src/app/(app)/financeiro/AcessoAulasPainel.tsx": [
    "compacto · Nenhuma restrição ou solicitação pendente.",
  ],
  "src/app/(app)/financeiro/FilaCobranca.tsx": [
    "bloco · Nada nesta visão.",
  ],
  "src/app/(app)/financeiro/FinanceiroPainel.tsx": [
    "linha · {vazio ?? \"Sem comissões.\"}",
    "bloco · Nenhum pedido pendente.",
    "bloco · Ainda não há descontos nem comissões registrados.",
    "compacto · Sem descontos.",
    "compacto · Sem comissões.",
    "compacto · Sem descontos por vendedor.",
    "compacto · Sem comissões.",
  ],
  "src/app/(app)/financeiro/InformesPagamento.tsx": [
    "compacto · Nenhum informe neste atendimento.",
  ],
  "src/app/(app)/financeiro/RetomadasPainel.tsx": [
    "compacto · Não há mensalidades remanescentes para alterar. A retomada ainda exige aprovação.",
    "compacto · Nenhuma proposta de retomada.",
  ],
  "src/app/(app)/financeiro/acertos-cobertura/ImpactosCoberturaFormulario.tsx": [
    "compacto · Nenhuma mensalidade existe nesta matrícula.",
  ],
  "src/app/(app)/financeiro/acertos-cobertura/page.tsx": [
    "compacto · Nenhum aditivo de cobertura foi encontrado nesta página.",
  ],
  "src/app/(app)/financeiro/acertos-taxa/page.tsx": [
    "compacto · Nenhum aditivo com condições de taxa nesta página.",
  ],
  "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx": [
    "bloco · Nenhuma proposta de acerto registrada.",
  ],
  "src/app/(app)/financeiro/continuidade/FilaContinuidadeMensal.tsx": [
    "bloco · Nenhuma matrícula precisa de acompanhamento nesta página.",
  ],
  "src/app/(app)/financeiro/desistencias/page.tsx": [
    "bloco · Nenhum pedido nesta página.",
  ],
  "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx": [
    "compacto · Nenhuma proposta registrada para esta linha.",
  ],
  "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx": [
    "compacto · Nenhuma proposta de obrigação registrada.",
  ],
  "src/app/(app)/financeiro/migracao/page.tsx": [
    "compacto · Nenhuma linha financeira nesta página.",
  ],
  "src/app/(app)/financeiro/permuta/page.tsx": [
    "bloco · Nenhum acordo nesta página.",
  ],
  "src/app/(app)/financeiro/recebimentos/RecebimentoDestinadoForm.tsx": [
    "bloco · Não há contratos disponíveis para recebimento.",
  ],
  "src/app/(app)/financeiro/recebimentos/page.tsx": [
    "compacto · Nenhum recebimento nesta página.",
  ],
  "src/app/(app)/home/HomeGerente.tsx": [
    "compacto · Sem vendedores.",
    "compacto · Sem vendedores ativos.",
  ],
  "src/app/(app)/home/HomeProfessor.tsx": [
    "compacto · Nenhuma experimental agendada.",
    "compacto · Você não tem turmas atribuídas.",
  ],
  "src/app/(app)/home/HomeVendedor.tsx": [
    "compacto · Sem experimentais hoje.",
  ],
  "src/app/(app)/inbox/AtendimentosPainel.tsx": [
    "compacto · A administração precisa disponibilizar um canal ativo para os atendimentos autorizados.",
    "compacto · Atendimento comercial sai pela sua linha comercial. Peça à administração para atribuir uma linha a v",
  ],
  "src/app/(app)/inbox/InboxCliente.tsx": [
    "bloco · {busca ? ( <>Nenhuma conversa para “{busca}”. <Link href={hrefInbox({ canal, c: thread?.conversaId }",
    "compacto · Nenhum.",
  ],
  "src/app/(app)/leads/LeadsLista.tsx": [
    "linha · {totalBase === 0 ? \"Nenhum lead na sua carteira.\" : filtrando ? ( <>Nenhum lead com esses filtros. <",
  ],
  "src/app/(app)/leads/[id]/FichaLead.tsx": [
    "compacto · Nenhum documento anexado.",
    "compacto · Sem transferências de dono.",
    "compacto · Sem eventos ainda.",
  ],
  "src/app/(app)/leads/[id]/contratacao/page.tsx": [
    "bloco · {c.podeCadastrarNovo ? \"Não há cadastro com o contato da negociação. Você poderá preencher os dados ",
  ],
  "src/app/(app)/matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario.tsx": [
    "compacto · Não há responsável pedagógico vinculado a esta matrícula.",
    "compacto · Nenhuma autorização registrada.",
  ],
  "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx": [
    "compacto · Nenhuma proposta de compensação para esta mensalidade.",
  ],
  "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/periodo-integral/PeriodoIntegral.tsx": [
    "compacto · Nenhuma proposta registrada para esta mensalidade.",
  ],
  "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx": [
    "compacto · Nenhuma versão registrada.",
  ],
  "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx": [
    "compacto · Nenhuma versão registrada.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario.tsx": [
    "compacto · Nenhuma cobrança de taxa disponível para conferência.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ImpactosTaxaFormulario.tsx": [
    "compacto · Nenhuma cobrança de taxa foi encontrada para esta matrícula.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/OriginaisPainel.tsx": [
    "compacto · Nenhum original nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ParticipantesFormulario.tsx": [
    "compacto · Nenhum documento disponível nesta página. Cadastre as evidências na documentação da matrícula antes ",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ParticipantesHistorico.tsx": [
    "compacto · Nenhuma conferência nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/alcadas/page.tsx": [
    "bloco · Não há alçadas adicionais disponíveis para esta proposta.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/originais/[artefatoId]/page.tsx": [
    "compacto · Nenhuma tentativa de envio foi iniciada.",
    "compacto · Nenhum registro nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx": [
    "compacto · Não há encontros particulares futuros disponíveis para esta matrícula.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/page.tsx": [
    "compacto · Nenhum modelo de aditivo aprovado está disponível nesta página.",
    "compacto · Nenhuma proposta nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/originais/[artefatoId]/page.tsx": [
    "compacto · Nenhuma conferência registrada.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/page.tsx": [
    "compacto · Nenhum modelo publicado disponível nesta página para o regime da matrícula.",
    "compacto · Nenhuma prévia registrada nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/previas/[previaId]/page.tsx": [
    "compacto · Ainda não há original preservado. A geração exige uma conferência atual dos participantes.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/previas/[previaId]/participantes/page.tsx": [
    "compacto · Nenhuma conferência registrada nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/substituicoes/Andamento.tsx": [
    "compacto · Nenhum retorno nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/contrato/substituicoes/page.tsx": [
    "compacto · Nenhuma conferência de outro original nesta página. Prepare e confira o documento substituto nos doc",
    "compacto · Nenhuma proposta nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/desistencia/administracao/page.tsx": [
    "compacto · Nenhum pedido de desistência registrado.",
  ],
  "src/app/(app)/matriculas/[id]/desistencia/documentos/page.tsx": [
    "compacto · Nenhum documento registrado nesta matrícula.",
    "compacto · Nenhum processo de assinatura registrado nesta matrícula.",
  ],
  "src/app/(app)/matriculas/[id]/desistencia/financeiro/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
    "bloco · Nenhuma memória contratual preparada.",
    "bloco · Nenhuma reconferência registrada.",
  ],
  "src/app/(app)/matriculas/[id]/desistencia/page.tsx": [
    "compacto · Nenhum pedido registrado.",
  ],
  "src/app/(app)/matriculas/[id]/disponibilidade-oferta/DisponibilidadeOferta.tsx": [
    "compacto · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/matriculas/[id]/emissao/page.tsx": [
    "compacto · Nenhum documento anexado. Confira os dados e documentos necessários antes de confirmar.",
  ],
  "src/app/(app)/matriculas/[id]/fechamentos-horas/page.tsx": [
    "bloco · Nenhum rascunho salvo nesta página.",
    "compacto · Nenhum encontro incluído para cobrança nesta versão.",
  ],
  "src/app/(app)/matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx": [
    "compacto · Nenhum relato registrado nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/indisponibilidade-oferta/[registroId]/termino/TerminoIndisponibilidadeOferta.tsx": [
    "compacto · Nenhuma proposta registrada nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/page.tsx": [
    "bloco · Nenhum encontro particular nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx": [
    "compacto · Nenhuma correção de presença pendente nesta matrícula.",
    "compacto · Nenhuma revisão financeira registrada.",
  ],
  "src/app/(app)/matriculas/[id]/pagador/page.tsx": [
    "compacto · Nenhum registro nesta página.",
  ],
  "src/app/(app)/matriculas/[id]/page.tsx": [
    "bloco · Nenhuma seção desta matrícula está disponível para a sua função.",
  ],
  "src/app/(app)/matriculas/[id]/reserva/page.tsx": [
    "compacto · Nenhuma turma nesta página.",
  ],
  "src/app/(app)/pipeline/KanbanBoard.tsx": [
    "compacto · Nenhum lead nesta etapa.",
  ],
  "src/app/(app)/secretaria/SecretariaPainel.tsx": [
    "compacto · Nenhuma matrícula no seu escopo.",
    "compacto · Nenhuma mensalidade registrada.",
  ],
  "src/app/(app)/secretaria/avisos-agenda/page.tsx": [
    "compacto · Nenhum aviso nesta página.",
    "compacto · Nenhuma pendência nesta página.",
  ],
  "src/app/(app)/secretaria/desistencias/page.tsx": [
    "bloco · Nenhum pedido pendente nesta página.",
  ],
  "src/app/(app)/secretaria/envios-portal/page.tsx": [
    "bloco · Nenhuma solicitação nesta página.",
  ],
  "src/app/(app)/secretaria/reservas/[id]/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/(app)/secretaria/reservas/page.tsx": [
    "bloco · Nenhuma reserva nesta consulta.",
  ],
  "src/app/(app)/secretaria/reservas/particulares/[id]/page.tsx": [
    "bloco · Nenhuma proposta registrada.",
  ],
  "src/app/portal-aluno/page.tsx": [
    "bloco · Não há reposições para este acesso.",
  ],
  "src/app/portal-aluno/resultados/page.tsx": [
    "bloco · Não há vínculo acadêmico com resultados disponíveis neste acesso.",
    "bloco · Não há alocação acadêmica disponível neste vínculo.",
    "compacto · Não há pendências operacionais identificadas nesta consulta.",
  ],
};
