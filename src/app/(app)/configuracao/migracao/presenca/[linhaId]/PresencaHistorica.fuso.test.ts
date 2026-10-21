import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/presenca-historica", () => ({ proporPresencaHistoricaMigracao: vi.fn(), decidirPresencaHistoricaMigracao: vi.fn(), resolverDivergenciaPresencaHistoricaMigracao: vi.fn() }));

import { PresencaHistorica, horarioDaAula, instanteDoRegistro } from "./PresencaHistorica";

// Lote 2 do fuso pessoal: a tela fixava UTC. O horário da aula é publicado na agenda da escola (fuso da escola);
// a resolução da divergência é instante de registro (fuso pessoal; sem preferência, o da escola). Expectativas fixas
// em TZ=UTC e America/Sao_Paulo.
describe("PresencaHistorica: horário da aula no fuso da escola, registro no fuso pessoal", () => {
  it("helpers: aula ignora a preferência; registro a segue; sem fuso da escola, UTC rotulado", () => {
    const fusos = { preferenciaFusoExibicao: "Asia/Tokyo", fusoEscola: "America/Sao_Paulo" };
    expect(horarioDaAula("2026-03-10T22:00:00.000Z", fusos)).toBe("10/03/2026, 19:00 (America/Sao_Paulo)");
    expect(instanteDoRegistro("2026-03-10T22:00:00.000Z", fusos)).toBe("11/03/2026, 07:00 (Asia/Tokyo)");
    expect(instanteDoRegistro("2026-03-10T22:00:00.000Z", { fusoEscola: "America/Sao_Paulo" })).toBe("10/03/2026, 19:00 (America/Sao_Paulo)");
    expect(horarioDaAula("2026-03-10T22:00:00.000Z")).toBe("10/03/2026, 22:00 (UTC)");
  });

  it("na tela: aula elegível e aula da proposta no fuso da escola; resolução no fuso pessoal", () => {
    const proposta = {
      id: "p1", status: "APLICADA", participacao: "PRESENTE", evidencia: null, snapshot: null, motivoDecisao: "ok", preparadorId: "u0", preparadorNome: "Sec",
      decisorNome: "Ges", aplicacaoId: "ap1", resultado: "DIVERGENCIA", registroExistenteId: "r1", resolucaoId: "res1", resultadoResolucao: "MANTIDO",
      resolvedorNome: "Ges", resolvidaEm: "2026-03-12T01:30:00.000Z", ocorridaEm: "2026-03-10T22:00:00.000Z", conteudo: "Unidade 1", turma: "T1", alunoNome: "Ana", matriculaId: "m1",
    };
    const html = renderToStaticMarkup(createElement(PresencaHistorica, {
      linhaId: "l1", aulas: [{ id: "a1", ocorridaEm: "2026-03-10T22:00:00.000Z", conteudo: "Unidade 1", turma: "T1" }], propostas: [proposta],
      podePropor: true, podeDecidir: false, atorId: "u1", preferenciaFusoExibicao: "Asia/Tokyo", fusoEscola: "America/Sao_Paulo",
    }));
    expect(html).toContain("10/03/2026, 19:00 (America/Sao_Paulo) · T1 · Unidade 1");
    expect(html).toContain("10/03/2026, 19:00 (America/Sao_Paulo) · Unidade 1");
    expect(html).toContain("em 12/03/2026, 10:30 (Asia/Tokyo)");
    expect(html).not.toContain(" UTC");
  });
});
