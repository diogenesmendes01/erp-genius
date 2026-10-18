import { describe, expect, it } from "vitest";
import { ConfigAriaSchema, PREDEFINICOES, configPadrao, modoDaAcao, type ConfigAria } from "./config-schema";

describe("config-schema", () => {
it("padrao_valido", () => expect(ConfigAriaSchema.parse(configPadrao())).toBeTruthy());
it("instrucoes_acima_de_2500_rejeitadas", () => expect(ConfigAriaSchema.safeParse({ ...configPadrao(), instrucoes: "x".repeat(2501) }).success).toBe(false));
it("executa_menor_que_transfere_mais_5_rejeitado", () =>
  expect(ConfigAriaSchema.safeParse({ ...configPadrao(), confianca: { ...configPadrao().confianca, executaAPartirDe: 55, transfereAbaixoDe: 55 } }).success).toBe(false));
it("com_aprovacao_menor_que_sem_rejeitado", () => {
  const c = configPadrao(); c.politicas.MENSALIDADE = { descontoSemAprovacaoPct: 15, descontoComAprovacaoPct: 10 };
  expect(ConfigAriaSchema.safeParse(c).success).toBe(false);
});
it("tres_tons_rejeitado", () => expect(ConfigAriaSchema.safeParse({ ...configPadrao(), tons: ["AMIGAVEL", "FORMAL", "DIRETO"] }).success).toBe(false));
it("acao_fora_da_matriz_nao_faz", () => expect(modoDaAcao({ ...configPadrao(), matriz: {} }, "NOVO", "RESPONDER")).toBe("NAO_FAZ"));
it("handoff_sempre_permitido", () => expect(modoDaAcao({ ...configPadrao(), matriz: {} }, "NOVO", "HANDOFF")).toBe("SEMPRE"));
it("modo_vem_da_celula_da_etapa", () => {
  const c = { ...configPadrao(), matriz: { NOVO: { TAG: "SUGERE" } } } as ConfigAria;
  expect(modoDaAcao(c, "NOVO", "TAG")).toBe("SUGERE");
  expect(modoDaAcao(c, "QUALIFICADO", "TAG")).toBe("NAO_FAZ");
});
it("predefinicao_equilibrado", () => {
  expect(PREDEFINICOES.EQUILIBRADO.PROPOSTA?.CONDICAO_COMERCIAL).toBe("SUGERE");
  expect(PREDEFINICOES.EQUILIBRADO.NOVO?.CONDICAO_COMERCIAL).toBe("NAO_FAZ");
  expect(PREDEFINICOES.SUPERVISAO.NOVO?.RESPONDER).toBe("SUGERE");
  expect(PREDEFINICOES.AUTONOMO.NOVO?.RESPONDER).toBe("EXECUTA");
});
it("predefinicoes_conforme_tabela", () => {
  expect(PREDEFINICOES.AUTONOMO.NO_SHOW?.CONDICAO_COMERCIAL).toBe("NAO_FAZ");
  expect(PREDEFINICOES.AUTONOMO.PROPOSTA?.CONDICAO_COMERCIAL).toBe("EXECUTA");
  expect(PREDEFINICOES.EQUILIBRADO.AGUARDANDO_MATRICULA?.AGENDAR_MENSAGEM).toBe("EXECUTA");
  expect(PREDEFINICOES.EQUILIBRADO.NO_SHOW?.AGENDAR_MENSAGEM).toBe("SUGERE");
  expect(PREDEFINICOES.EQUILIBRADO.NO_SHOW?.TAG).toBe("EXECUTA");
  expect(PREDEFINICOES.SUPERVISAO.PROPOSTA?.CONDICAO_COMERCIAL).toBe("NAO_FAZ");
  for (const p of Object.values(PREDEFINICOES)) expect(ConfigAriaSchema.shape.matriz.safeParse(p).success).toBe(true);
});
});
