import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #207 (C4 da R1 e C2 da R2): as ações que tomam `FOR UPDATE` numa transação interativa conferem o escopo NELA.
// Com o pool de UMA conexão, qualquer checagem que pedisse outra conexão ficaria esperando a da própria transação e
// cairia no pool_timeout. Este arquivo cria o cliente com connection_limit=1 (antes de importar o prisma).
const { authMock } = vi.hoisted(() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "3");
  process.env.DATABASE_URL = url.toString();
  (globalThis as { prisma?: unknown }).prisma = undefined;
  return { authMock: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { atribuirAtendimento, convidarParticipante, devolverParaFila, revogarParticipante, transferirAtendimento } from "./acoes-atendimento";
import { registrarNotaAtendimento } from "./acoes-conversa";
import { revisarFalhaEnvio } from "./operacoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const como = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "SECRETARIA"], finalidade: "AGENDA", donoId: null });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: v1.id }));
  return { v1, v2, gc, sec, a, numero, contato };
}

describe("ações do atendimento com pool de uma conexão", () => {
  it("o cliente deste arquivo tem uma conexão só", async () => {
    const [r] = await prisma.$queryRaw<{ n: number }[]>`SELECT 1::int AS n`;
    expect(r.n).toBe(1);
    expect(process.env.DATABASE_URL).toContain("connection_limit=1");
  });

  it("devolver para a fila", async () => {
    const { v1, a } = await cenario();
    como(v1);
    expect(await devolverParaFila(a.id)).toEqual({ ok: true });
  });

  it("atribuir (inclui a conferência de que o novo responsável enxerga)", async () => {
    const { gc, v2, a } = await cenario();
    como(gc);
    expect(await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).toEqual({ ok: true });
  });

  it("convidar e revogar participante", async () => {
    const { v1, sec, a } = await cenario();
    como(v1);
    const fim = new Date(Date.now() + 86_400_000).toISOString();
    const r = await convidarParticipante({ atendimentoId: a.id, usuarioId: sec.id, podeEnviar: true, fim, motivo: "Apoio da secretaria" });
    if (!r.ok) throw new Error(r.erro);
    expect(await revogarParticipante(r.dado!.participanteId)).toEqual({ ok: true });
  });

  it("transferir", async () => {
    const { v1, a } = await cenario();
    como(v1);
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "Dúvida sobre documentos da matrícula" });
    expect(r.ok).toBe(true);
  });

  it("registrar nota interna", async () => {
    const { v1, a } = await cenario();
    como(v1);
    expect(await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Ligar amanhã" })).toEqual({ ok: true });
  });

  it("revisar falha de envio com reenvio (confere o escopo na tx)", async () => {
    const { v1, a, numero, contato } = await cenario();
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    const i = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId: v1.id,
      corpoRenderizado: "Olá", status: "FALHOU", motivoFalha: "resultado_incerto", clientMessageId: "a-b-c-d-e-f-g" } });
    como(admin);
    const r = await revisarFalhaEnvio({ id: i.id, decisao: "REENVIAR_APOS_VERIFICACAO", evidencia: "conferido no aparelho" });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: i.id } })).toMatchObject({ status: "PENDENTE", clientMessageId: null });
  });
});
