import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { notasDoAtendimento, registrarNotaAtendimento } from "./acoes-conversa";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const fin = await criarUsuario([Papel.VENDEDOR], "Vend");
  const fora = await criarUsuario([Papel.FINANCEIRO], "Fora");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], donoId: fin.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: fin.id }));
  return { fin, fora, a };
}

describe("nota interna do atendimento", () => {
  it("regra 20: nota interna nunca vira mensagem nem intenção", async () => {
    const { fin, a } = await cenario();
    comoUsuario(fin);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou" })).ok).toBe(true);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
    expect((await notasDoAtendimento(a.id))[0]).toMatchObject({ nota: "Cliente ligou", autorNome: fin.nome });
    const ev = await prisma.evento.findMany({ where: { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } });
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toEqual({ nota: "Cliente ligou" });
  });

  it("fora do escopo: recusa e não lista", async () => {
    const { fin, fora, a } = await cenario();
    comoUsuario(fin);
    await registrarNotaAtendimento({ atendimentoId: a.id, nota: "segredo" });
    comoUsuario(fora);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x" })).ok).toBe(false);
    expect(await notasDoAtendimento(a.id)).toEqual([]);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
  });

  it("nota vazia ou acima de 2000 caracteres é recusada", async () => {
    const { fin, a } = await cenario();
    comoUsuario(fin);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "" })).ok).toBe(false);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x".repeat(2001) })).ok).toBe(false);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x".repeat(2000) })).ok).toBe(true);
  });
});
