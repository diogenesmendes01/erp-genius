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
import { carregarConferenciaAgendaAditivoTx } from "./agenda-aditivo-tx";
import { consultarConferenciaAgendaAditivo } from "./agenda-aditivo";
import { carregarRevisaoAceite } from "./aceite-estado";
import { confirmarAceiteOriginalTx } from "./aceite-tx";
import { reservarHorasCompradasParaEncontro } from "@/server/matricula/reserva-horas-compradas";
import { criarAgendaParticularIsentaFixture } from "@/test/reposicao-agenda";

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

it("autoriza secretaria, administração e gestão pedagógica pela consulta real", async () => {
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: true, dado: { somenteConsulta: true } });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: true, dado: { somenteConsulta: true } });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarConferenciaAgendaAditivo(entrada())).toMatchObject({ ok: false });
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
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r.pendencias).toContain(`Há reserva de horas vinculada ao encontro ${encontroId}.`);
});

it("mantém encontro externo como conflito ao substituir somente os IDs selecionados", async () => {
  await prisma.encontroAgenda.create({ data: { matriculaId: base.matriculaId, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-12T15:30:00Z"), fim: new Date("2099-10-12T16:30:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro compromisso", chaveIdempotencia: "q117-conflito", entradaHash: "fixture" } });
  const r = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, base.secretariaId, entrada()));
  expect(r.pendencias).toContain(`Há conflito operacional no novo horário de ${encontroId}.`);
});
