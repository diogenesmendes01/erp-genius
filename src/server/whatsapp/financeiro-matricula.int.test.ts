import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { atendimentoDoInbound, garantirAtendimento } from "./atendimentos";
import { carregarThread, listarConversas } from "./consultas-inbox";
import { listarOpcoesAtendimento, abrirAtendimentoInstitucional } from "./operacoes-atendimento";
import { enfileirarIntencaoCobranca } from "./fila";
import { referenciaDestinoCobranca, snapshotCobranca } from "./elegibilidade";
import { despacharFila } from "./despachante";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); enviarMock.mockReset(); });
async function preparar() {
  const canal = await seedCanal();
  const original = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
  const outra = await prisma.matricula.create({ data: { alunoId: original.aluno.id, produtoId: original.matricula.produtoId, paisId: original.pais.id, moeda: "CRC" } });
  const anterior = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", valorOriginal: 123, valorNegociado: 123, moeda: "CRC", vencimento: new Date("2026-09-10T12:00:00Z") } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: original.aluno.telefoneE164!, alunoId: original.aluno.id } });
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  for (const matriculaId of [original.matricula.id, outra.id]) await prisma.pagadorPreparacaoMatricula.create({ data: {
    matriculaId, preparadorId: financeiro.id, versao: 1, tipo: "ALUNO", dados: { alunoId: original.aluno.id },
    motivo: "Pagador aluno identificado para o contrato", chaveIdempotencia: `pagador-aluno-${matriculaId}`, entradaHash: `pagador-aluno-${matriculaId}`,
  } });
  const sessao = { id: financeiro.id, nome: financeiro.nome, papeis: financeiro.papeis };
  const abrir = (matriculaId: string) => prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: canal.numero.id, contatoId: contato.id, finalidade: "FINANCEIRO", alunoId: original.aluno.id, matriculaId }));
  return { canal, ...original, outra, anterior, contato, financeiro, sessao, abrir };
}

describe("WhatsApp financeiro por matrícula", () => {
  it("separa assuntos, mensagens e cobranças de dois contratos da mesma pessoa", async () => {
    const c = await preparar();
    const a = await c.abrir(c.matricula.id); const b = await c.abrir(c.outra.id);
    expect(a.id).not.toBe(b.id); expect(a.conversaId).toBe(b.conversaId);
    expect((await c.abrir(c.matricula.id)).id).toBe(a.id);
    await prisma.mensagemWhatsApp.createMany({ data: [
      { numeroId: c.canal.numero.id, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "Contrato A" },
      { numeroId: c.canal.numero.id, conversaId: b.conversaId, atendimentoId: b.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "Contrato B" },
    ] });
    const ta = await carregarThread(c.sessao, a.id); const tb = await carregarThread(c.sessao, b.id);
    expect(ta?.matricula?.id).toBe(c.matricula.id);
    expect(ta?.cobrancaAtiva?.id).toBe(c.cobranca.id);
    expect(tb?.cobrancaAtiva?.id).toBe(c.anterior.id);
    expect(ta?.mensagens.map((m) => m.corpo)).toEqual(["Contrato A"]);
    expect(tb?.mensagens.map((m) => m.corpo)).toEqual(["Contrato B"]);
    const lista = await listarConversas(c.sessao);
    expect(new Set(lista.map((x) => x.vinculo)).size).toBe(2);
    const vendedor = await criarUsuario([Papel.VENDEDOR]);
    expect(await carregarThread({ id: vendedor.id, nome: vendedor.nome, papeis: vendedor.papeis }, a.id)).toBeNull();
  });

  it("oferece e abre cada matrícula explicitamente, sem aceitar chave antiga por aluno", async () => {
    const c = await preparar(); authMock.mockResolvedValue({ user: { id: c.financeiro.id } });
    const opcoes = await listarOpcoesAtendimento();
    const destinos = opcoes.destinos.filter((d) => d.finalidade === "FINANCEIRO");
    expect(destinos.map((d) => d.matriculaId).sort()).toEqual([c.matricula.id, c.outra.id].sort());
    expect(new Set(destinos.map((d) => d.nome)).size).toBe(2);
    for (const d of destinos) {
      const resultado = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: d.chave });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) throw new Error("Falha de abertura");
      const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: resultado.dado!.id } });
      expect(a.matriculaId).toBe(d.matriculaId);
    }
    expect((await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: `FINANCEIRO:${c.aluno.id}` })).ok).toBe(false);
  });

  it("não procura dívida em outro contrato quando a matrícula escolhida não tem cobrança pendente", async () => {
    const c = await preparar();
    const semDivida = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
    await prisma.pagadorPreparacaoMatricula.create({ data: {
      matriculaId: semDivida.id, preparadorId: c.financeiro.id, versao: 1, tipo: "ALUNO", dados: { alunoId: c.aluno.id },
      motivo: "Pagador aluno identificado para o contrato", chaveIdempotencia: `pagador-aluno-${semDivida.id}`, entradaHash: `pagador-aluno-${semDivida.id}`,
    } });
    const a = await c.abrir(semDivida.id);
    const thread = await carregarThread(c.sessao, a.id);
    expect(thread?.matricula?.id).toBe(semDivida.id);
    expect(thread?.cobrancaAtiva).toBeNull();
  });

  it("mantém o roteamento automático quando há uma única matrícula inequívoca", async () => {
    const canal = await seedCanal();
    const c = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: c.aluno.telefoneE164!, alunoId: c.aluno.id } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: canal.numero.id, contatoId: contato.id } });
    const id = await prisma.$transaction((tx) => atendimentoDoInbound(tx, conversa.id));
    expect(id).not.toBeNull();
    const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: id! } });
    expect(a.matriculaId).toBe(c.matricula.id);
  });

  it("recusa matrícula ausente, de outro aluno e troca do contexto já registrado", async () => {
    const c = await preparar();
    const outro = await prisma.aluno.create({ data: { primeiroNome: "Outra pessoa", paisId: c.pais.id } });
    const estrangeira = await prisma.matricula.create({ data: { alunoId: outro.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
    await expect(c.abrir(estrangeira.id)).rejects.toThrow();
    await expect(prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: c.canal.numero.id, contatoId: c.contato.id, finalidade: "FINANCEIRO", alunoId: c.aluno.id }))).rejects.toThrow();
    const a = await c.abrir(c.matricula.id);
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { matriculaId: c.outra.id } })).rejects.toThrow();
    await expect(prisma.atendimentoWhatsApp.create({ data: { conversaId: a.conversaId, contextoChave: "sem-matricula", finalidade: "FINANCEIRO", alunoId: c.aluno.id } })).rejects.toThrow();
    await expect(prisma.atendimentoWhatsApp.create({ data: { conversaId: a.conversaId, contextoChave: "matricula-divergente", finalidade: "FINANCEIRO", alunoId: c.aluno.id, matriculaId: estrangeira.id } })).rejects.toThrow();
    await expect(prisma.matricula.update({ where: { id: c.matricula.id }, data: { alunoId: outro.id } })).rejects.toThrow();
  });

  it("não adivinha contrato no inbound sem atendimento ou com dois assuntos abertos", async () => {
    const c = await preparar();
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: c.canal.numero.id, contatoId: c.contato.id } });
    expect(await prisma.$transaction((tx) => atendimentoDoInbound(tx, conversa.id))).toBeNull();
    await c.abrir(c.matricula.id); await c.abrir(c.outra.id);
    expect(await prisma.$transaction((tx) => atendimentoDoInbound(tx, conversa.id))).toBeNull();
  });

  it("o enfileiramento guarda a matrícula da cobrança e o despacho recusa combinação cruzada", async () => {
    const c = await preparar();
    for (const cobranca of [c.cobranca, c.anterior]) {
      const snapshot = await snapshotCobranca(cobranca.id); if (!snapshot?.destino) throw new Error("Destino ausente na fixture.");
      await prisma.$transaction((tx) => enfileirarIntencaoCobranca(tx, {
        cobrancaId: cobranca.id, referenciaCalendario: { versao: cobranca.versao, cicloRegua: cobranca.cicloRegua, vencimento: cobranca.vencimento.toISOString() },
        passo: "D-7", numeroId: c.canal.numero.id, contatoId: c.contato.id, origem: "CRON", corpoRenderizado: "Cobrança do contrato", variaveis: [], templateId: null, politicaId: c.canal.politica.id, autorId: null,
        referenciaDestino: referenciaDestinoCobranca(snapshot.destino),
      }));
    }
    const intencoes = await prisma.intencaoMensagem.findMany({ include: { atendimento: true } });
    expect(intencoes.find((i) => i.cobrancaId === c.cobranca.id)?.atendimento?.matriculaId).toBe(c.matricula.id);
    expect(intencoes.find((i) => i.cobrancaId === c.anterior.id)?.atendimento?.matriculaId).toBe(c.outra.id);
    const original = intencoes.find((i) => i.cobrancaId === c.cobranca.id)!;
    const cruzado = intencoes.find((i) => i.cobrancaId === c.anterior.id)!;
    await prisma.intencaoMensagem.update({ where: { id: original.id }, data: { atendimentoId: cruzado.atendimentoId } });
    await despacharFila(new Date(), { intencaoId: original.id });
    const resultado = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: original.id } });
    expect(resultado).toMatchObject({ status: "CANCELADA", motivoFalha: "contrato_atendimento_divergente" });
    expect(enviarMock).not.toHaveBeenCalled();
  });
});
