import { describe, expect, it } from "vitest";
import { calcularNotasNivel, HABILIDADES } from "./calculo";

function caso() {
  return {
    matriculaId: "m1", nivelId: "a1", regraVersao: "v1",
    escala: { minimo: "0", maximo: "10" }, minimoGeral: "6",
    habilidades: HABILIDADES.map(habilidade => ({ habilidade, peso: "1", minimo: "6" })),
    avaliacoes: [
      { id: "i", etapa: "INTERMEDIARIA", peso: "1", notas: [{ habilidade: "FALA", nota: "4" as string | null, oficial: true }] },
      { id: "f", etapa: "FINAL", peso: "3", notas: HABILIDADES.map(habilidade => ({ habilidade: habilidade as string, nota: "8" as string | null, oficial: true })) },
    ],
  };
}

function recuperacao(nota: string | null = "9", ordem = 1) {
  return { id: `r${ordem}`, planoAprovadoId: "plano1", matriculaId: "m1", nivelId: "a1", regraVersao: "v1",
    ordem, habilidadesDoPlano: ["FALA"], notas: [{ habilidade: "FALA", nota, oficial: true }] };
}
describe("consolidação exata das notas do nível", () => {
  it("combina pesos por avaliação e por habilidade sem criar zeros fora do escopo", () => {
    const d = caso();
    d.habilidades[0].peso = "2";
    const r = calcularNotasNivel(d);
    expect(r.habilidades[0].resultado).toEqual({ numerador: "7", denominador: "1" });
    expect(r.habilidades[1].memoria).toHaveLength(1);
    expect(r.geral).toEqual({ numerador: "38", denominador: "5" });
    expect(r.atendeRequisitosNotas).toBe(true);
    expect(JSON.parse(JSON.stringify(r)).matriculaId).toBe("m1");
  });
  it.each(["ausente", "rascunho"])("mantém %s como pendência sem excluir o peso", tipo => {
    const d = caso();
    if (tipo === "ausente") d.avaliacoes[0].notas[0].nota = null;
    else d.avaliacoes[0].notas[0].oficial = false;
    const r = calcularNotasNivel(d);
    expect(r.completa).toBe(false);
    expect(r.geral).toBeNull();
    expect(r.atendeRequisitosNotas).toBeNull();
    expect(r.habilidades[0].memoria[0].nota).toBeNull();
    expect(r.habilidades[1].resultado).toEqual({ numerador: "8", denominador: "1" });
  });
  it("não compensa mínimo individual com média geral suficiente", () => {
    const d = caso();
    d.habilidades[0].minimo = "8";
    const r = calcularNotasNivel(d);
    expect(r.atendeGeral).toBe(true);
    expect(r.atendeRequisitosNotas).toBe(false);
  });
  it("compara frações sem arredondar para o mínimo", () => {
    const d = caso();
    d.avaliacoes[0].peso = "2";
    d.avaliacoes[0].notas[0].nota = "0";
    d.avaliacoes[1].peso = "1";
    d.avaliacoes[1].notas[0].nota = "1";
    d.habilidades[0].minimo = "0.333333333333333333333333333333333334";
    const r = calcularNotasNivel(d);
    expect(r.habilidades[0].resultado).toEqual({ numerador: "1", denominador: "3" });
    expect(r.habilidades[0].atendeMinimo).toBe(false);
  });
  it("permite final distribuída em instrumentos distintos", () => {
    const d = caso();
    const final = d.avaliacoes.pop()!;
    d.avaliacoes.push(...final.notas.map((n, i) => ({ ...final, id: `f${i}`, notas: [n] })));
    expect(calcularNotasNivel(d).completa).toBe(true);
  });
  it.each(["peso", "escala", "nota", "duplicada", "cobertura", "habilidade"])("recusa configuração inválida: %s", erro => {
    const d = caso();
    if (erro === "peso") d.avaliacoes[0].peso = "0";
    if (erro === "escala") d.escala.maximo = "0";
    if (erro === "nota") d.avaliacoes[0].notas[0].nota = "11";
    if (erro === "duplicada") d.avaliacoes.push(d.avaliacoes[0]);
    if (erro === "cobertura") d.avaliacoes[1].notas.pop();
    if (erro === "habilidade") d.habilidades[0] = d.habilidades[1];
    expect(() => calcularNotasNivel(d)).toThrow();
  });

  it("recupera somente a habilidade abrangida, sem reintroduzir a tentativa na média regular", () => {
    const d = { ...caso(), recuperacoes: [recuperacao()] };
    const r = calcularNotasNivel(d);
    const fala = r.habilidades[0];
    expect(fala.resultadoOriginal).toEqual({ numerador: "7", denominador: "1" });
    expect(fala.resultado).toEqual({ numerador: "9", denominador: "1" });
    expect(fala.memoria).toHaveLength(2);
    expect(fala.memoriaRecuperacao[0]).toMatchObject({ antes: fala.resultadoOriginal, depois: fala.resultado, melhorou: true });
    expect(r.habilidades[1].resultado).toEqual({ numerador: "8", denominador: "1" });
    expect(r.habilidades[1].memoriaRecuperacao).toEqual([]);
    expect(r.geral).toEqual({ numerador: "33", denominador: "4" });
    expect(calcularNotasNivel(d)).toEqual(r);
  });

  it("preserva tentativas menores e iguais em ordem histórica sem reduzir resultado", () => {
    const r = calcularNotasNivel({ ...caso(), recuperacoes: [recuperacao("8", 3), recuperacao("9", 1), recuperacao("9", 2)] });
    const h = r.habilidades[0];
    expect(h.memoriaRecuperacao.map(m => m.ordem)).toEqual([1, 2, 3]);
    expect(h.memoriaRecuperacao.map(m => m.melhorou)).toEqual([true, false, false]);
    expect(h.memoriaRecuperacao.map(m => m.nota)).toEqual(["9", "9", "8"]);
    expect(h.resultado).toEqual({ numerador: "9", denominador: "1" });
  });

  it.each(["ausente", "rascunho"])("recuperação %s não substitui resultado oficial", tipo => {
    const tentativa = recuperacao(tipo === "ausente" ? null : "10");
    if (tipo === "rascunho") tentativa.notas[0].oficial = false;
    const r = calcularNotasNivel({ ...caso(), recuperacoes: [tentativa] });
    expect(r.habilidades[0].resultado).toEqual({ numerador: "7", denominador: "1" });
    expect(r.habilidades[0].memoriaRecuperacao[0].nota).toBeNull();
    expect(r.recuperacoesPendentes).toBe(true);
  });

  it("recuperação não fornece nota original ausente nem substitui segunda chamada", () => {
    const d = caso();
    d.avaliacoes[0].notas[0].nota = null;
    const r = calcularNotasNivel({ ...d, recuperacoes: [recuperacao()] });
    expect(r.habilidades[0].resultado).toBeNull();
    expect(r.habilidades[0].memoriaRecuperacao[0].pendencia).toBe("RESULTADO_ORIGINAL_PENDENTE");
    expect(r.geral).toBeNull();
    expect(r.atendeRequisitosNotas).toBeNull();
  });

  it("reconfere mínimo geral e individual após recuperação", () => {
    const d = caso();
    d.minimoGeral = "8";
    d.habilidades[0].minimo = "8";
    expect(calcularNotasNivel(d).atendeRequisitosNotas).toBe(false);
    expect(calcularNotasNivel({ ...d, recuperacoes: [recuperacao()] }).atendeRequisitosNotas).toBe(true);
  });

  it("correção de uma tentativa recalcula a partir das fontes, sem conservar nota errada", () => {
    const d = { ...caso(), recuperacoes: [recuperacao("9")] };
    expect(calcularNotasNivel(d).habilidades[0].resultado).toEqual({ numerador: "9", denominador: "1" });
    d.recuperacoes[0].notas[0].nota = "6";
    expect(calcularNotasNivel(d).habilidades[0].resultado).toEqual({ numerador: "7", denominador: "1" });
  });

  it.each(["matriculaId", "nivelId", "regraVersao"] as const)("recusa recuperação de outro %s", campo => {
    const r = recuperacao(); r[campo] = "outro";
    expect(() => calcularNotasNivel({ ...caso(), recuperacoes: [r] })).toThrow("outro contexto");
  });

  it.each(["duplicada", "ordem", "foraPlano", "foraEscala", "regular"])("recusa recuperação inválida: %s", tipo => {
    const r = recuperacao();
    const d = { ...caso(), recuperacoes: [r] };
    if (tipo === "duplicada") d.recuperacoes.push({ ...r, ordem: 2 });
    if (tipo === "ordem") d.recuperacoes.push({ ...r, id: "outra" });
    if (tipo === "foraPlano") r.habilidadesDoPlano = ["ESCRITA"];
    if (tipo === "foraEscala") r.notas[0].nota = "11";
    if (tipo === "regular") r.id = "f";
    expect(() => calcularNotasNivel(d)).toThrow();
  });
});
