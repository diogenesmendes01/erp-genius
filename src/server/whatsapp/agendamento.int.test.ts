import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { agendarMensagemNoAtendimento } from "./acoes-conversa";
import { transferirAtendimento } from "./acoes-atendimento";
import { despacharFila } from "./despachante";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const emMinutos = (n: number) => new Date(Date.now() + n * 60_000).toISOString();

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
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete", quando: emMinutos(10) });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ atendimentoId: a.id, numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", autorId: vend.id });
    await despacharFila(new Date());
    expect(await status(r)).toBe("PENDENTE");
    await despacharFila(new Date(Date.now() + 11 * 60_000));
    expect(await status(r)).not.toBe("PENDENTE");
    expect(["DESPACHADA", "SIMULADA"]).toContain(await status(r));
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } })).toBe(1);
  });

  it("não sai depois de transferência", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(1) });
    const t = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "x".repeat(12) });
    expect(t.ok).toBe(true);
    await despacharFila(new Date(Date.now() + 2 * 60_000));
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_encerrado" });
  });

  it("recusa atendimento fora do escopo", async () => {
    const { fora, a } = await cenario();
    comoUsuario(fora);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(5) })).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("reusa as validações da Fase 2: horário passado e opt-out", async () => {
    const { vend, a, contato } = await cenario();
    comoUsuario(vend);
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(-5) })).ok).toBe(false);
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(5) })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});
