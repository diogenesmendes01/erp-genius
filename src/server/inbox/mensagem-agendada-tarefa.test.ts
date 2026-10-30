import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
const { evento, janela } = vi.hoisted(() => ({ evento: vi.fn(async () => ({ id: "e" })), janela: vi.fn(async () => null as string | null) }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: evento }));
vi.mock("@/server/whatsapp/janela-agendamento", () => ({ recusaForaDaJanela: janela }));
import { Papel, type Prisma } from "@prisma/client";
import { cancelarMensagensAgendadasDaTarefaTx, decisaoCancelaMensagem, moverMensagensPendentesDaTarefaTx, MOTIVO_CANCELADA_COM_TAREFA } from "./mensagem-agendada-tarefa";

const quando = new Date("2026-10-29T13:00:00.000Z");
function linha(status: "PENDENTE" | "ADIADA" = "PENDENTE") {
  return {
    id: "m1",
    status,
    agendadaPara: quando,
    atendimentoId: "a1",
    autorId: "autor",
    origem: "HUMANO" as const,
    passo: null,
    passoComercial: null,
    atendimento: { status: "EM_ATENDIMENTO" as const, responsavelId: "autor" },
  };
}
function tx(atual: ReturnType<typeof linha> | null, count = 1) {
  return {
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
    usuario: { findUnique: vi.fn(async () => ({ id: "autor", papeis: [Papel.ADMINISTRADOR], ativo: true })) },
    intencaoMensagem: {
      findMany: vi.fn(async () => (atual ? [{ id: atual.id }] : [])),
      findFirst: vi.fn(async () => atual),
      updateMany: vi.fn(async () => ({ count })),
    },
  };
}
beforeEach(() => { evento.mockClear(); janela.mockReset(); janela.mockResolvedValue(null); });

it("omitir e cancelar cancelam a mensagem; só manter preserva", () => {
  expect(decisaoCancelaMensagem("cancelar")).toBe(true);
  expect(decisaoCancelaMensagem(undefined)).toBe(true);
  expect(decisaoCancelaMensagem("manter")).toBe(false);
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

it("move a PENDENTE para o novo instante e exige confirmação fora da janela", async () => {
  // 16:00Z precisa continuar no futuro: moverMensagensPendentesDaTarefaTx compara com Date.now().
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00.000Z"));
  try {
    const db = tx(linha());
    const novo = new Date("2026-10-30T16:00:00.000Z");
    janela.mockResolvedValueOnce("Fora da janela de envio da escola.");
    await expect(moverMensagensPendentesDaTarefaTx(db as unknown as Prisma.TransactionClient, "autor", "t1", novo)).rejects.toThrow("Confirme para mover a mensagem mesmo fora da janela");
    expect(db.intencaoMensagem.updateMany).not.toHaveBeenCalled();
    janela.mockResolvedValueOnce("Fora da janela de envio da escola.");
    await moverMensagensPendentesDaTarefaTx(db as unknown as Prisma.TransactionClient, "autor", "t1", novo, { aceitarForaDaJanela: true });
    expect(db.intencaoMensagem.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "m1", tarefaId: "t1", status: "PENDENTE", agendadaPara: quando },
      data: { agendadaPara: novo },
    });
    expect(evento).toHaveBeenCalledExactlyOnceWith(db, expect.objectContaining({ tipo: "MensagemReagendada", payload: expect.objectContaining({ operacao: "REAGENDAR", agendadaPara: novo.toISOString() }) }));
  } finally {
    vi.useRealTimers();
  }
});

it("o cancelamento da agendada não importa o cliente prisma global", () => {
  const src = readFileSync(new URL("./mensagem-agendada-tarefa.ts", import.meta.url), "utf8");
  expect(src).not.toMatch(/@\/lib\/prisma/);
});
