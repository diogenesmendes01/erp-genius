import { describe, expect, it } from "vitest";
import { ESQUEMA_SAIDA_CONVERSA, normalizarSaida } from "./tipos";

const saidaOk = {
  resposta: "Oi! Posso ajudar com a matrícula.",
  documentoId: null,
  acoes: [{ acao: "NOTA_INTERNA", texto: "Interessado em natação", justificativa: "dito pelo lead" }],
  confianca: 85,
  handoff: null,
  fontes: [{ tipo: "FAQ", id: "faq1" }],
  humor: "NEUTRO",
};

describe("normalizarSaida", () => {
  it("json_valido", () => expect(normalizarSaida(JSON.stringify(saidaOk))).toEqual(saidaOk));
  it("texto_nao_json_vira_null", () => expect(normalizarSaida("Claro! Aqui está")).toBeNull());
  it("acao_desconhecida_descartada_sem_derrubar_o_resto", () => {
    const s = normalizarSaida(
      JSON.stringify({ ...saidaOk, acoes: [{ acao: "APAGAR_MENSAGEM" }, { acao: "NOTA_INTERNA", texto: "ok", justificativa: "x" }] }),
    );
    expect(s!.acoes).toEqual([{ acao: "NOTA_INTERNA", texto: "ok", justificativa: "x" }]);
  });
  it("confianca_fora_da_faixa_vira_null", () =>
    expect(normalizarSaida(JSON.stringify({ ...saidaOk, confianca: 140 }))).toBeNull());
  it("resposta_acima_de_1000_vira_null", () =>
    expect(normalizarSaida(JSON.stringify({ ...saidaOk, resposta: "a".repeat(1001) }))).toBeNull());
  it("mais_de_5_acoes_vira_null", () => {
    const a = { acao: "NOTA_INTERNA", texto: "t", justificativa: "j" };
    expect(normalizarSaida(JSON.stringify({ ...saidaOk, acoes: Array(6).fill(a) }))).toBeNull();
  });
  it("acao_com_campos_invalidos_descartada", () => {
    const s = normalizarSaida(
      JSON.stringify({ ...saidaOk, acoes: [{ acao: "MOVER_ETAPA", para: "INEXISTENTE", justificativa: "x" }] }),
    );
    expect(s!.acoes).toEqual([]);
  });
  it("condicao_comercial_e_handoff_validos", () => {
    const s = normalizarSaida(
      JSON.stringify({
        ...saidaOk,
        acoes: [{ acao: "CONDICAO_COMERCIAL", tipoCobranca: "MATRICULA", descontoPct: 10, parcelas: 3, justificativa: "x" }],
        handoff: { motivo: "VALOR" },
      }),
    );
    expect(s!.acoes).toHaveLength(1);
    expect(s!.handoff).toEqual({ motivo: "VALOR" });
  });
  it("json_em_bloco_de_codigo_nao_e_aceito", () =>
    expect(normalizarSaida("```json\n" + JSON.stringify(saidaOk) + "\n```")).toBeNull());
  it("esquema_json_fecha_objetos", () =>
    expect(ESQUEMA_SAIDA_CONVERSA).toMatchObject({ type: "object", additionalProperties: false }));
});
