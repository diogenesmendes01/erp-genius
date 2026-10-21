import { describe, expect, it } from "vitest";
import { ateParaLigar, tentativaDepoisDo } from "./supervisao-tentativa";

const H = 3_600_000;
const agora = Date.UTC(2026, 9, 20, 12);

describe("tentativa da supervisão (#166, PR #267 C5)", () => {
  it("sem tentativa anterior, conta a partir de agora", () => {
    expect(ateParaLigar(null, 24, agora).getTime()).toBe(agora + 24 * H);
  });

  it("depois de incerto, a mesma opção reenvia o mesmo ate", () => {
    const ate = ateParaLigar(null, 24, agora);
    const guardada = tentativaDepoisDo({ tipo: "incerto", mensagem: "x" }, { horas: 24, ate });
    expect(guardada).toEqual({ horas: 24, ate });
    expect(ateParaLigar(guardada, 24, agora + 5 * 60_000)).toBe(ate);
  });

  it("depois de erro definitivo ou ok, o próximo clique conta de novo", () => {
    const ate = ateParaLigar(null, 24, agora);
    const tentativa = { horas: 24, ate };
    expect(tentativaDepoisDo({ tipo: "erro", mensagem: "Sem permissão." }, tentativa)).toBeNull();
    expect(tentativaDepoisDo({ tipo: "ok" }, tentativa)).toBeNull();
    const depois = agora + 3 * H;
    expect(ateParaLigar(tentativaDepoisDo({ tipo: "erro", mensagem: "x" }, tentativa), 24, depois).getTime()).toBe(depois + 24 * H);
  });

  it("clique ignorado (execução em curso) não mexe na tentativa", () => {
    const t = { horas: 24, ate: new Date(agora + 24 * H) };
    expect(tentativaDepoisDo(null, t)).toBe(t);
  });

  it("outra opção ou ate já vencido não reaproveita", () => {
    const t = { horas: 24, ate: new Date(agora + 24 * H) };
    expect(ateParaLigar(t, 168, agora).getTime()).toBe(agora + 168 * H);
    expect(ateParaLigar(t, 24, agora + 25 * H).getTime()).toBe(agora + 49 * H);
  });
});
