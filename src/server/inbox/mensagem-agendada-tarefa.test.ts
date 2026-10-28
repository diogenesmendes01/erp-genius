import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
const { evento } = vi.hoisted(() => ({ evento: vi.fn(async () => ({ id: "e" })) }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: evento }));
import { cancelarMensagensAgendadasDaTarefaTx, decisaoCancelaMensagem, MOTIVO_CANCELADA_COM_TAREFA } from "./mensagem-agendada-tarefa";
import type { Prisma } from "@prisma/client";

const quando = new Date("2026-10-29T13:00:00.000Z");
function linha(status: "PENDENTE" | "ADIADA" = "PENDENTE") {
  return { id: "m1", status, agendadaPara: quando, atendimentoId: "a1" };
}
function tx(atual: ReturnType<typeof linha> | null, count = 1) {
  return {
    $queryRaw: vi.fn(async () => []),
    intencaoMensagem: {
      findMany: vi.fn(async () => (atual ? [{ id: atual.id }] : [])),
      findFirst: vi.fn(async () => atual),
      updateMany: vi.fn(async () => ({ count })),
    },
  };
}
beforeEach(() => { evento.mockClear(); });

it("só cancelar mexe na mensagem; manter e omissão preservam", () => {
  expect(decisaoCancelaMensagem("cancelar")).toBe(true);
  expect(decisaoCancelaMensagem("manter")).toBe(false);
  expect(decisaoCancelaMensagem(undefined)).toBe(false);
});

it("cancela a ativa na tx, grava CANCELADA e o instante no evento", async () => {
  const db = tx(linha("ADIADA"));
  await cancelarMensagensAgendadasDaTarefaTx(db as unknown as Prisma.TransactionClient, "autor", "t1");
  expect(db.$queryRaw).toHaveBeenCalledOnce();
  expect(db.intencaoMensagem.updateMany).toHaveBeenCalledExactlyOnceWith({
    where: { id: "m1", tarefaId: "t1", status: "ADIADA", agendadaPara: quando },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELADA_COM_TAREFA },
  });
  expect(evento).toHaveBeenCalledExactlyOnceWith(db, expect.objectContaining({
    tipo: "MensagemAgendadaCancelada",
    agregadoTipo: "AtendimentoWhatsApp",
    agregadoId: "a1",
    autorId: "autor",
    payload: expect.objectContaining({
      contexto: "tarefa379",
      operacao: "CANCELAR",
      intencaoId: "m1",
      tarefaId: "t1",
      atendimentoId: "a1",
      canceladaEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }),
  }));
});

it("sem ativa ou já despachada não grava cancelamento", async () => {
  const db = tx(null);
  await cancelarMensagensAgendadasDaTarefaTx(db as unknown as Prisma.TransactionClient, "autor", "t1");
  expect(db.intencaoMensagem.updateMany).not.toHaveBeenCalled();
  expect(evento).not.toHaveBeenCalled();
});

it("corrida no update desfaz a decisão com erro de regra", async () => {
  const db = tx(linha(), 0);
  await expect(cancelarMensagensAgendadasDaTarefaTx(db as unknown as Prisma.TransactionClient, "autor", "t1")).rejects.toThrow("Recarregue a tarefa");
  expect(evento).not.toHaveBeenCalled();
});

it("o cancelamento da agendada não importa o cliente prisma global", () => {
  const src = readFileSync(new URL("./mensagem-agendada-tarefa.ts", import.meta.url), "utf8");
  expect(src).not.toMatch(/@\/lib\/prisma/);
});
