import { describe, expect, it, vi } from "vitest";

vi.mock("./lancamento-tx", () => ({ bloquearLancamento: vi.fn().mockResolvedValue({}) }));
vi.mock("./regras-tx", () => ({ conferirGestorAvaliacao: vi.fn().mockResolvedValue(undefined) }));
const evento = vi.hoisted(() => vi.fn());
vi.mock("@/server/_shared", async (original) => ({ ...(await original<typeof import("@/server/_shared")>()), registrarEvento: evento }));
import { confirmarResolucaoImpedimentoSegundaChamadaTx } from "./segunda-chamada-resolucao-impedimento-tx";

const impedida = { id: "r1", status: "PENDENCIA_ESCOLA", matriculaId: "m", regraId: "regra", codigoAvaliacao: "FINAL", alocacaoId: "aloc", turmaId: "turma" };
const realizacao = (ajustes: Record<string, unknown> = {}) => ({ id: "z2", realizadaEm: new Date("2026-10-20T15:00:00Z"), lancamentosOriginais: [{ id: "nota" }],
  reserva: { id: "r2", matriculaId: "m", regraId: "regra", codigoAvaliacao: "FINAL", proposta: { alocacaoId: "aloc", turmaId: "turma" } }, ...ajustes });
const entrada = { reservaImpedidaId: "r1", realizacaoId: "z2", motivo: "Avaliação aplicada após o impedimento.", chaveIdempotencia: "chave-0001" };
function tx(opcoes: { reserva?: unknown; realizacao?: unknown; anterior?: unknown; ocorridaEm?: Date | null } = {}) {
  const create = vi.fn().mockResolvedValue({});
  return { create, cliente: {
    $queryRaw: vi.fn().mockResolvedValue(opcoes.reserva === null ? [] : [opcoes.reserva ?? impedida]),
    resolucaoImpedimentoSegundaChamada: { findUnique: vi.fn().mockResolvedValue(opcoes.anterior ?? null), create },
    realizacaoSegundaChamada: { findUnique: vi.fn().mockResolvedValue(opcoes.realizacao === undefined ? realizacao() : opcoes.realizacao) },
    ocorrenciaSegundaChamada: { findFirst: vi.fn().mockResolvedValue(opcoes.ocorridaEm === null ? null : { ocorridaEm: opcoes.ocorridaEm ?? new Date("2026-10-10T15:00:00Z") }) },
  } };
}

describe("confirmarResolucaoImpedimentoSegundaChamadaTx (Q164)", () => {
  it("registra a resolução e o evento com a nota oficial que a sustenta", async () => {
    const t = tx();
    await expect(confirmarResolucaoImpedimentoSegundaChamadaTx(t.cliente as never, "gestora", entrada)).resolves.toMatchObject({ nova: true });
    expect(t.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reservaImpedidaId: "r1", realizacaoId: "z2", confirmadaPorId: "gestora" }) });
    expect(evento).toHaveBeenCalledWith(t.cliente, expect.objectContaining({ tipo: "SegundaChamadaImpedimentoResolvido", payload: expect.objectContaining({ lancamentoOficialId: "nota" }) }));
  });

  it.each([
    ["reserva sem impedimento", { reserva: { ...impedida, status: "CONSUMIDA_FALTA" } }, /não possui impedimento/],
    ["a própria reserva impedida", { realizacao: realizacao({ reserva: { ...realizacao().reserva, id: "r1" } }) }, /mesma avaliação/],
    ["outra avaliação", { realizacao: realizacao({ reserva: { ...realizacao().reserva, codigoAvaliacao: "INTERMEDIARIA" } }) }, /mesma avaliação/],
    ["outro contrato", { realizacao: realizacao({ reserva: { ...realizacao().reserva, matriculaId: "outra" } }) }, /mesma avaliação/],
    ["outra turma", { realizacao: realizacao({ reserva: { ...realizacao().reserva, proposta: { alocacaoId: "aloc", turmaId: "outra" } } }) }, /mesma avaliação/],
    ["realização inexistente", { realizacao: null }, /mesma avaliação/],
    ["realização anterior ao impedimento", { ocorridaEm: new Date("2026-10-25T15:00:00Z") }, /posterior/],
    ["impedimento sem ocorrência", { ocorridaEm: null }, /posterior/],
    ["sem nota oficial", { realizacao: realizacao({ lancamentosOriginais: [] }) }, /nota oficial/],
  ])("recusa %s", async (_nome, opcoes, erro) => {
    const t = tx(opcoes);
    await expect(confirmarResolucaoImpedimentoSegundaChamadaTx(t.cliente as never, "gestora", entrada)).rejects.toThrow(erro);
    expect(t.create).not.toHaveBeenCalled();
  });

  it("é idempotente para a mesma confirmação e recusa uma segunda resolução", async () => {
    const igual = { id: "res", confirmadaPorId: "gestora", chaveIdempotencia: entrada.chaveIdempotencia, realizacaoId: "z2", motivo: entrada.motivo };
    await expect(confirmarResolucaoImpedimentoSegundaChamadaTx(tx({ anterior: igual }).cliente as never, "gestora", entrada)).resolves.toEqual({ id: "res", nova: false });
    await expect(confirmarResolucaoImpedimentoSegundaChamadaTx(tx({ anterior: igual }).cliente as never, "outra", entrada)).rejects.toThrow(/já possui resolução/);
  });
});
