import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
import {
  apresentarEstadoCancelamentoComFusos,
  carregarFusosDosEstados,
  normalizarInstanteLegadoUtc,
  type EstadoCancelamentoAgenda,
} from "./recuperacao-agenda-cancelamento-projecao";

const estado: EstadoCancelamentoAgenda = {
  reservaId: "reserva",
  matriculaId: "matricula",
  cancelamentoId: null,
  itens: [
    {
      id: "item-a",
      habilidade: "FALA",
      realizacaoId: null,
      encontroId: "encontro-correto",
      status: "PREVISTO",
      inicio: "2026-01-01T02:30:00",
      fim: "2026-01-01T03:30:00",
      professorId: "professor",
    },
    {
      id: "item-b",
      habilidade: "ESCRITA",
      realizacaoId: null,
      encontroId: "encontro-sem-proposta",
      status: "PREVISTO",
      inicio: "2026-01-01T04:30:00Z",
      fim: "2026-01-01T05:30:00Z",
      professorId: "professor",
    },
  ],
};

describe("projeção de cancelamento da agenda de recuperação", () => {
  it("normaliza apenas a leitura UTC sem Z e usa o encontro vinculado exato", () => {
    const apresentado = apresentarEstadoCancelamentoComFusos(
      estado,
      new Map([
        ["encontro-correto", "America/Sao_Paulo"],
        ["encontro-de-outra-origem", "Pacific/Kiritimati"],
      ]),
    );

    expect(apresentado.itens[0]).toMatchObject({
      encontroId: "encontro-correto",
      inicio: "2026-01-01T02:30:00Z",
      fim: "2026-01-01T03:30:00Z",
      fusoOrigem: "America/Sao_Paulo",
    });
    expect(apresentado.itens[1].fusoOrigem).toBeNull();
    expect(estado.itens[0]).not.toHaveProperty("fusoOrigem");
    expect(estado.itens[0].inicio).toBe("2026-01-01T02:30:00");
  });


  it("consulta só os encontros publicados ligados ao estado e preserva o hash bruto", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "encontro-correto", fusoOrigem: "Pacific/Kiritimati" }]);
    const tx = { encontroAgenda: { findMany } } as unknown as Pick<Prisma.TransactionClient, "encontroAgenda">;
    const hashOriginal = hashAgendaRecuperacao(estado);

    const fusos = await carregarFusosDosEstados(tx, [estado]);
    const apresentado = apresentarEstadoCancelamentoComFusos(estado, fusos);

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ["encontro-correto", "encontro-sem-proposta"] }, propostaAgendaRecuperacaoId: { not: null } },
      select: { id: true, fusoOrigem: true },
    });
    expect(apresentado.itens[0].fusoOrigem).toBe("Pacific/Kiritimati");
    expect(apresentado.itens[1].fusoOrigem).toBeNull();
    expect(hashAgendaRecuperacao(estado)).toBe(hashOriginal);
  });
  it("não altera ISO já explícito nem textos fora do formato legado", () => {
    expect(normalizarInstanteLegadoUtc("2026-01-01T02:30:00+00:00")).toBe("2026-01-01T02:30:00+00:00");
    expect(normalizarInstanteLegadoUtc("2026-01-01T02:30:00Z")).toBe("2026-01-01T02:30:00Z");
    expect(normalizarInstanteLegadoUtc("não é um instante")).toBe("não é um instante");
  });
});