import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { carregarThread } from "./consultas-inbox";
import { listarOpcoesAtendimento, abrirAtendimentoInstitucional } from "./operacoes-atendimento";
import { enfileirarIntencaoCobranca, ErroCobrancaAlterada, type EnfileirarCobranca } from "./fila";
import { despacharFila } from "./despachante";
import { snapshotCobranca, referenciaDestinoCobranca } from "./elegibilidade";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); enviarMock.mockReset(); });
async function base() {
  const canal = await seedCanal();
  const c = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z"), responsavelTelefone: "+50680001111" });
  const usuario = await criarUsuario([Papel.ADMINISTRADOR]);
  authMock.mockResolvedValue({ user: { id: usuario.id } });
  const sessao = { id: usuario.id, nome: usuario.nome, papeis: usuario.papeis };
  async function pagador(matriculaId: string, versao: number, tipo: string, dados: Prisma.InputJsonObject) {
    return prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId, versao, tipo, dados, preparadorId: usuario.id,
      motivo: "Fonte contratual conferida na fixture", chaveIdempotencia: `${matriculaId}-${versao}`, entradaHash: `fixture-${matriculaId}-${versao}` } });
  }
  async function abrir(matriculaId: string) {
    const opcoes = await listarOpcoesAtendimento();
    const destino = opcoes.destinos.find((d) => d.matriculaId === matriculaId)!;
    return abrirAtendimentoInstitucional({ numeroId: canal.numero.id, destinoChave: destino?.chave ?? `FINANCEIRO:${matriculaId}` });
  }
  return { ...c, canal, usuario, sessao, pagador, abrir };
}
function entrada(c: Awaited<ReturnType<typeof base>>, contatoId: string, s: NonNullable<Awaited<ReturnType<typeof snapshotCobranca>>>): EnfileirarCobranca {
  return { cobrancaId: c.cobranca.id, referenciaCalendario: { versao: s.c.versao, vencimento: s.c.vencimento.toISOString(), cicloRegua: s.c.cicloRegua },
    referenciaDestino: referenciaDestinoCobranca(s.destino), passo: "D-7", numeroId: c.canal.numero.id, contatoId, origem: "CRON",
    corpoRenderizado: "Mensagem para o pagador conferido", variaveis: [], templateId: null, politicaId: c.canal.politica.id, autorId: null };
}

describe("pagador financeiro do contrato", () => {
  it("empresa e aluno têm destinos próprios mesmo existindo responsável global", async () => {
    const c = await base();
    const segunda = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
    const cobrancaB = await prisma.cobranca.create({ data: { matriculaId: segunda.id, tipo: "MENSALIDADE", valorOriginal: 20, valorNegociado: 20, moeda: "CRC", vencimento: c.cobranca.vencimento } });
    await c.pagador(c.matricula.id, 1, "EMPRESA", { nome: "Empresa A", telefoneE164: "+50680002222", paisId: c.pais.id });
    await c.pagador(segunda.id, 1, "ALUNO", { alunoId: c.aluno.id, nome: "Aluno", paisId: c.pais.id });
    expect((await snapshotCobranca(c.cobranca.id))?.destino).toMatchObject({ telefoneE164: "+50680002222", contatoAlunoId: null, responsavelId: null });
    expect((await snapshotCobranca(cobrancaB.id))?.destino).toMatchObject({ telefoneE164: c.aluno.telefoneE164, contatoAlunoId: c.aluno.id });
    const a = await c.abrir(c.matricula.id); const b = await c.abrir(segunda.id);
    expect(a.ok).toBe(true); expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("Abertura recusada");
    const ta = await carregarThread(c.sessao, a.dado!.id); const tb = await carregarThread(c.sessao, b.dado!.id);
    expect(ta?.podeEnviar).toBe(true); expect(tb?.podeEnviar).toBe(true);
    expect(ta?.cobrancaAtiva?.id).toBe(c.cobranca.id); expect(tb?.cobrancaAtiva?.id).toBe(cobrancaB.id);
    const contato = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { telefoneE164: "+50680002222" } });
    expect(contato.alunoId).toBeNull(); expect(contato.responsavelId).toBeNull();
  });

  it("pagador explícito sem telefone não cai no responsável ou aluno global", async () => {
    const c = await base();
    await c.pagador(c.matricula.id, 1, "EMPRESA", { nome: "Empresa sem telefone", paisId: c.pais.id });
    expect((await snapshotCobranca(c.cobranca.id))?.destino).toBeNull();
    expect((await c.abrir(c.matricula.id)).ok).toBe(false);
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
  });

  it("legado com mais de um contrato exige conferência do pagador", async () => {
    const c = await base();
    expect((await snapshotCobranca(c.cobranca.id))?.destino?.telefoneE164).toBe("+50680001111");
    await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
    expect((await snapshotCobranca(c.cobranca.id))?.destino).toBeNull();
    expect((await c.abrir(c.matricula.id)).ok).toBe(false);
  });

  it("recusa texto preparado antes de mudança do pagador, mesmo com o mesmo telefone", async () => {
    const c = await base();
    await c.pagador(c.matricula.id, 1, "EMPRESA", { nome: "Pagador anterior", telefoneE164: "+50680002222", paisId: c.pais.id });
    const r = await c.abrir(c.matricula.id); expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.erro);
    const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: r.dado!.id }, include: { conversa: true } });
    const antes = (await snapshotCobranca(c.cobranca.id))!;
    await c.pagador(c.matricula.id, 2, "EMPRESA", { nome: "Pagador novo", telefoneE164: "+50680002222", paisId: c.pais.id });
    await expect(prisma.$transaction((tx) => enfileirarIntencaoCobranca(tx, entrada(c, a.conversa.contatoId, antes)))).rejects.toBeInstanceOf(ErroCobrancaAlterada);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("revalida a versão do pagador no despacho de uma intenção já enfileirada", async () => {
    const c = await base();
    await c.pagador(c.matricula.id, 1, "EMPRESA", { nome: "Pagador anterior", telefoneE164: "+50680002222", paisId: c.pais.id });
    const r = await c.abrir(c.matricula.id); expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.erro);
    const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: r.dado!.id }, include: { conversa: true } });
    const antes = (await snapshotCobranca(c.cobranca.id))!;
    await prisma.$transaction((tx) => enfileirarIntencaoCobranca(tx, entrada(c, a.conversa.contatoId, antes)));
    await c.pagador(c.matricula.id, 2, "EMPRESA", { nome: "Nova versão", telefoneE164: "+50680002222", paisId: c.pais.id });
    await despacharFila();
    expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({ status: "CANCELADA", motivoFalha: "cobranca_alterada_revisar" });
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("telefone já conhecido não concede nem remove vínculos de outro contexto", async () => {
    const c = await base();
    const conhecido = await prisma.contatoWhatsApp.create({ data: { telefoneE164: c.aluno.telefoneE164!, alunoId: c.aluno.id } });
    await c.pagador(c.matricula.id, 1, "EMPRESA", { nome: "Empresa no telefone conferido", telefoneE164: conhecido.telefoneE164, paisId: c.pais.id });
    const r = await c.abrir(c.matricula.id); expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.erro);
    expect(await atendimentoVisivel(c.sessao, r.dado!.id, true)).not.toBeNull();
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: conhecido.id } })).alunoId).toBe(c.aluno.id);
    const outroContato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50680003333", alunoId: c.aluno.id } });
    const errado = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: c.canal.numero.id, contatoId: outroContato.id, finalidade: "FINANCEIRO", alunoId: c.aluno.id, matriculaId: c.matricula.id }));
    expect(await atendimentoVisivel(c.sessao, errado.id, true)).toBeNull();
    expect((await carregarThread(c.sessao, errado.id))?.cobrancaAtiva).toBeNull();
  });
});
