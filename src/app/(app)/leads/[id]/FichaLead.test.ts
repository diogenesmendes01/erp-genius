import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ anexarDocumentoLead: vi.fn(), arquivarDocumentoLead: vi.fn(), moverEtapa: vi.fn(), registrarInteracao: vi.fn(), agendarExperimental: vi.fn(), enviarProposta: vi.fn(), marcarPerdido: vi.fn(), atualizarResumo: vi.fn(), atualizarDatas: vi.fn() }));

import { FichaLead } from "./FichaLead";

it("exibe instantes administrativos no fuso preferido sem converter datas de entrada", () => {
  const html = renderToStaticMarkup(createElement(FichaLead, {
    lead: { id: "lead", codigo: "L-1", nome: "Ana", telefoneE164: null, etapa: EtapaLead.NOVO, segmento: Segmento.ADULTO, temperatura: Temperatura.MORNO, b2b: false, criadoEm: "2026-01-01T02:30:00.000Z", pais: null, vendedor: null, origemCampanha: null, origemAnuncio: null, interesse: null, objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: null, proximoFollowUp: "2026-01-10", dataExperimental: "2026-01-02T10:30:00.000Z", dataProposta: "2026-01-11", motivoPerda: null, matricula: null, valorPrevisto: null, planoPrevisto: null, comissaoPrevista: null, documentos: [], professorExperimentalId: null },
    timeline: [{ id: "evento", tipo: "DatasAtualizadas", payload: { proximoFollowUp: "2026-01-10", dataExperimental: "2026-01-02", dataProposta: "2026-01-11" }, criadoEm: "2026-01-01T02:30:00.000Z", autor: { nome: "Secretaria" } }],
    professores: [], preferenciaFusoExibicao: "America/Costa_Rica",
  }));
  expect(html).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
  expect(html).toContain('value="2026-01-10"');
  expect(html).toContain('value="2026-01-11"');
});
