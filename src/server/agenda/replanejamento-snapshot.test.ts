import { expect, it } from "vitest";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";
import { estadoReplanejamento } from "./replanejamento-estado";
import type { z } from "zod";

function estado(snapshot: z.infer<typeof ReplanejamentoSnapshotSchema>) {
  return estadoReplanejamento({ ...snapshot, ajustes: [], revisoes: [], particulares: [],
    recursos: { internos: [], externos: [], indisponibilidades: [], reservas: [], semDocenteApto: [], reservasConferidas: false },
    aplicada: false, revisaoCompleta: false,
    ...(snapshot.recuperacoes ? { recuperacoes: snapshot.recuperacoes.map((e) => ({ ...e,
      inicio: new Date(e.inicio), fim: new Date(e.fim), professorId: null, periodosNaoLetivos: e.periodosNaoLetivos ?? [] })) } : { recuperacoes: undefined }),
  });
}

const original = { calendarioId: "calendario-original", conferidoEm: "2026-09-14T12:00:00.000Z", pendencias: [], revisoes: [], particulares: [],
  recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] } };
it("lê memória antiga sem acrescentar coleções ou mudar seu conteúdo", () => {
  expect(ReplanejamentoSnapshotSchema.parse(original)).toEqual(original);
  expect(ReplanejamentoSnapshotSchema.parse(original)).not.toHaveProperty("recuperacoes");
});
it("preserva recuperações no histórico e inclui seus horários na detecção de alterações", () => {
  const atual = { ...original, recuperacoes: [{ id: "recuperacao", inicio: "2026-10-01T12:00:00.000Z", fim: "2026-10-01T13:00:00.000Z" }] };
  expect(ReplanejamentoSnapshotSchema.parse(atual)).toEqual(atual);
  expect(estado(atual)).not.toBe(estado(original));
  expect(estado({ ...atual, recuperacoes: [{ ...atual.recuperacoes[0], fim: "2026-10-01T14:00:00.000Z" }] })).not.toBe(estado(atual));
  expect(estado({ ...atual, conferidoEm: "2026-09-14T12:01:00.000Z" })).toBe(estado(atual));
});
