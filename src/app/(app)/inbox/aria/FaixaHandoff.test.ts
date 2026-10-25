import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
import { FaixaHandoff } from "./FaixaHandoff";
const handoff: HandoffDoAtendimento = { acaoId: "h1", pedidoEm: "2026-10-25T11:56:00Z", motivo: "VALOR", motivoTexto: "Valor alto", destino: "FILA_SETOR", responsavelNome: null, resumo: { quer: "Quer 15% para 12 matrículas", proximoPasso: "Ligar hoje" }, feito: [], podeAssumir: true, ehResponsavel: false };
it("faixa_com_tempo_motivo_e_botao", () => { const h = renderToStaticMarkup(createElement(FaixaHandoff, { handoff, agora: new Date("2026-10-25T12:00:00Z"), aoVerResumo() { } })); for (const t of ["Aria pediu ajuda há 4 min", "Valor alto", "Ver resumo e assumir", "border-danger", "rounded-xl", "bg-red-50"])
    expect(h).toContain(t); });
it("sem_alcada_so_ver_resumo", () => { const h = renderToStaticMarkup(createElement(FaixaHandoff, { handoff: { ...handoff, podeAssumir: false }, agora: new Date("2026-10-25T12:00:00Z"), aoVerResumo() { } })); expect(h).toContain(">Ver resumo<"); expect(h).not.toContain("e assumir"); });
