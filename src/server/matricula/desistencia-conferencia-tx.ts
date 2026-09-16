import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";

/** Chamador autoriza Secretaria/Administração e bloqueia calendário e matrícula.
 * Esta conferência registra o pedido; nunca autoriza sua efetivação. */
export async function carregarConferenciaDesistenciaTx(tx: Prisma.TransactionClient, matriculaId: string) {
  const matricula = await tx.matricula.findUnique({ where: { id: matriculaId }, select: {
    id: true, codigo: true, alunoId: true, leadId: true, status: true, ativadaEm: true,
    contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
  } });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  const preparacao = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: {
    id: true, reservaId: true, reservaParticularId: true, regime: true, entradaHash: true,
  } });
  const reservasColetivas = await tx.reservaVagaMatricula.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, select: {
    id: true, turmaId: true, janelaId: true, status: true, expiraEm: true, entradaHash: true,
  } });
  const reservasParticulares = await tx.reservaAgendaParticular.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, select: {
    id: true, status: true, expiraEm: true, entradaHash: true,
    horarios: { orderBy: { id: "asc" }, select: { id: true, professorId: true, inicio: true, fim: true, fusoOrigem: true } },
    retomadaOrigem: { select: { id: true } }, retomadaDestino: { select: { id: true } },
  } });
  const processos = await tx.processoAssinaturaContratual.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, select: {
    id: true, estado: true, fornecedor: true, ambiente: true, referenciaExterna: true, artefatoId: true, conferenciaId: true, tentativaAtual: true,
    conclusao: { select: { id: true, entradaHash: true, concluidaEm: true } },
    tentativas: { orderBy: { numero: "asc" }, select: { id: true, numero: true, revisaoHash: true,
      observacoes: { orderBy: { id: "asc" }, select: { id: true, resultado: true, evidenciaHash: true } } } },
    intencaoCancelamento: { select: { id: true, propostaId: true, decisaoId: true,
      observacoes: { orderBy: { id: "asc" }, select: { id: true, resultado: true, evidenciaHash: true } } } },
  } });
  // Arquivo de contrato não comprova assinatura. É indício para conferência;
  // representar a fonte por hash, sem expor URL ou nome no resultado.
  const fontesDocumentais = await tx.documento.findMany({ where: { matriculaId }, orderBy: { id: "asc" },
    select: { id: true, nome: true, url: true, arquivado: true, criadoEm: true } });
  const documentos = fontesDocumentais.map(d => ({ id: d.id, arquivado: d.arquivado,
    fonteHash: createHash("sha256").update(JSON.stringify(d)).digest("hex") }));
  const condicoes = await tx.condicoesEntradaPreparacao.findMany({ where: { matriculaId }, orderBy: { versao: "asc" },
    select: { id: true, versao: true, entradaHash: true } });
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { matriculaId }, orderBy: { id: "asc" },
    select: { id: true, turmaId: true, ativa: true, criadoEm: true, encerradaEm: true } });
  const financeiro = await carregarFinanceiroDesistenciaTx(tx, matriculaId);
  const assinaturaIdentificada = matricula.contratoOk || !!matricula.confirmacaoContratoEm || processos.some(p => !!p.conclusao);
  const exigeConferenciaDocumental = assinaturaIdentificada || processos.length > 0 || documentos.length > 0 || !!matricula.contratoDocumentoId;
  const exigeAprovacaoAdministrativa = financeiro.resumo.haAvancoFormal || assinaturaIdentificada;
  const podeRegistrar = ["RASCUNHO", "AGUARDANDO"].includes(matricula.status) && !matricula.ativadaEm;
  const reservas = [...reservasColetivas.map(r => ({ id: r.id, tipo: "TURMA" as const, status: r.status })),
    ...reservasParticulares.map(r => ({ id: r.id, tipo: "PARTICULAR" as const, status: r.status }))];
  const pendencias = [
    ...(!podeRegistrar ? ["Esta matrícula não está em preparação; confira o fluxo de encerramento aplicável."] : []),
    ...(!preparacao ? ["Confira as condições e a origem da contratação legada."] : []),
    ...(financeiro.resumo.exigeConferenciaFinanceira ? ["Financeiro deve conferir cobranças, comprovantes, recebimentos, créditos e eventual acerto."] : []),
    ...(exigeConferenciaDocumental ? ["Confira assinaturas e documentos; uma solicitação aberta exige encerramento externo confirmado para a desistência."] : []),
    ...(exigeAprovacaoAdministrativa ? ["Os registros identificados exigem decisão de outra pessoa da Administração."] : []),
    ...(alocacoes.length ? ["Há vínculo acadêmico registrado; confira o histórico antes de efetivar a desistência."] : []),
    ...(reservas.some(r => r.status === "UTILIZADA") ? ["Há reserva utilizada; confira a situação operacional antes de qualquer efetivação."] : []),
  ];
  const snapshot = JSON.parse(JSON.stringify({ matriculaId, matricula, preparacao, reservasColetivas, reservasParticulares,
    processos, documentos, condicoes, alocacoes, financeiro: financeiro.snapshot })) as Prisma.InputJsonObject;
  const estadoHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { snapshot, estadoHash, resumo: {
    matriculaId, codigo: matricula.codigo, status: matricula.status, podeRegistrar,
    exigeAprovacaoAdministrativa, exigeConferenciaDocumental, financeiro: financeiro.resumo,
    reservas, quantidadeDocumentos: documentos.length, quantidadeAlocacoes: alocacoes.length, quantidadeProcessosAssinatura: processos.length, pendencias,
  } };
}
