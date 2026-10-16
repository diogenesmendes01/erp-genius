import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "./atendimentos";
import { alternarFavorita, alternarFixada, marcarLida, marcarNaoLida, silenciarConversa } from "./preferencias";
import { preferenciasDoUsuario } from "./preferencias-consulta";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR]);
  const v2 = await criarUsuario([Papel.VENDEDOR]);
  const fora = await criarUsuario([Papel.VENDEDOR]);
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", donoId: null } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: v1.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  // v2 também vê a conversa (participante), para provar que a preferência é por usuário.
  await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a.id, usuarioId: v2.id, concedenteId: v1.id, inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 600000), motivo: "Apoio" } });
  let n = 0;
  const chegaInbound = async (corpo: string, criadoEm = new Date(Date.now() + 5 + n++)) => prisma.mensagemWhatsApp.create({ data: {
    conversaId: a.conversaId, atendimentoId: a.id, numeroId: numero.id, direcao: "ENTRADA", corpo, driver: "BAILEYS", status: "ENTREGUE", providerMessageId: `p-${corpo}-${n}`, criadoEm } });
  return { v1, v2, fora, a, numero, chegaInbound };
}

describe("preferências pessoais da inbox (Task 8)", () => {
  it("fixar e não lida são de cada usuário", async () => {
    const { v1, v2, a } = await cenario();
    comoUsuario(v1); expect(await alternarFixada(a.id)).toMatchObject({ ok: true }); await marcarNaoLida(a.id);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)).toMatchObject({ fixada: true, naoLidas: 1 });
    expect((await preferenciasDoUsuario(v2.id, [a.id])).get(a.id)).toMatchObject({ fixada: false });
    comoUsuario(v1); await alternarFixada(a.id);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)).toMatchObject({ fixada: false });
  });
  it("não lidas pessoais = ENTRADA depois de lidaAte, ou 1 se marcada", async () => {
    const { v1, a, chegaInbound } = await cenario();
    comoUsuario(v1); await marcarLida(a.id);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.naoLidas).toBe(0);
    await chegaInbound("nova");
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.naoLidas).toBe(1);
    await marcarLida(a.id);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.naoLidas).toBe(0);
    await marcarNaoLida(a.id);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.naoLidas).toBe(1);
  });
  it("silenciar com data e reativar com null", async () => {
    const { v1, a } = await cenario();
    comoUsuario(v1);
    await silenciarConversa(a.id, new Date(Date.now() + 3600_000).toISOString());
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.silenciada).toBe(true);
    await silenciarConversa(a.id, new Date(Date.now() - 1000).toISOString());
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.silenciada).toBe(false);
    await silenciarConversa(a.id, new Date(Date.now() + 3600_000).toISOString());
    await silenciarConversa(a.id, null);
    expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.silenciada).toBe(false);
  });
  it("não grava preferência em conversa fora do escopo", async () => {
    const { fora, a } = await cenario();
    comoUsuario(fora);
    const esperado = { ok: false, erro: "Conversa não encontrada ou fora do seu escopo." };
    expect(await alternarFixada(a.id)).toEqual(esperado);
    expect(await silenciarConversa(a.id, null)).toEqual(esperado);
    expect(await marcarNaoLida(a.id)).toEqual(esperado);
    expect(await marcarLida(a.id)).toEqual(esperado);
    expect(await prisma.preferenciaConversaUsuario.count()).toBe(0);
  });
  it("favorito só em mensagem visível; alternar remove", async () => {
    const { v1, fora, a, chegaInbound } = await cenario();
    const m = await chegaInbound("guarde");
    comoUsuario(fora);
    expect(await alternarFavorita(m.id)).toEqual({ ok: false, erro: "Mensagem não encontrada ou fora do seu escopo." });
    expect(await prisma.favoritoMensagemUsuario.count()).toBe(0);
    comoUsuario(v1);
    expect(await alternarFavorita(m.id)).toMatchObject({ ok: true });
    expect(await prisma.favoritoMensagemUsuario.count({ where: { usuarioId: v1.id, mensagemId: m.id } })).toBe(1);
    await alternarFavorita(m.id);
    expect(await prisma.favoritoMensagemUsuario.count()).toBe(0);
    expect(a.id).toBeTruthy();
  });
});
