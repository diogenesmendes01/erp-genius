import { describe, expect, it } from "vitest";
import { configPadrao, type ConfigAria } from "../config-schema";
import { gatilhoDeHandoff } from "./gatilhos";
import type { SaidaModelo } from "./tipos";

const ok: SaidaModelo = {
  resposta: "Olá",
  documentoId: null,
  acoes: [],
  confianca: 90,
  handoff: null,
  fontes: [],
  humor: "NEUTRO",
};
const base = {
  saida: ok as SaidaModelo | null,
  recusa: false,
  ultimaFala: "quero saber os horários",
  etapa: null as Parameters<typeof gatilhoDeHandoff>[0]["etapa"],
  valorPrevisto: null as number | null,
  trocasSemAvanco: 0,
  config: configPadrao(),
};
function comGatilhoEtapa(etapa: NonNullable<ConfigAria["handoff"]["etapaGatilho"]>): ConfigAria {
  const c = configPadrao();
  c.handoff.gatilhos.etapa = true;
  c.handoff.etapaGatilho = etapa;
  return c;
}
function comGatilhoValor(valor: number): ConfigAria {
  const c = configPadrao();
  c.handoff.gatilhos.valor = true;
  c.handoff.valorGatilho = valor;
  return c;
}

describe("gatilhoDeHandoff", () => {
  it("sem_gatilho_retorna_nulo", () => expect(gatilhoDeHandoff(base)).toBeNull());
  it("recusa_e_saida_invalida_transferem", () => {
    expect(gatilhoDeHandoff({ ...base, recusa: true })).toBe("RECUSA");
    expect(gatilhoDeHandoff({ ...base, saida: null })).toBe("ERRO_PROVEDOR");
  });
  it("recusa_vale_mesmo_com_gatilhos_desligados", () => {
    const c = configPadrao();
    for (const k of Object.keys(c.handoff.gatilhos) as (keyof typeof c.handoff.gatilhos)[]) c.handoff.gatilhos[k] = false;
    expect(gatilhoDeHandoff({ ...base, config: c, recusa: true })).toBe("RECUSA");
    expect(gatilhoDeHandoff({ ...base, config: c, saida: null })).toBe("ERRO_PROVEDOR");
  });
  it("pedido_humano_do_modelo", () =>
    expect(gatilhoDeHandoff({ ...base, saida: { ...ok, handoff: { motivo: "PEDIDO_HUMANO" } } })).toBe("PEDIDO_HUMANO"));
  it("confianca_abaixo_de_50", () => {
    expect(gatilhoDeHandoff({ ...base, saida: { ...ok, confianca: 49 } })).toBe("CONFIANCA");
    expect(gatilhoDeHandoff({ ...base, saida: { ...ok, confianca: 50 } })).toBeNull();
  });
  it("palavra_chave_sem_acento_e_caixa", () =>
    expect(gatilhoDeHandoff({ ...base, ultimaFala: "vou abrir RECLAMACAO no procon" })).toBe("PALAVRA_CHAVE"));
  it("palavra_chave_desligada_nao_vale", () => {
    const c = configPadrao();
    c.handoff.gatilhos.palavrasChave = false;
    expect(gatilhoDeHandoff({ ...base, config: c, ultimaFala: "reclamação" })).toBeNull();
  });
  it("humor_irritado", () =>
    expect(gatilhoDeHandoff({ ...base, saida: { ...ok, humor: "IRRITADO" } })).toBe("HUMOR"));
  it("etapa_e_valor", () => {
    expect(gatilhoDeHandoff({ ...base, etapa: "AGUARDANDO_MATRICULA", config: comGatilhoEtapa("PROPOSTA") })).toBe("ETAPA");
    expect(gatilhoDeHandoff({ ...base, etapa: "QUALIFICADO", config: comGatilhoEtapa("PROPOSTA") })).toBeNull();
    expect(gatilhoDeHandoff({ ...base, valorPrevisto: 5001, config: comGatilhoValor(5000) })).toBe("VALOR");
    expect(gatilhoDeHandoff({ ...base, valorPrevisto: 5000, config: comGatilhoValor(5000) })).toBeNull();
  });
  it("sem_avanco_desligado_por_padrao", () => expect(gatilhoDeHandoff({ ...base, trocasSemAvanco: 9 })).toBeNull());
  it("sem_avanco_ligado_a_partir_de_4", () => {
    const c = configPadrao();
    c.handoff.gatilhos.semAvanco = true;
    expect(gatilhoDeHandoff({ ...base, config: c, trocasSemAvanco: 3 })).toBeNull();
    expect(gatilhoDeHandoff({ ...base, config: c, trocasSemAvanco: 4 })).toBe("SEM_AVANCO");
  });
});
