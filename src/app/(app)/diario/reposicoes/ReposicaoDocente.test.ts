import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ReposicaoDocente } from "./ReposicaoDocente";

const origem = { aulaOriginalId: "a", matriculaId: "m", participacao: "FALTA" as const, inicio: "2026-09-01T10:00:00.000Z", fim: "2026-09-01T11:00:00.000Z", fuso: "UTC", turma: null };
it("oferece diário da agenda particular atribuída e não conclui falta", () => {
  const previsto = renderToStaticMarkup(createElement(ReposicaoDocente, { reposicaoId: "r", versaoAnterior: 0, modalidade: "PARTICULAR", origem, entrega: null, encontros: [{ id: "e", inicio: "2026-09-02T10:00:00.000Z", fim: "2026-09-02T11:00:00.000Z", fuso: "UTC", status: "PREVISTO", participacao: null }] }));
  expect(previsto).toContain("Registrar diário da particular");
  const falta = renderToStaticMarkup(createElement(ReposicaoDocente, { reposicaoId: "r", versaoAnterior: 0, modalidade: "PARTICULAR", origem, entrega: null, encontros: [{ id: "e", inicio: "2026-09-02T10:00:00.000Z", fim: "2026-09-02T11:00:00.000Z", fuso: "UTC", status: "MINISTRADO", participacao: "FALTA" }] }));
  expect(falta).toContain("origem permanece sem regularização"); expect(falta).not.toContain("Confirmar reposição");
});
