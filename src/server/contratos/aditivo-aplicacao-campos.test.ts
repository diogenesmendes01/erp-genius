import { expect, it } from "vitest";
import { projetarAplicacoesPorCampo, conferirAplicacaoDireta, type VersaoAplicacaoCampos } from "./aditivo-aplicacao-campos";
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

it("permite aplicação direta depois do acerto próprio, inclusive com valor na mesma proposta", () => {
 const a=v(1,{ PRIMEIRA_MENSALIDADE_VENCIMENTO:data,MENSALIDADE_VALOR:preco },{},null,"acerto");
 expect(()=>conferirAplicacaoDireta([a],a.id)).not.toThrow();
 expect(()=>conferirAplicacaoDireta([{...a,aplicacaoVencimentoId:null}],a.id)).toThrow("fluxo próprio");
});
it("herança aplicada permite nova aplicação direta; herança pendente bloqueia", () => {
 const a=v(1,{ PRIMEIRA_MENSALIDADE_VENCIMENTO:data },{},null,"acerto");
 const b=v(2,{MENSALIDADE_VALOR:preco},a.condicoes as object);
 expect(()=>conferirAplicacaoDireta([a,b],b.id)).not.toThrow();
 expect(()=>conferirAplicacaoDireta([{...a,aplicacaoVencimentoId:null},b],b.id)).toThrow();
});

it("Q170 exige conjunto completo para taxa, sem aceitar aplicação geral como prova", () => {
 const a=v(1,{TAXA_VALOR:preco,TAXA_VENCIMENTO:data},{},"geral");
 const pendente=projetarAplicacoesPorCampo([a]);
 expect(pendente.TAXA_VALOR.aplicacaoId).toBeNull();
 expect(pendente.TAXA_VENCIMENTO.aplicacaoId).toBeNull();
 const completo=projetarAplicacoesPorCampo([{...a,conjuntoTaxaCompletoId:"conjunto-completo"}]);
 expect(completo.TAXA_VALOR.aplicacaoId).toBe("conjunto-completo");
 expect(completo.TAXA_VENCIMENTO.aplicacaoId).toBe("conjunto-completo");
});
it("Q170 conserva conjunto da origem herdada e exige nova prova para alteração explícita", () => {
 const a={...v(1,{TAXA_VALOR:preco}),conjuntoTaxaCompletoId:"conjunto-v1"};
 const b=v(2,{MENSALIDADE_VALOR:preco},a.condicoes as object);
 expect(()=>conferirAplicacaoDireta([a,b],b.id)).not.toThrow();
 expect(projetarAplicacoesPorCampo([a,b]).TAXA_VALOR).toMatchObject({origemVersaoId:"v1",aplicacaoId:"conjunto-v1"});
 const c=v(2,{TAXA_VALOR:{...preco,valor:"400"},MENSALIDADE_VALOR:preco},a.condicoes as object);
 expect(()=>conferirAplicacaoDireta([a,c],c.id)).toThrow("fluxo próprio");
});

it("Q168 exige prova própria completa para os dois limites da cobertura", () => {
 const a=v(1,{COBERTURA_INICIO:data,COBERTURA_FIM:data,MENSALIDADE_VALOR:preco},{},"geral");
 expect(()=>conferirAplicacaoDireta([a],a.id)).toThrow("fluxo próprio");
 const completo={...a,conjuntoCoberturaCompletoId:"cobertura-v1"};
 const campos=projetarAplicacoesPorCampo([completo]);
 expect(campos.COBERTURA_INICIO.aplicacaoId).toBe("cobertura-v1");
 expect(campos.COBERTURA_FIM.aplicacaoId).toBe("cobertura-v1");
 expect(()=>conferirAplicacaoDireta([completo],a.id)).not.toThrow();
});

it("Q168 conserva a prova da origem e não a reutiliza em nova alteração explícita", () => {
 const a={...v(1,{COBERTURA_INICIO:data,COBERTURA_FIM:data}),conjuntoCoberturaCompletoId:"cobertura-v1"};
 const b=v(2,{MENSALIDADE_VALOR:preco},a.condicoes as object);
 expect(()=>conferirAplicacaoDireta([a,b],b.id)).not.toThrow();
 expect(projetarAplicacoesPorCampo([a,b]).COBERTURA_FIM).toMatchObject({origemVersaoId:"v1",aplicacaoId:"cobertura-v1"});
 const reafirmada=v(2,{COBERTURA_INICIO:data,COBERTURA_FIM:data,MENSALIDADE_VALOR:preco},a.condicoes as object);
 expect(()=>conferirAplicacaoDireta([a,reafirmada],reafirmada.id)).toThrow("fluxo próprio");
});

it("a prova de cobertura não libera taxa pendente", () => {
 const a={...v(1,{COBERTURA_INICIO:data,COBERTURA_FIM:data,TAXA_VALOR:preco,MENSALIDADE_VALOR:preco}),conjuntoCoberturaCompletoId:"cobertura-v1"};
 expect(projetarAplicacoesPorCampo([a]).TAXA_VALOR.aplicacaoId).toBeNull();
 expect(()=>conferirAplicacaoDireta([a],a.id)).toThrow("fluxo próprio");
});
