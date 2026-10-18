import { describe, expect, it } from "vitest";
import { dividirEmTrechos, EXTENSOES_ACEITAS } from "./trechos";

describe("dividirEmTrechos", () => {
  it("trechos_respeitam_tamanho_e_sobreposicao", () => {
    const t = dividirEmTrechos("a".repeat(3000), 1200, 150);
    expect(t.map((x) => x.length)).toEqual([1200, 1200, 900]);
  });
  it("trechos_quebram_em_paragrafo_quando_possivel", () => expect(dividirEmTrechos("p1\n\np2", 4, 0)).toEqual(["p1", "p2"]));
  it("texto_vazio_sem_trechos", () => expect(dividirEmTrechos("   ")).toEqual([]));
  it("junta_paragrafos_ate_o_limite_e_normaliza_crlf", () => {
    expect(dividirEmTrechos("p1\r\n\r\np2\r\n\r\np3", 8, 0)).toEqual(["p1\n\np2", "p3"]);
  });
  it("sobreposicao_real_entre_janelas", () => {
    const t = dividirEmTrechos("0123456789", 6, 2);
    expect(t).toEqual(["012345", "456789"]);
  });
  it("sobreposicao_invalida_nao_trava", () => {
    expect(dividirEmTrechos("abcdefgh", 4, 10).length).toBeGreaterThan(0);
  });
  it("extensoes_aceitas", () => expect(EXTENSOES_ACEITAS).toEqual([".txt", ".md", ".csv", ".pdf"]));
});
