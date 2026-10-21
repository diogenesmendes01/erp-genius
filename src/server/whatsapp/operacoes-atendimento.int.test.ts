import { DriverWhatsApp } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "./atendimentos";
import { revisarFalhaEnvio } from "./operacoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

async function falhaIncerta() {
  const admin = await criarUsuario([Papel.ADMINISTRADOR]);
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Institucional", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: null } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  const i = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId: admin.id,
    corpoRenderizado: "Olá", status: "FALHOU", motivoFalha: "resultado_incerto", clientMessageId: "a-b-c-d-e-f-g" } });
  authMock.mockResolvedValue({ user: { id: admin.id } });
  return i;
}

describe("revisarFalhaEnvio", () => {
  it("reenvio após verificação limpa o clientMessageId", async () => {
    const { id } = await falhaIncerta();
    const r = await revisarFalhaEnvio({ id, decisao: "REENVIAR_APOS_VERIFICACAO", evidencia: "conferido no aparelho" });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUnique({ where: { id } })).toMatchObject({ status: "PENDENTE", clientMessageId: null });
  });
});
