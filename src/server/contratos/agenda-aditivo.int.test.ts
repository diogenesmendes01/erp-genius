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

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
let encontroId: string;
async function assinarFonte() {
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
  const participantes = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const agora = new Date().toISOString();
  return prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: base.referenciaExternaFonte, originalHash: processo.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(participantes.participantes[0].identidade), referenciaAssinatura: "assinatura-q117", assinadaEm: agora }] }));
}
const entrada = () => ({ matriculaId: base.matriculaId, encontros: [{ encontroId, professorNovoId: base.secretariaId, inicioNovo: "2099-10-12T15:00:00Z", fimNovo: "2099-10-12T16:00:00Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] });
beforeEach(async () => {
  await truncarBanco(); base = await prepararFixtureSubstituicaoContratual(authMock, { porHora: true, semSubstituicao: true, ambiente: "PRODUCAO" });
  const conclusao = await assinarFonte();
  const revisao = await prisma.$transaction(tx => carregarRevisaoAceite(tx, base.matriculaId, conclusao.id));
  await prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoId: conclusao.id, revisaoHash: revisao.revisaoHash, evidenciasConferidas: true, motivo: "Aceite original conferido", chaveIdempotencia: "aceite-q117" }));
  await prisma.matricula.update({ where: { id: base.matriculaId }, data: { status: "ATIVA" } });
  encontroId = (await prisma.encontroAgenda.create({ data: { matriculaId: base.matriculaId, professorId: base.secretariaId, preparadorId: base.secretariaId, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Agenda contratada", chaveIdempotencia: "q117-encontro", entradaHash: "fixture" } })).id;
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "PROFESSOR"] } });
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
