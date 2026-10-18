import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { assinarInbox, iniciarEscuta, type AvisoInbox } from "@/server/inbox/barramento";
import { criarFiltroDeAvisos } from "@/server/inbox/eventos-sse";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { garantirAtendimento } from "./atendimentos";
import { convidarParticipante, revogarParticipante } from "./acoes-atendimento";

// Convite e revogação mudam o escopo (e o envio) de quem é convidado, mas só gravavam em
// ParticipanteAtendimentoWhatsApp, que não tem o trigger notificar_inbox: o convidado só via o compositor
// liberar ao reabrir. Agora a mesma transação toca o AtendimentoWhatsApp e o `atendimento.atualizado` sai.

beforeAll(async () => { await iniciarEscuta(process.env.DATABASE_URL!); });
beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
afterAll(() => prisma.$disconnect());

const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const sessao = (u: { id: string; papeis: Papel[] }) => ({ id: u.id, papeis: u.papeis, nome: "" }) as unknown as UsuarioSessao;
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const escutar = () => { const r: AvisoInbox[] = []; const sair = assinarInbox((x) => r.push(x)); return { r, sair }; };

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "FINANCEIRO"], donoId: v1.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: v1.id }));
  await pausa(300); // avisos da criação ficam fora da escuta de cada teste
  return { v1, fin, a };
}

describe("convite e revogação de participante avisam o SSE (atendimento.atualizado)", () => {
  it("convidar com envio dispara atendimento.atualizado, e o filtro do convidado deixa o aviso passar", async () => {
    const { v1, fin, a } = await cenario();
    const filtro = criarFiltroDeAvisos(sessao(fin));
    const { r, sair } = escutar();
    comoUsuario(v1);
    const res = await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: true, fim: emDias(2), motivo: "Dúvida sobre boleto" });
    expect(res.ok).toBe(true);
    const esperado: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId };
    await vi.waitFor(() => expect(r).toContainEqual(esperado), { timeout: 2000 });
    expect(await filtro(esperado)).toBe(true);
    sair();
  });

  it("revogar dispara atendimento.atualizado (o ex-convidado perde o envio sem reabrir)", async () => {
    const { v1, fin, a } = await cenario();
    comoUsuario(v1);
    const conv = await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: true, fim: emDias(2), motivo: "Dúvida sobre boleto" });
    if (!conv.ok) throw new Error(conv.erro);
    await pausa(300);
    const { r, sair } = escutar();
    expect((await revogarParticipante(conv.dado!.participanteId)).ok).toBe(true);
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
    sair();
  });

  it("convite recusado (rollback) não avisa", async () => {
    const { v1, a } = await cenario();
    const { r, sair } = escutar();
    comoUsuario(v1);
    const res = await convidarParticipante({ atendimentoId: a.id, usuarioId: v1.id, podeEnviar: true, fim: emDias(2), motivo: "Dúvida sobre boleto" });
    expect(res.ok).toBe(false);
    await pausa(500);
    expect(r.filter((x) => x.atendimentoId === a.id)).toEqual([]);
    sair();
  });
});
