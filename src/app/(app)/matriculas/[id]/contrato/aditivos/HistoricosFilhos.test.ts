import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ originais: vi.fn(), participantes: vi.fn() }));
vi.mock("@/server/contratos/aditivo-originais", () => ({ consultarOriginaisAditivo: mocks.originais }));
vi.mock("@/server/contratos/aditivo-participantes", () => ({ consultarConferenciasParticipantesAditivo: mocks.participantes }));

import { OriginaisPainel } from "./OriginaisPainel";
import { ParticipantesHistorico } from "./ParticipantesHistorico";

describe("históricos filhos de aditivo", () => {
  it("formata originais e participantes no fuso informado", async () => {
    mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [{ id: "original", autor: { nome: "Secretaria" }, criadoEm: new Date("2026-10-01T02:30:00Z"), paginas: 2, motivo: "Arquivo" }], temProxima: false } });
    mocks.participantes.mockResolvedValue({ ok: true, dado: { registros: [{ id: "conferencia", versao: 1, autor: "Secretaria", criadaEm: new Date("2026-10-01T03:30:00Z"), motivo: "Participantes", maioridade: null, participantes: [] }], maisRegistros: false } });

    const originais = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 1, preferenciaFusoExibicao: "America/Costa_Rica" }));
    const participantes = renderToStaticMarkup(await ParticipantesHistorico({ matriculaId: "matricula", propostaId: "proposta", pagina: 1, preferenciaFusoExibicao: "America/Costa_Rica" }));

    expect(originais).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(participantes).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [{ id: "original", autor: { nome: "Secretaria" }, criadoEm: new Date("2026-10-01T02:30:00Z"), paginas: 2, motivo: "Arquivo" }], temProxima: false } });

    const html = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 1 }));

    expect(html).toContain("01/10/2026, 02:30 (UTC; origem UTC)");
  });
});
