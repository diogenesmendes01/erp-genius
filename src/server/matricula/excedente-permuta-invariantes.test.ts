import { describe, expect, it } from "vitest";

import {
  calcularExcedentePermuta,
  type EntradaExcedentePermuta,
  type OrigemLiquidacaoAcerto,
} from "./excedente-permuta-calculo";

const dinheiro = (valorEmCentavos: number) =>
  `${Math.floor(valorEmCentavos / 100)}.${String(valorEmCentavos % 100).padStart(2, "0")}`;

const centavos = (valor: string) => {
  const [inteiro, fracao = "00"] = valor.split(".");
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
};

const origem = (
  id: string,
  tipo: OrigemLiquidacaoAcerto["tipo"],
  valorEmCentavos: number,
): OrigemLiquidacaoAcerto => ({
  id,
  tipo,
  cobrancaId: "cobranca-matriz",
  versaoCobranca: 8,
  moeda: "CRC",
  valor: dinheiro(valorEmCentavos),
});

const entrada = (
  valorDevidoEmCentavos: number,
  origens: OrigemLiquidacaoAcerto[],
  distribuicao?: Array<{ origemId: string; valorEmCentavos: number }>,
): EntradaExcedentePermuta => ({
  cobrancaId: "cobranca-matriz",
  versaoCobranca: 8,
  moeda: "CRC",
  valorDevido: dinheiro(valorDevidoEmCentavos),
  origens,
  distribuicao: distribuicao?.map(({ origemId, valorEmCentavos }) => ({
    origemId,
    valor: dinheiro(valorEmCentavos),
  })),
});

describe("invariantes do excedente de permuta", () => {
  it("mantém o excedente de serviço dentro da redução e das fontes na matriz automática", () => {
    const valores = [0, 1, 2, 3, 5];

    for (const caixa of valores) {
      for (const credito of valores) {
        for (const permuta of valores) {
          for (const devido of valores) {
            const resultado = calcularExcedentePermuta(
              entrada(devido, [
                origem("caixa", "CAIXA", caixa),
                origem("credito", "CREDITO", credito),
                origem("permuta", "PERMUTA", permuta),
              ]),
            );
            const liquidado = caixa + credito + permuta;
            const reducao = Math.max(0, liquidado - devido);

            expect(centavos(resultado.totalLiquidado)).toBe(liquidado);
            expect(centavos(resultado.reducaoNecessaria)).toBe(reducao);
            expect(centavos(resultado.totalPermuta)).toBe(permuta);

            if (resultado.status === "DISTRIBUICAO_MISTA_PENDENTE") {
              const minimo = centavos(resultado.excedenteServicoMinimo);
              const maximo = centavos(resultado.excedenteServicoMaximo);

              expect(minimo).toBeGreaterThanOrEqual(0);
              expect(minimo).toBeLessThanOrEqual(maximo);
              expect(maximo).toBeLessThanOrEqual(reducao);
              expect(maximo).toBeLessThanOrEqual(permuta);
              expect(resultado.excedentesServico).toEqual([]);
              continue;
            }

            const excedenteServico = resultado.excedentesServico.reduce(
              (total, item) => total + centavos(item.valor),
              0,
            );
            expect(excedenteServico).toBeLessThanOrEqual(reducao);
            expect(excedenteServico).toBeLessThanOrEqual(permuta);
            expect(excedenteServico).toBeGreaterThanOrEqual(0);
            expect(resultado.excedentesServico.every((item) => item.aplicacaoPermutaId === "permuta")).toBe(true);

            if (resultado.status === "SEM_EXCEDENTE_SERVICO") {
              expect(excedenteServico).toBe(0);
            }
          }
        }
      }
    }
  });

  it("respeita cada fonte e fecha exatamente a redução na distribuição explícita", () => {
    const origens = [
      origem("caixa", "CAIXA", 2),
      origem("credito", "CREDITO", 1),
      origem("permuta-a", "PERMUTA", 3),
      origem("permuta-b", "PERMUTA", 4),
    ];
    const resultado = calcularExcedentePermuta(
      entrada(3, origens, [
        { origemId: "caixa", valorEmCentavos: 2 },
        { origemId: "credito", valorEmCentavos: 1 },
        { origemId: "permuta-a", valorEmCentavos: 2 },
        { origemId: "permuta-b", valorEmCentavos: 2 },
      ]),
    );

    expect(resultado.status).toBe("DISTRIBUICAO_EXPLICITA");
    if (!("distribuicao" in resultado)) throw new Error("Distribuição explícita ausente");
    expect(centavos(resultado.reducaoNecessaria)).toBe(7);
    expect(centavos(resultado.totalPermuta)).toBe(7);
    expect(resultado.distribuicao).toEqual([
      { origemId: "caixa", tipo: "CAIXA", valor: "0.02" },
      { origemId: "credito", tipo: "CREDITO", valor: "0.01" },
      { origemId: "permuta-a", tipo: "PERMUTA", valor: "0.02" },
      { origemId: "permuta-b", tipo: "PERMUTA", valor: "0.02" },
    ]);

    const porId = new Map(origens.map((item) => [item.id, centavos(String(item.valor))]));
    for (const item of resultado.distribuicao) {
      expect(centavos(item.valor)).toBeLessThanOrEqual(porId.get(item.origemId) ?? -1);
    }

    const excedenteServico = resultado.excedentesServico.reduce(
      (total, item) => total + centavos(item.valor),
      0,
    );
    expect(excedenteServico).toBe(4);
    expect(excedenteServico).toBeLessThanOrEqual(centavos(resultado.reducaoNecessaria));
    expect(excedenteServico).toBeLessThanOrEqual(centavos(resultado.totalPermuta));
  });

  it("não cria serviço quando a redução explícita fica inteiramente em caixa e crédito", () => {
    const resultado = calcularExcedentePermuta(
      entrada(5, [origem("caixa", "CAIXA", 3), origem("credito", "CREDITO", 2), origem("permuta", "PERMUTA", 5)], [
        { origemId: "caixa", valorEmCentavos: 3 },
        { origemId: "credito", valorEmCentavos: 2 },
      ]),
    );

    expect(resultado.status).toBe("SEM_EXCEDENTE_SERVICO");
    if (!("distribuicao" in resultado)) throw new Error("Distribuição explícita ausente");
    expect(resultado.excedentesServico).toEqual([]);
    expect(resultado.distribuicao).toEqual([
      { origemId: "caixa", tipo: "CAIXA", valor: "0.03" },
      { origemId: "credito", tipo: "CREDITO", valor: "0.02" },
    ]);
    expect(centavos(resultado.reducaoNecessaria)).toBe(5);
  });
});

