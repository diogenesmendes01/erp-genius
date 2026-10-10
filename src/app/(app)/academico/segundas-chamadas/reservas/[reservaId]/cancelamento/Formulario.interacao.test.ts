import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 6 (docs/42 L1786): a hora da ocorrência decide se o cancelamento é tempestivo, e o fuso é
// digitado à mão. Antes do envio, a tela mostra em que horário aquilo cai no fuso de exibição — e a prévia
// acompanha a troca do fuso. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/avaliacoes/segunda-chamada-cancelamento-local", () => ({ proporCancelamentoAgendaSegundaChamadaLocal: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-cancelamento", () => ({ decidirCancelamentoAgendaSegundaChamada: vi.fn() }));

import { Formulario } from "./Formulario";
import { CampoFuso } from "@/components/CampoFuso";
import { PreviaConversao, textoPreviaConversao } from "@/components/PreviaConversao";
import { criarGanchos, elementos, type No } from "@/test/tela-sem-dom";

beforeEach(() => { m.ganchos = criarGanchos(); });

const tela = (fusoExibicao?: string) => m.ganchos!.renderizar(Formulario, { reservaId: "r", estadoConferido: "e", fusoInstitucional: "America/Costa_Rica", fusoExibicao });
const achar = (tipo: unknown) => elementos(tela("America/Sao_Paulo")).find((n) => n.type === tipo);
const previa = () => {
  const p = achar(PreviaConversao) as No | undefined;
  return p ? textoPreviaConversao(String(p.props.local), String(p.props.fuso), String(p.props.fusoExibicao)) : undefined;
};
const digitarData = (valor: string) => {
  const campo = elementos(tela("America/Sao_Paulo")).find((n) => n.type === "input" && n.props.name === "dataHoraLocal")!;
  (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
};
const trocarFuso = (valor: string) => ((achar(CampoFuso) as No).props.onChange as (v: string) => void)(valor);

describe("Cancelamento de segunda chamada — prévia da conversão", () => {
  it("sem data digitada, nada a mostrar; com data em outro fuso, mostra o horário no fuso de exibição", () => {
    expect(previa()).toBeNull();
    digitarData("2026-09-22T11:00:00.000");
    expect(previa()).toBe("Isso será 22/09/2026, 14:00 em São Paulo (America/Sao_Paulo), o fuso em que a tela exibe os horários.");
  });

  it("a prévia muda com o fuso: trocar para Manaus muda o horário; voltar ao fuso de exibição a esconde", () => {
    digitarData("2026-09-22T11:00");
    trocarFuso("America/Manaus");
    expect(previa()).toContain("22/09/2026, 12:00 em São Paulo");
    trocarFuso("America/Sao_Paulo");
    expect(previa()).toBeNull();
  });

  it("o CampoFuso começa no fuso da escola e a página sem fuso de exibição não monta a prévia", () => {
    expect((achar(CampoFuso) as No).props.padrao).toBe("America/Costa_Rica");
    expect(elementos(tela()).some((n) => n.type === PreviaConversao)).toBe(false);
  });
});
