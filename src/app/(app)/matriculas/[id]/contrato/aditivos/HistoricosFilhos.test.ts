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

    const originais = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 1, paginaConferencias: 1, preferenciaFusoExibicao: "America/Costa_Rica" }));
    const participantes = renderToStaticMarkup(await ParticipantesHistorico({ matriculaId: "matricula", propostaId: "proposta", pagina: 1, paginaOriginais: 1, preferenciaFusoExibicao: "America/Costa_Rica" }));

    expect(originais).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(participantes).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [{ id: "original", autor: { nome: "Secretaria" }, criadoEm: new Date("2026-10-01T02:30:00Z"), paginas: 2, motivo: "Arquivo" }], temProxima: false } });

    const html = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 1, paginaConferencias: 1 }));

    expect(html).toContain("01/10/2026, 02:30 (UTC; origem UTC)");
  });

  // Os dois painéis estão na mesma tela ([propostaId]/page.tsx): a navegação de um preserva a página do
  // outro, inclusive o "Ir para a primeira página" do vazio (revisão R1 da #134, B2).
  it("página vazia: o texto de página e a volta ao início preservam a página do outro painel", async () => {
    const base = "/matriculas/matricula/contrato/aditivos/proposta";
    mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [], temProxima: false } });
    mocks.participantes.mockResolvedValue({ ok: true, dado: { registros: [], maisRegistros: false } });

    const originais = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 4, paginaConferencias: 3 }));
    expect(originais).toContain("Nenhum original nesta página.");
    expect(originais).toContain(`<a class="underline" href="${base}?paginaConferencias=3&amp;paginaOriginais=1">Ir para a primeira página</a>`);
    expect(originais).toContain(`href="${base}?paginaConferencias=3&amp;paginaOriginais=3">Originais anteriores</a>`);

    const participantes = renderToStaticMarkup(await ParticipantesHistorico({ matriculaId: "matricula", propostaId: "proposta", pagina: 3, paginaOriginais: 4 }));
    expect(participantes).toContain("Nenhuma conferência nesta página.");
    expect(participantes).toContain(`<a class="underline" href="${base}?paginaConferencias=1&amp;paginaOriginais=4">Ir para a primeira página</a>`);
    expect(participantes).toContain(`href="${base}?paginaConferencias=2&amp;paginaOriginais=4">Conferências anteriores</a>`);
  });

  it("primeira página vazia: o texto diz que não há registro, sem link de volta", async () => {
    mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [], temProxima: false } });
    mocks.participantes.mockResolvedValue({ ok: true, dado: { registros: [], maisRegistros: false } });
    const originais = renderToStaticMarkup(await OriginaisPainel({ matriculaId: "matricula", propostaId: "proposta", podeGerar: false, pagina: 1, paginaConferencias: 2 }));
    expect(originais).toContain("Nenhum original preservado para este aditivo.");
    expect(originais).not.toContain("nesta página");
    expect(originais).not.toContain("Ir para a primeira página");
    const participantes = renderToStaticMarkup(await ParticipantesHistorico({ matriculaId: "matricula", propostaId: "proposta", pagina: 1, paginaOriginais: 2 }));
    expect(participantes).toContain("Nenhuma conferência de signatários registrada para este aditivo.");
    expect(participantes).not.toContain("nesta página");
  });
});