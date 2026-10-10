import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 6 (docs/42 L1540, L1566, L1590): disponibilização, prorrogação e realização pedem data/hora
// local e o fuso; a recomendação pedia "exibir a conversão resultante abaixo do campo antes de enviar".
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/avaliacoes/recuperacao-operacao-local", () => ({ disponibilizarRecuperacaoLocal: vi.fn(), realizarRecuperacaoLocal: vi.fn() }));
vi.mock("@/server/avaliacoes/recuperacao-reserva", () => ({ reservarTentativaRecuperacao: vi.fn() }));
vi.mock("@/server/avaliacoes/recuperacao-cancelamento", () => ({ cancelarReservaRecuperacaoPelaEscola: vi.fn() }));

import { Horario } from "./Formularios";
import { CampoFuso } from "@/components/CampoFuso";
import { PreviaConversao, textoPreviaConversao } from "@/components/PreviaConversao";
import { criarGanchos, elementos, type No } from "@/test/tela-sem-dom";

beforeEach(() => { m.ganchos = criarGanchos(); });

const tela = () => m.ganchos!.renderizar(Horario, { fusoInstitucional: "America/Sao_Paulo", fusoExibicao: "UTC" });
const previa = () => {
  const p = elementos(tela()).find((n) => n.type === PreviaConversao);
  return p ? textoPreviaConversao(String(p.props.local), String(p.props.fuso), String(p.props.fusoExibicao)) : undefined;
};

describe("Horario das recuperações — prévia da conversão", () => {
  it("digitar a hora no fuso da escola mostra o equivalente no fuso de exibição; trocar o fuso muda a prévia", () => {
    const data = elementos(tela()).find((n) => n.type === "input" && n.props.name === "dataHora")!;
    (data.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "2026-09-22T14:00:00.000" } });
    expect(previa()).toBe("Isso será 22/09/2026, 17:00 em UTC, o fuso em que a tela exibe os horários.");
    ((elementos(tela()).find((n) => n.type === CampoFuso) as No).props.onChange as (v: string) => void)("America/Costa_Rica");
    expect(previa()).toContain("22/09/2026, 20:00 em UTC");
  });

  it("o fuso começa no da escola; sem fuso de exibição, não há prévia", () => {
    expect((elementos(tela()).find((n) => n.type === CampoFuso) as No).props.padrao).toBe("America/Sao_Paulo");
    expect(elementos(m.ganchos!.renderizar(Horario, { fusoInstitucional: null })).some((n) => n.type === PreviaConversao)).toBe(false);
  });
});
