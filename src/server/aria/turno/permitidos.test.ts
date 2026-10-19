import { describe, expect, it } from "vitest";
import { POLITICAS_PADRAO, permitidos } from "./executor";
import { valoresNaoAutorizados } from "./valores";

// C4 da R1 do #238: a guarda de valores com respostas liberadas fica sob o `npm test` (o CI não roda *.int.test.ts).
// C1 (decisão provisória): das respostas liberadas só os valores monetários entram; percentual e parcela
// continuam vindo só da política da Aria.
describe("permitidos com respostas rápidas liberadas", () => {
  const ctx = (...corpos: string[]) => ({ precos: [], respostasRapidas: corpos.map((corpo, i) => ({ atalho: `/r${i}`, corpo })) });
  const bloqueados = (texto: string, ...corpos: string[]) => valoresNaoAutorizados(texto, permitidos(ctx(...corpos), POLITICAS_PADRAO));

  it("preco_citado_em_resposta_liberada_passa", () => {
    expect(permitidos(ctx("O material custa ₡15.000."), POLITICAS_PADRAO).valores).toEqual([15000]);
    expect(bloqueados("O material custa ₡15.000.", "O material custa ₡15.000.")).toEqual([]);
  });

  it("percentual_so_da_resposta_liberada_continua_bloqueado", () => {
    expect(permitidos(ctx("Multa de 2% por atraso."), POLITICAS_PADRAO).percentuais).toEqual([10, 20, 10, 20]);
    expect(bloqueados("Te dou 2% de desconto.", "Multa de 2% por atraso.")).toEqual(["2%"]);
  });

  it("parcela_acima_de_parcelasMax_so_da_resposta_liberada_continua_bloqueada", () => {
    expect(permitidos(ctx("Pode pagar em 12x."), POLITICAS_PADRAO).parcelas).toEqual(Array.from({ length: POLITICAS_PADRAO.parcelasMax }, (_, i) => i + 1));
    expect(bloqueados("Dá para pagar em 12x.", "Pode pagar em 12x.")).toEqual(["12x"]);
    expect(bloqueados("Dá para pagar em 10x.", "Pode pagar em 12x.")).toEqual([]);
  });

  it("sem_respostas_so_a_politica", () => {
    expect(permitidos(ctx(), POLITICAS_PADRAO)).toEqual({
      valores: [],
      percentuais: [10, 20, 10, 20],
      parcelas: Array.from({ length: POLITICAS_PADRAO.parcelasMax }, (_, i) => i + 1),
    });
    expect(bloqueados("O material custa ₡15.000.")).toEqual(["₡15.000"]);
  });
});
