import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/matricula/indisponibilidade-oferta-confirmacao", () => ({ confirmarRelatoIndisponibilidadeOferta: vi.fn() }));
vi.mock("@/server/matricula/indisponibilidade-oferta-relato", () => ({ consultarRelatosIndisponibilidadeOferta: vi.fn(), registrarRelatoIndisponibilidadeOferta: vi.fn() }));

import { RelatosIndisponibilidadeOferta } from "./RelatosIndisponibilidadeOferta";

const relato = (id: string, confirmada: boolean | null) => ({
  id, inicio: "2026-10-01", fim: "2026-10-10", terminoAprovado: null, motivo: "Sem turma", evidenciaTexto: "Registro", criadaEm: "2026-10-01T12:00:00.000Z", podeConfirmar: false,
  confirmacao: confirmada === null ? null : { confirmada, confirmadaEm: "2026-10-02T12:00:00.000Z", motivo: "Conferido", evidenciaTexto: "Ata" },
});

describe("RelatosIndisponibilidadeOferta (Q157)", () => {
  it("só o relato confirmado leva à correção versionada do período", () => {
    const html = renderToStaticMarkup(createElement(RelatosIndisponibilidadeOferta, {
      matriculaId: "mat", fusoInstitucional: "UTC",
      dados: { pagina: 1, temProxima: false, podeRegistrar: false, relatos: [relato("conf", true), relato("recusado", false), relato("pendente", null)] },
    } as never));
    expect(html).toContain('href="/matriculas/mat/indisponibilidade-oferta/conf/correcao"');
    expect(html).not.toContain("recusado/correcao");
    expect(html).not.toContain("pendente/correcao");
  });
});
