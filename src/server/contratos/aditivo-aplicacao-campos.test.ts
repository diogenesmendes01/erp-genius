import { expect, it } from "vitest";
import { projetarAplicacoesPorCampo, type VersaoAplicacaoCampos } from "./aditivo-aplicacao-campos";
import { hashSubstituicao } from "./substituicao-estado";
const data = { tipo: "DATA", data: "2026-11-15" };
const preco = { tipo: "DINHEIRO", valor: "300", moeda: "BRL" };
function v(numero: number, alteracoes: Record<string, any>, anteriores = {}, geral: string | null = null, vencimento: string | null = null): VersaoAplicacaoCampos {
 const condicoes = { ...anteriores, ...alteracoes };
 return { id: `v${numero}`, anteriorId: numero === 1 ? null : `v${numero-1}`, versao: numero, condicoes, condicoesHash: hashSubstituicao(condicoes), alteracoes: Object.entries(alteracoes).map(([origem,valorEstruturado]) => ({ origem,valorEstruturado })), aplicacaoGeralId: geral, aplicacaoVencimentoId: vencimento };
}
it("reconhece apenas o campo efetivamente aplicado pelo acerto", () => {
 const r = projetarAplicacoesPorCampo([v(1,{ PRIMEIRA_MENSALIDADE_VENCIMENTO: data, COBERTURA_INICIO: data },{},null,"acerto")]);
 expect(r.PRIMEIRA_MENSALIDADE_VENCIMENTO.aplicacaoId).toBe("acerto");
 expect(r.COBERTURA_INICIO.aplicacaoId).toBeNull();
});
it("conserva prova herdada sem considerar aplicada a nova alteração de preço", () => {
 const a = v(1,{ PRIMEIRA_MENSALIDADE_VENCIMENTO: data },{},null,"acerto");
 const r = projetarAplicacoesPorCampo([a,v(2,{ MENSALIDADE_VALOR: preco },a.condicoes as object)]);
 expect(r.PRIMEIRA_MENSALIDADE_VENCIMENTO).toMatchObject({ origemVersaoId:"v1",aplicacaoId:"acerto" });
 expect(r.MENSALIDADE_VALOR.aplicacaoId).toBeNull();
});
it("reafirmação explícita do mesmo valor exige nova aplicação", () => {
 const a = v(1,{ PRIMEIRA_MENSALIDADE_VENCIMENTO: data },{},null,"acerto");
 expect(projetarAplicacoesPorCampo([a,v(2,{ PRIMEIRA_MENSALIDADE_VENCIMENTO:data },a.condicoes as object)]).PRIMEIRA_MENSALIDADE_VENCIMENTO).toMatchObject({ origemVersaoId:"v2",aplicacaoId:null });
});
it("aplicação geral não prova cobertura nem vencimento próprio", () => {
 const r=projetarAplicacoesPorCampo([v(1,{ MENSALIDADE_VALOR:preco, COBERTURA_INICIO:data, PRIMEIRA_MENSALIDADE_VENCIMENTO:data },{},"geral")]);
 expect(r.MENSALIDADE_VALOR.aplicacaoId).toBe("geral"); expect(r.COBERTURA_INICIO.aplicacaoId).toBeNull(); expect(r.PRIMEIRA_MENSALIDADE_VENCIMENTO.aplicacaoId).toBeNull();
});
it("recusa cadeia incompleta e alteração cumulativa sem origem explícita", () => {
 expect(()=>projetarAplicacoesPorCampo([v(2,{ MENSALIDADE_VALOR:preco })])).toThrow("Cadeia");
 expect(()=>projetarAplicacoesPorCampo([v(1,{}, { MENSALIDADE_VALOR:preco })])).toThrow("alterações preservadas");
});
it("recusa hash corrompido e campos duplicados", () => {
 const a=v(1,{ MENSALIDADE_VALOR:preco });
 expect(()=>projetarAplicacoesPorCampo([{...a,condicoesHash:"incorreto"}])).toThrow("Integridade");
 expect(()=>projetarAplicacoesPorCampo([{...a,alteracoes:[...a.alteracoes,...a.alteracoes]}])).toThrow("explícitas");
});

it("nova aplicação direta não valida alteração pendente de outra proposta", () => {
 const a=v(1,{ MENSALIDADE_VALOR:preco });
 const r=projetarAplicacoesPorCampo([a,v(2,{ ALUNO_NOME:{tipo:"TEXT",texto:"Nome"} },a.condicoes as object,"aplicacao-v2")]);
 expect(r.MENSALIDADE_VALOR.aplicacaoId).toBeNull();
 expect(r.ALUNO_NOME.aplicacaoId).toBe("aplicacao-v2");
});
