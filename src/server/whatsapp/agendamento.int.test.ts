import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { agendarMensagemNoAtendimento, agendarMensagemNoAtendimentoLocal, editarAgendamentoDoAtendimento } from "./acoes-conversa";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { transferirAtendimento } from "./acoes-atendimento";
import { despacharFila } from "./despachante";
import { diaUtilAs } from "@/test/janela-envio";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const emMinutos = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const util = (hora: number) => diaUtilAs(hora);

async function cenario() {
  const vend = await criarUsuario([Papel.VENDEDOR], "Vend");
  const fora = await criarUsuario([Papel.FINANCEIRO], "Fora");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "SECRETARIA"], donoId: vend.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: vend.id }));
  return { vend, fora, a, numero, contato };
}
type R = Awaited<ReturnType<typeof agendarMensagemNoAtendimento>>;
const idDe = (r: R) => { if (!r.ok) throw new Error(r.erro); return r.dado!.id; };
const status = async (r: R) => (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).status;

describe("agendar mensagem pelo atendimento", () => {
  it("não sai antes da hora e sai depois", async () => {
    const { vend, a, numero, contato } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete", quando: quando.toISOString() });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ atendimentoId: a.id, numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", autorId: vend.id });
    await despacharFila(new Date(quando.getTime() - 60_000));
    expect(await status(r)).toBe("PENDENTE");
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(await status(r)).not.toBe("PENDENTE");
    expect(["DESPACHADA", "SIMULADA"]).toContain(await status(r));
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } })).toBe(1);
  });

  it("horário digitado é convertido no servidor, no fuso informado; fuso inválido é recusado sem agendar", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const local = valorCampoLocal(quando, "America/Sao_Paulo");
    const r = await agendarMensagemNoAtendimentoLocal({ atendimentoId: a.id, texto: "Lembrete", quandoLocal: local, fuso: "America/Sao_Paulo" });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).agendadaPara?.toISOString()).toBe(new Date(Math.floor(quando.getTime() / 60_000) * 60_000).toISOString());
    expect(await agendarMensagemNoAtendimentoLocal({ atendimentoId: a.id, texto: "Outro", quandoLocal: local, fuso: "Lua/Base" })).toEqual({ ok: false, erro: expect.stringMatching(/fuso válido/) });
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
  });

  it("não sai depois de transferência", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: quando.toISOString() });
    const t = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "x".repeat(12) });
    expect(t.ok).toBe(true);
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_encerrado" });
  });

  it("recusa atendimento fora do escopo", async () => {
    const { fora, a } = await cenario();
    comoUsuario(fora);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(10).toISOString() })).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("reusa as validações da Fase 2: horário passado e opt-out", async () => {
    const { vend, a, contato } = await cenario();
    comoUsuario(vend);
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(-5) })).ok).toBe(false);
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(10).toISOString() })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("recusa o horário de silêncio da escola com mensagem clara (D12, #202 C4)", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(3).toISOString() })).toEqual({
      ok: false,
      erro: "Fora da janela de envio da escola: as mensagens saem das 9h às 20h, de segunda a sexta (horário de America/Sao_Paulo). Escolha outro horário.",
    });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});

describe("editar mensagem agendada pelo atendimento (D11)", () => {
  const FUSO = "America/Sao_Paulo";
  async function agendada() {
    const c = await cenario();
    comoUsuario(c.vend);
    const id = idDe(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Texto antigo", quando: util(10).toISOString() }));
    return { ...c, id };
  }
  const editar = (c: { a: { id: string }; id: string }, extra: Partial<{ texto: string; quando: Date; chaveIdempotencia: string }> = {}) =>
    editarAgendamentoDoAtendimento({ atendimentoId: c.a.id, intencaoId: c.id, texto: extra.texto ?? "Texto novo", quandoLocal: valorCampoLocal(extra.quando ?? util(15), FUSO), fuso: FUSO, chaveIdempotencia: extra.chaveIdempotencia });
  const editados = (atendimentoId: string) => prisma.evento.findMany({ where: { tipo: "MensagemAgendadaEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId } });

  it("edita texto e horário: Evento MensagemAgendadaEditada, sem o texto no payload; sai com o texto novo", async () => {
    const c = await agendada();
    const quando = util(15);
    expect(await editar(c, { quando })).toEqual({ ok: true, dado: { id: c.id } });
    const m = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } });
    expect(m).toMatchObject({ corpoRenderizado: "Texto novo", status: "PENDENTE" });
    expect(m.agendadaPara?.toISOString()).toBe(new Date(Math.floor(quando.getTime() / 60_000) * 60_000).toISOString());
    const [evento, ...resto] = await editados(c.a.id);
    expect(resto).toHaveLength(0);
    expect(evento).toMatchObject({ autorId: c.vend.id, payload: expect.objectContaining({ operacao: "EDITAR", intencaoId: c.id, textoAlterado: true }) });
    expect(JSON.stringify(evento!.payload)).not.toContain("Texto novo");
    await despacharFila(new Date(m.agendadaPara!.getTime() + 60_000));
    const enviada = await prisma.mensagemWhatsApp.findFirst({ where: { atendimentoId: c.a.id, direcao: "SAIDA" }, orderBy: { criadoEm: "desc" } });
    expect(enviada?.corpo).toBe("Texto novo");
  });

  it("já enviada: 'A mensagem já foi enviada.'", async () => {
    const c = await agendada();
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { status: "DESPACHADA" } });
    expect(await editar(c)).toEqual({ ok: false, erro: "A mensagem já foi enviada." });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto antigo");
    expect(await editados(c.a.id)).toHaveLength(0);
  });

  it("de outro autor (vendedor sem equipe): 'Mensagem não encontrada.'", async () => {
    const c = await agendada();
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { autorId: outro.id } });
    const r = await editar(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Mensagem não encontrada/);
    expect(await editados(c.a.id)).toHaveLength(0);
  });

  it("sem ter assumido a conversa recusa a edição", async () => {
    const c = await agendada();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { responsavelId: null } });
    const r = await editar(c);
    expect(r.ok).toBe(false);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto antigo");
  });

  it("mesma chave duas vezes: um Evento; mesma chave com outro texto é conflito", async () => {
    const c = await agendada();
    expect((await editar(c, { chaveIdempotencia: "editar-374" })).ok).toBe(true);
    expect((await editar(c, { chaveIdempotencia: "editar-374" })).ok).toBe(true);
    expect(await editados(c.a.id)).toHaveLength(1);
    const conflito = await editar(c, { chaveIdempotencia: "editar-374", texto: "Outro texto" });
    expect(conflito.ok).toBe(false);
    expect(await editados(c.a.id)).toHaveLength(1);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto novo");
  });

  it("texto vazio é recusado sem alterar", async () => {
    const c = await agendada();
    expect((await editar(c, { texto: "   " })).ok).toBe(false);
    expect(await editados(c.a.id)).toHaveLength(0);
  });
});
