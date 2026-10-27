import { describe, expect, it } from "vitest";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "./mensagens";

describe("mensagens de resultado incerto", () => {
  it("instruem repetir a MESMA entrada, nunca revisar os dados", () => {
    for (const msg of [MSG_RESULTADO_INCERTO, MSG_DECISAO_INCERTA]) {
      expect(msg).toMatch(/mesm[ao]|sem alterar/);
      expect(msg).not.toMatch(/confira os dados/i);
    }
  });
});

describe("resultado incerto: uma instrução por evento (ganho rápido #20)", () => {
  it("a instrução sem chave nunca manda reenviar: conferir antes de repetir", () => {
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).toMatch(/recarregue/i);
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).toMatch(/antes de repetir/i);
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).not.toMatch(/reenvi|sem alterar|mesm[ao]/i);
  });
});
