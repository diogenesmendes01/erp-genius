import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), transacao: vi.fn(), conferir: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { reservaAgendaParticular: { findMany: mocks.listar }, $transaction: mocks.transacao } }));
vi.mock("./reserva-particular-cursor", () => ({ proximaReservaParticularVencida: mocks.listar }));
vi.mock("./reserva-particular-vencimento-tx", () => ({ conferirVencimentoParticularTx: mocks.conferir }));
import { rodarVencimentoParticulares } from "./reserva-particular-cron";
beforeEach(() => { vi.resetAllMocks(); mocks.transacao.mockImplementation((fn) => fn({})); });
it("continua o lote após falha sem informar liberação da reserva que falhou", async () => {
  mocks.listar.mockResolvedValueOnce({ id: "falha" }).mockResolvedValueOnce({ id: "expira" }).mockResolvedValueOnce({ id: "mantem" }).mockResolvedValueOnce({ id: "concorrente" }).mockResolvedValue(null);
  mocks.conferir.mockRejectedValueOnce(new Error("Falha interna"))
    .mockResolvedValueOnce({ resultado: "HORARIOS_LIBERADOS" })
    .mockResolvedValueOnce({ resultado: "PENDENCIA_REGISTRADA" })
    .mockResolvedValueOnce({ resultado: "SEM_TRANSICAO" });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await rodarVencimentoParticulares()).toEqual({ avaliadas: 4, expiradas: 1, mantidas: 1, semTransicao: 1, falhas: 1, loteCheio: false, limiteTempo: false });
    expect(mocks.conferir.mock.calls.map((c) => c[1])).toEqual(["falha", "expira", "mantem", "concorrente"]);
  } finally { log.mockRestore(); }
});
it("limita o tempo sem buscar outra reserva após o orçamento do lote", async () => {
  const relogio = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(15000);
  try {
    expect(await rodarVencimentoParticulares()).toMatchObject({ avaliadas: 0, limiteTempo: true });
    expect(mocks.listar).not.toHaveBeenCalled();
  } finally { relogio.mockRestore(); }
});
