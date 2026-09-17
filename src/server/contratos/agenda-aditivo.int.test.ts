import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "./conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { hashPrevia } from "./previa-estado";
import { z } from "zod";
import { carregarConferenciaAgendaAditivoTx, registrarPropostaAgendaAditivoTx } from "./agenda-aditivo-tx";
import { consultarConferenciaAgendaAditivo, consultarOpcoesConferenciaAgendaAditivo, consultarPropostaAgendaAditivo, listarMatriculasConferenciaAgendaAditivo } from "./agenda-aditivo";
import { carregarRevisaoAceite } from "./aceite-estado";
import { confirmarAceiteOriginalTx } from "./aceite-tx";
import { reservarHorasCompradasParaEncontro } from "@/server/matricula/reserva-horas-compradas";
import { criarAgendaParticularIsentaFixture } from "@/test/reposicao-agenda";
import { proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
import { prepararSubstituicaoDocente } from "@/server/agenda/substituicao";
import { decidirSubstituicaoDocente } from "@/server/agenda/substituicao-decisao";
import { prepararModeloTx } from "./modelos-tx";
import { decidirModeloContratual } from "./modelos";
import { prepararAditivoContratualTx, decidirAditivoContratualTx } from "./aditivo-tx";
import { decidirAlcadaAditivo } from "./aditivo-alcadas";
import { conferirParticipantesAditivoTx } from "./aditivo-participantes-tx";
import { preservarOriginalAditivo } from "./aditivo-originais";
import { consultarAssinaturaAditivo, registrarConferenciaAssinaturaAditivo } from "./aditivo-assinatura";
import { prepararProcessoAssinaturaAditivo } from "./aditivo-envio";
import { iniciarTentativaAditivoTx, registrarResultadoEnvioAditivoTx } from "./aditivo-envio-tx";
import { preservarConclusaoAssinaturaAditivoTx } from "./aditivo-conclusao-tx";
import { consultarConferenciaFinalAditivo, registrarConferenciaFinalAditivo } from "./aditivo-conferencia-final";
import { formalizarEAplicarCondicoesAditivo } from "./aditivo-condicoes";
import { criarAvisosAlteracaoAgendaTx, validarFonteAditivoAgendaTx } from "@/server/comunicacoes-agenda/avisos";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
let encontroId: string;
async function prepararBase(ambiente: "SANDBOX" | "PRODUCAO" = "PRODUCAO", confirmarAceite = true) {
  base = await prepararFixtureSubstituicaoContratual(authMock, { porHora: true, semSubstituicao: true, ambiente });
  const conclusao = await assinarFonte();
  if (confirmarAceite) { const revisao = await prisma.$transaction(tx => carregarRevisaoAceite(tx, base.matriculaId, conclusao.id)); await prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoId: conclusao.id, revisaoHash: revisao.revisaoHash, evidenciasConferidas: true, motivo: "Aceite original conferido", chaveIdempotencia: "aceite-q117" })); }
  await prisma.matricula.update({ where: { id: base.matriculaId }, data: { status: "ATIVA" } });
}
async function assinarFonte() {
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
  const participantes = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const agora = new Date().toISOString();
  return prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: base.referenciaExternaFonte, originalHash: processo.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(participantes.participantes[0].identidade), referenciaAssinatura: "assinatura-q117", assinadaEm: agora }] }));
}
const entrada = () => ({ matriculaId: base.matriculaId, encontros: [{ encontroId, professorNovoId: base.secretariaId, inicioNovo: "2099-10-12T15:00:00Z", fimNovo: "2099-10-12T16:00:00Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] });
async function criarEncontroBase() {
  encontroId = (await prisma.encontroAgenda.create({ data: { matriculaId: base.matriculaId, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Agenda contratada", chaveIdempotencia: "q117-encontro", entradaHash: "fixture" } })).id;
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "PROFESSOR"] } });
}
beforeEach(async () => {
  await truncarBanco(); await prepararBase();
  await criarEncontroBase();
});

it("fotografa contrato assinado e encontros particulares sem reservar ou aplicar", async () => {
  const antes = await Promise.all([prisma.encontroAgenda.count(), prisma.reservaAgendaParticular.count(), prisma.evento.count()]);
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r).toMatchObject({ somenteConsulta: true, proposta: { preparadorId: base.secretariaId, fonteContratualHash: expect.stringMatching(/^[a-f0-9]{64}$/), encontros: [{ encontroId, professorAnteriorId: base.secretariaId, professorNovoId: base.secretariaId }] } });
  expect(r.pendencias).toEqual([]); expect(await Promise.all([prisma.encontroAgenda.count(), prisma.reservaAgendaParticular.count(), prisma.evento.count()])).toEqual(antes);
});

it("persiste a fotografia idempotente sem alterar encontro e permite gestão pedagógica prepará-la", async () => {
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const antes = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true, inicio: true, fim: true, fusoOrigem: true } });
  const comando = { ...entrada(), chaveIdempotencia: "q117-fotografia-persistida" };
  const primeira = await prisma.$transaction(tx => registrarPropostaAgendaAditivoTx(tx, gestor.id, comando));
  const repetida = await prisma.$transaction(tx => registrarPropostaAgendaAditivoTx(tx, gestor.id, comando));
  expect(repetida.id).toBe(primeira.id);
  expect(await prisma.propostaAgendaAditivoParticular.findUniqueOrThrow({ where: { id: primeira.id }, select: { matriculaId: true, conclusaoFonteId: true, preparadorId: true, fotografiaHash: true, pendencias: true } })).toMatchObject({ matriculaId: base.matriculaId, preparadorId: gestor.id, fotografiaHash: primeira.fotografiaHash, pendencias: [] });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true, inicio: true, fim: true, fusoOrigem: true } })).toEqual(antes);
});

it("permite selecionar a fotografia íntegra na preparação contratual sem ampliar essa preparação à gestão", async () => {
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const proposta = await prisma.$transaction(tx => registrarPropostaAgendaAditivoTx(tx, gestor.id, { ...entrada(), chaveIdempotencia: "q117-selecao-fotografia" }));
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  expect(await consultarPropostaAgendaAditivo({ matriculaId: base.matriculaId, propostaAgendaId: proposta.id })).toMatchObject({ ok: true, dado: { id: proposta.id, texto: proposta.proposta.texto, encontros: [{ encontroId }], pendencias: [] } });
  expect(await consultarPropostaAgendaAditivo({ matriculaId: "outra-matricula", propostaAgendaId: proposta.id })).toMatchObject({ ok: false });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarPropostaAgendaAditivo({ matriculaId: base.matriculaId, propostaAgendaId: proposta.id })).toMatchObject({ ok: false });
});

it("autoriza secretaria, administração e gestão pedagógica pela consulta real", async () => {
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: true, dado: { somenteConsulta: true } });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: true, dado: { somenteConsulta: true } });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: false });
});

it("lista somente encontros elegíveis e matrículas particulares para os papéis da conferência", async () => {
  expect(await consultarOpcoesConferenciaAgendaAditivo({ matriculaId: base.matriculaId })).toMatchObject({ ok: true, dado: { matricula: { id: base.matriculaId }, encontros: expect.arrayContaining([expect.objectContaining({ id: encontroId, professor: expect.any(String) })]), professores: expect.arrayContaining([expect.objectContaining({ id: expect.any(String), nome: expect.any(String) })]) } });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await listarMatriculasConferenciaAgendaAditivo({ alunoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).alunoId })).toMatchObject({ ok: true, dado: [{ id: base.matriculaId }] });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarOpcoesConferenciaAgendaAditivo({ matriculaId: base.matriculaId })).toMatchObject({ ok: false });
});

it("expõe colisão entre novos horários selecionados sem excluir a matrícula inteira", async () => {
  const outro = await prisma.encontroAgenda.create({ data: { matriculaId: base.matriculaId, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-11T15:00:00Z"), fim: new Date("2099-10-11T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Agenda contratada", chaveIdempotencia: "q117-outro", entradaHash: "fixture" } });
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, { matriculaId: base.matriculaId, encontros: [entrada().encontros[0], { encontroId: outro.id, professorNovoId: base.secretariaId, inicioNovo: "2099-10-12T15:30:00Z", fimNovo: "2099-10-12T16:30:00Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] }));
  expect(r.pendencias).toContain("Os novos horários selecionados colidem entre si na mesma matrícula.");
});

it("rejeita sessão revogada", async () => {
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { ativo: false } });
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: false });
});

it("recusa fonte assinada em SANDBOX desde a criação", async () => {
  await truncarBanco(); await prepararBase("SANDBOX", false); await criarEncontroBase();
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada())))
    .rejects.toThrow("Confira a fonte assinada em produção e sua integridade antes da alteração de agenda.");
});

it("recusa fonte de produção sem aceite original confirmado", async () => {
  await truncarBanco(); await prepararBase("PRODUCAO", false); await criarEncontroBase();
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada())))
    .rejects.toThrow("O aceite conferido do contrato original é necessário antes da alteração de agenda.");
});

it("recusa encontro de outro contrato do mesmo aluno", async () => {
  const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } });
  const outraMatricula = await prisma.matricula.create({ data: { alunoId: atual.alunoId, produtoId: atual.produtoId, paisId: atual.paisId, moeda: atual.moeda, status: "ATIVA" } });
  const outroEncontro = await prisma.encontroAgenda.create({ data: { matriculaId: outraMatricula.id, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro contrato do aluno", chaveIdempotencia: "q117-outro-contrato", entradaHash: "fixture" } });
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, { ...entrada(), encontros: [{ ...entrada().encontros[0], encontroId: outroEncontro.id }] })))
    .rejects.toThrow("Há encontro fora da matrícula informada.");
});

it("recusa reposição individual já vinculada a encontro", async () => {
  const turma = await prisma.turma.findFirstOrThrow({ where: { professorId: { not: null } } });
  const aulaOriginal = await prisma.encontroAgenda.create({ data: { turmaId: turma.id, professorId: turma.professorId!, preparadorId: base.secretariaId, inicio: new Date("2026-09-10T15:00:00Z"), fim: new Date("2026-09-10T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula coletiva com falta", chaveIdempotencia: "q117-aula-original", entradaHash: "fixture", diario: { create: { turmaId: turma.id, professorId: turma.professorId!, ocorridaEm: new Date("2026-09-10T15:00:00Z"), conteudo: "Aula coletiva ministrada", registros: { create: { alunoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).alunoId, matriculaId: base.matriculaId, nomeAluno: "Aluno Original", presente: false, participacao: "FALTA" } } } } } });
  await prisma.encontroAgenda.update({ where: { id: aulaOriginal.id }, data: { status: "MINISTRADO" } });
  const pedido = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: aulaOriginal.id, matriculaId: base.matriculaId, modalidade: "PARTICULAR", solicitanteId: base.secretariaId, motivo: "Reposição individual autorizada", evidencia: "Falta registrada para reposição", chaveIdempotencia: "q117-reposicao", entradaHash: "fixture" } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: pedido.id, decisorId: base.adminId, aprovada: true, motivo: "Reposição individual aprovada" } });
  const reposicao = await criarAgendaParticularIsentaFixture({ reposicaoId: pedido.id, matriculaId: base.matriculaId, alunoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).alunoId, professorId: base.secretariaId, secretariaId: base.secretariaId, decisorId: base.adminId, inicio: new Date("2099-10-11T15:00:00Z"), fim: new Date("2099-10-11T16:00:00Z"), chave: "q117-reposicao-real" });
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, { ...entrada(), encontros: [{ ...entrada().encontros[0], encontroId: reposicao.encontroId }] })))
    .rejects.toThrow("A alteração exige encontro particular previsto, futuro e com professor definido.");
});

it("expõe reserva de horas legítima como pendência da alteração", async () => {
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } });
  const documento = await prisma.documento.findFirstOrThrow({ where: { matriculaId: base.matriculaId, categoria: "CONTRATO", arquivado: false } });
  const cobranca = await prisma.cobranca.create({ data: { matriculaId: base.matriculaId, tipo: "HORA_PARTICULAR", moeda: matricula.moeda, valorOriginal: 125, valorNegociado: 125, valorRecebido: 125, saldo: 0, status: "PAGO", vencimento: new Date("2099-09-01") } });
  const compra = await prisma.compraHorasAntecipadas.create({ data: { matriculaId: base.matriculaId, cobrancaId: cobranca.id, documentoId: documento.id, registradorId: base.secretariaId, minutosComprados: 60, valorOriginal: 125, descontoOriginal: 0, valorPagoAlocado: 125, moeda: matricula.moeda, evidenciaCondicoes: "Compra contratual conferida", snapshot: { fixture: "q117" }, chaveIdempotencia: "q117-compra-horas", entradaHash: "fixture" } });
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "PROFESSOR", "FINANCEIRO"] } });
  expect(await reservarHorasCompradasParaEncontro({ compraId: compra.id, encontroId, motivo: "Reserva paga e conferida para o encontro", chaveIdempotencia: "q117-reserva-horas" })).toMatchObject({ ok: true });
  const fotografiaReserva = () => prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: compra.id }, select: { id: true, minutosComprados: true, reservas: { select: { id: true, minutos: true, inicio: true, fim: true, encontro: { select: { id: true, status: true } }, consumo: { select: { id: true } } } } } });
  const antes = await fotografiaReserva();
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r.pendencias).toContain(`Há reserva de horas vinculada ao encontro ${encontroId}.`);
  expect(await fotografiaReserva()).toEqual(antes);
});

it("mantém encontro externo como conflito ao substituir somente os IDs selecionados", async () => {
  await prisma.encontroAgenda.create({ data: { matriculaId: base.matriculaId, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-12T15:30:00Z"), fim: new Date("2099-10-12T16:30:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro compromisso", chaveIdempotencia: "q117-conflito", entradaHash: "fixture" } });
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r.pendencias).toContain(`Há conflito operacional no novo horário de ${encontroId}.`);
});

it("expõe cancelamento pendente sem decidi-lo e retira a pendência após rejeição independente", async () => {
  const pedido = await proporCancelamentoParticular({ encontroId, motivo: "Cancelamento solicitado pela escola", chaveIdempotencia: "q117-cancelamento-pendente", origem: "ESCOLA" });
  expect(pedido.ok).toBe(true);
  if (!pedido.ok) throw new Error(pedido.erro);
  if (!pedido.dado) throw new Error("Proposta de cancelamento não retornada.");
  const eventosAntes = await prisma.evento.count();
  const conferir = () => prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect((await conferir()).pendencias).toContain(`Há cancelamento aguardando decisão para o encontro ${encontroId}.`);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { status: true } })).toEqual({ status: "PREVISTO" });
  expect(await prisma.decisaoCancelamentoParticular.count({ where: { propostaId: pedido.dado.id } })).toBe(0);
  expect(await prisma.evento.count()).toBe(eventosAntes);
  authMock.mockResolvedValue({ user: { id: base.adminId } });
  expect(await decidirCancelamentoParticular({ propostaId: pedido.dado.id, aprovar: false, motivo: "Cancelamento não será realizado" })).toMatchObject({ ok: true });
  expect((await conferir()).pendencias).not.toContain(`Há cancelamento aguardando decisão para o encontro ${encontroId}.`);
});

it("identifica conflito docente com aula coletiva fora da matrícula", async () => {
  const turma = await prisma.turma.findFirstOrThrow();
  await prisma.encontroAgenda.create({ data: { turmaId: turma.id, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-12T15:30:00Z"), fim: new Date("2099-10-12T16:30:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula coletiva do professor", chaveIdempotencia: "q117-conflito-coletivo", entradaHash: "fixture" } });
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r.pendencias).toContain(`Há conflito operacional no novo horário de ${encontroId}.`);
});

it("sinaliza substituição docente pendente sem aplicar e respeita sua rejeição", async () => {
  const substituto = await criarUsuario(["PROFESSOR"]);
  const pedido = await prepararSubstituicaoDocente({ encontrosIds: [encontroId], substitutoId: substituto.id, motivo: "Substituição em análise pedagógica", chaveIdempotencia: "q117-substituicao-pendente" });
  expect(pedido.ok).toBe(true);
  if (!pedido.ok || !pedido.dado) throw new Error("Proposta de substituição não criada.");
  const antes = await prisma.evento.count();
  const conferir = () => prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect((await conferir()).pendencias).toContain(`Há substituição docente aguardando decisão para o encontro ${encontroId}.`);
  expect(await prisma.evento.count()).toBe(antes);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true } })).toEqual({ professorId: base.secretariaId });
  authMock.mockResolvedValue({ user: { id: base.adminId } });
  expect(await decidirSubstituicaoDocente({ propostaId: pedido.dado.id, aprovar: false, motivo: "Manter o docente atual neste encontro" })).toMatchObject({ ok: true });
  expect((await conferir()).pendencias).not.toContain(`Há substituição docente aguardando decisão para o encontro ${encontroId}.`);
});

it("Q117 aplica a agenda particular somente junto das condições formalizadas, com revalidação após assinatura e replay idempotente", async () => {
  const fonte = await prisma.conclusaoAssinaturaContratual.findFirstOrThrow({ where: { processo: { id: base.processoId } } });
  const agenda = await prisma.$transaction(tx => registrarPropostaAgendaAditivoTx(tx, base.secretariaId, {
    ...entrada(), chaveIdempotencia: "q117-integral-fotografia",
  }));
  const modelo = await prisma.$transaction(tx => prepararModeloTx(tx, base.secretariaId, {
    codigo: "ADITIVO_AGENDA_Q117", versaoEsperada: 0, chaveIdempotencia: "q117-integral-modelo", motivo: "Modelo para aditivo de agenda particular",
    conteudo: { titulo: "Aditivo de agenda", finalidade: "ADITIVO", regimes: ["HORA_PARTICULAR"], aplicacao: "Alteração particular aprovada",
      campos: (["original", "anteriores", "alteracoes", "vigencia"] as const).map((chave, indice) => ({ chave, origem: (["ADITIVO_CONTRATO_ORIGINAL", "ADITIVO_ANTERIORES", "ADITIVO_ALTERACOES", "ADITIVO_VIGENCIA"] as const)[indice], descricao: chave })),
      secoes: [{ titulo: "Agenda", texto: "{{original}}\n{{anteriores}}\n{{alteracoes}}\n{{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] },
  }));
  const modeloHash = (await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modelo.id } })).conteudoHash;
  authMock.mockResolvedValue({ user: { id: base.adminId } });
  expect(await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modeloHash, aprovada: true, motivo: "Modelo conferido por administração independente" })).toMatchObject({ ok: true });

  const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, {
    matriculaId: base.matriculaId, conclusaoOriginalId: fonte.id, conclusaoHashEsperado: fonte.entradaHash, modeloId: modelo.id, modeloHashEsperado: modeloHash,
    vigenciaInicio: "2099-10-01T00:00:00Z", alteracoes: [{ origem: "AGENDA_PARTICULAR", novo: agenda.proposta.texto,
      valorEstruturado: { tipo: "AGENDA", propostaAgendaId: agenda.id, texto: agenda.proposta.texto } }],
    motivo: "Alterar encontro particular já fotografado", chaveIdempotencia: "q117-integral-proposta",
  }));
  await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Proposta administrativa conferida por outra pessoa" }));
  const pedagogo = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: pedagogo.id } });
  expect(await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada: "PEDAGOGICA", aprovada: true, motivo: "Agenda conferida pela gestão pedagógica independente" })).toMatchObject({ ok: true });

  const processoFonte = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
  const pessoa = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processoFonte.artefato.conferencia.snapshot).participantes[0]!;
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, {
    propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null,
    participantes: [{ papel: "ALUNO", identidade: pessoa.identidade }], identificacoesConferidas: true,
    motivo: "Signatário do aditivo conferido", chaveIdempotencia: "q117-integral-participantes",
  }));
  const original = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, motivo: "PDF do aditivo conferido e preservado", conteudoConferido: true });
  if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
  const alvo = { matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id };
  const revisaoAssinatura = await consultarAssinaturaAditivo(alvo);
  if (!revisaoAssinatura.ok || !revisaoAssinatura.dado?.revisao) throw new Error(JSON.stringify(revisaoAssinatura));
  const conferenciaAssinatura = await registrarConferenciaAssinaturaAditivo({ ...alvo, revisaoHash: revisaoAssinatura.dado.revisao.hash, dadosConferidos: true, motivo: "PDF e participantes revisados", chaveIdempotencia: "q117-integral-assinatura" });
  if (!conferenciaAssinatura.ok || !conferenciaAssinatura.dado) throw new Error(JSON.stringify(conferenciaAssinatura));
  const processoAditivo = await prepararProcessoAssinaturaAditivo({ ...alvo, conferenciaId: conferenciaAssinatura.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" });
  if (!processoAditivo.ok || !processoAditivo.dado) throw new Error(JSON.stringify(processoAditivo));
  const processoAditivoId = processoAditivo.dado.id;
  const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processoAditivoId }));
  await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processoAditivoId, tentativaId: tentativa.tentativaId, chave: "q117-integral-envio", resultado: "REGISTRADO", referenciaExterna: "q117-assinado", evidenciaHash: "a".repeat(64) }));
  const artefato = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: original.dado.id }, include: { conferencia: true } });
  const assinadoEm = new Date().toISOString();
  const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processoAditivoId, referenciaExterna: "q117-assinado", originalHash: artefato.pdfHash, concluidaEm: assinadoEm, pdfAssinado: Buffer.from("%PDF-Q117-agenda-assinado"), evidencias: Buffer.from("evidências simuladas Q117 agenda"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(pessoa.identidade), referenciaAssinatura: "q117-agenda-aluno", assinadaEm: assinadoEm }] }));

  const finalAlvo = { matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: conclusao.id };
  const revisaoFinal = await consultarConferenciaFinalAditivo(finalAlvo);
  if (!revisaoFinal.ok || !revisaoFinal.dado?.revisao) throw new Error(JSON.stringify(revisaoFinal));
  const confirmarFinal = { ...finalAlvo, revisaoHash: revisaoFinal.dado.revisao.hash, documentoConferido: true as const, evidenciasConferidas: true as const, motivo: "Assinatura e evidências finais conferidas" };
  expect(await registrarConferenciaFinalAditivo(confirmarFinal)).toMatchObject({ ok: true });

  const antes = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true, inicio: true, fim: true, fusoOrigem: true } });
  const cancelamento = await proporCancelamentoParticular({ encontroId, origem: "ESCOLA", motivo: "Pendência posterior à assinatura", chaveIdempotencia: "q117-integral-pendente" });
  if (!cancelamento.ok || !cancelamento.dado) throw new Error(JSON.stringify(cancelamento));
  const aplicar = () => formalizarEAplicarCondicoesAditivo({ ...finalAlvo, revisaoHash: confirmarFinal.revisaoHash, chaveIdempotencia: "q117-integral-aplicar" });
  expect(await aplicar()).toMatchObject({ ok: false, erro: expect.stringContaining("agenda mudou") });
  expect(await prisma.versaoCondicoesAditivo.count({ where: { propostaId: proposta.id } })).toBe(0);
  expect(await prisma.aplicacaoCondicoesAditivo.count({ where: { propostaId: proposta.id } })).toBe(0);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true, inicio: true, fim: true, fusoOrigem: true } })).toEqual(antes);

  authMock.mockResolvedValue({ user: { id: base.adminId } });
  expect(await decidirCancelamentoParticular({ propostaId: cancelamento.dado.id, aprovar: false, motivo: "Pendência rejeitada por decisão independente" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  const aplicado = await aplicar();
  if (!aplicado.ok) throw new Error(JSON.stringify(aplicado));
  expect(aplicado).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await aplicar()).toEqual(aplicado);
  expect(await prisma.versaoCondicoesAditivo.findUniqueOrThrow({ where: { propostaId: proposta.id } })).toMatchObject({ propostaAgendaId: agenda.id, versao: 1 });
  expect(await prisma.aplicacaoCondicoesAditivo.count({ where: { propostaId: proposta.id } })).toBe(1);
  expect(await prisma.aplicacaoAgendaAditivoParticular.count({ where: { propostaId: agenda.id } })).toBe(1);
  const eventoAplicado = await prisma.evento.findFirstOrThrow({ where: { tipo: "CondicoesAditivoAplicadas", agregadoId: base.matriculaId }, orderBy: { criadoEm: "desc" } });
  expect(eventoAplicado.payload).toMatchObject({ propostaAgendaId: agenda.id, aplicacaoAgendaId: expect.any(String), versao: 1 });
  expect(await prisma.aplicacaoAgendaAditivoParticular.findUniqueOrThrow({ where: { propostaId: agenda.id }, select: { eventoId: true } })).toEqual({ eventoId: eventoAplicado.id });
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } });
  const cloneExato = await prisma.evento.create({ data: { tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: base.matriculaId, autorId: base.secretariaId, payload: eventoAplicado.payload } });
  await expect(prisma.aplicacaoAgendaAditivoParticular.update({ where: { propostaId: agenda.id }, data: { eventoId: cloneExato.id } })).rejects.toThrow("Aplicação de agenda do aditivo é imutável");
  await expect(prisma.$transaction(tx => criarAvisosAlteracaoAgendaTx(tx, { eventoId: cloneExato.id, matriculaId: base.matriculaId, encontrosIds: [encontroId] }))).rejects.toThrow("Evento aplicado incompatível com o aviso.");
  await expect(prisma.$transaction(tx => validarFonteAditivoAgendaTx(tx, { eventoId: cloneExato.id, matriculaId: base.matriculaId, encontrosIds: [encontroId] }))).resolves.toBeNull();
  await expect(prisma.avisoAlteracaoAgenda.create({ data: { id: "q117-aviso-clone-exato", mudancaId: cloneExato.id, eventoId: cloneExato.id, matriculaId: base.matriculaId, alunoId: matricula.alunoId, canal: "EMAIL", contatoHash: "c".repeat(64), chave: "q117-aviso-clone-exato" } })).rejects.toThrow("Origem do aviso inválida");
  const forjado = await prisma.evento.create({ data: { tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: base.matriculaId, autorId: base.secretariaId, payload: { ...(eventoAplicado.payload as object), versao: 99, condicoesHash: "f".repeat(64) } } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: { id: "q117-aviso-forjado", mudancaId: forjado.id, eventoId: forjado.id, matriculaId: base.matriculaId, alunoId: matricula.alunoId, canal: "EMAIL", contatoHash: "a".repeat(64), chave: "q117-aviso-forjado" } })).rejects.toThrow("Origem do aviso inválida");
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/Sao_Paulo'");
    const aviso = await tx.avisoAlteracaoAgenda.create({ data: { id: "q117-aviso-fuso", mudancaId: eventoAplicado.id, eventoId: eventoAplicado.id, matriculaId: base.matriculaId, alunoId: matricula.alunoId, canal: "WHATSAPP", contatoHash: "b".repeat(64), chave: "q117-aviso-fuso", destinatarioAlunoId: matricula.alunoId } });
    await tx.itemAvisoAlteracaoAgenda.create({ data: { id: "q117-item-fuso", avisoId: aviso.id, encontroId } });
  });
  const cloneFiel = await prisma.evento.create({ data: { tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: base.matriculaId, autorId: base.secretariaId, payload: eventoAplicado.payload as object } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: { id: "q117-aviso-clone-fiel", mudancaId: cloneFiel.id, eventoId: cloneFiel.id, matriculaId: base.matriculaId, alunoId: matricula.alunoId, canal: "EMAIL", contatoHash: "c".repeat(64), chave: "q117-aviso-clone-fiel" } })).rejects.toThrow("Origem do aviso inválida");
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, select: { professorId: true, inicio: true, fim: true, fusoOrigem: true } })).toEqual({ professorId: base.secretariaId, inicio: new Date("2099-10-12T15:00:00.000Z"), fim: new Date("2099-10-12T16:00:00.000Z"), fusoOrigem: "UTC" });
});
