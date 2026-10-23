import { describe, expect, it } from "vitest";
import { criarChavesPorAlvo, criarChaveTentativa } from "./chave-idempotencia";

// #166: a tela reenvia a MESMA chave enquanto a tentativa não foi confirmada e troca a chave só depois
// do sucesso (a próxima criação é outra tentativa).
function gerador() {
  let n = 0;
  return () => `chave-${++n}`;
}

describe("criarChaveTentativa", () => {
  it("mantém a chave no resultado incerto e no erro do servidor", () => {
    const t = criarChaveTentativa(gerador());
    const primeira = t.atual;
    t.depoisDo({ tipo: "incerto", mensagem: "x" });
    expect(t.atual).toBe(primeira);
    t.depoisDo({ tipo: "erro", mensagem: "x" });
    expect(t.atual).toBe(primeira);
    // Clique ignorado pela trava de duplo clique: nada muda.
    t.depoisDo(null);
    expect(t.atual).toBe(primeira);
  });

  it("troca a chave depois do sucesso", () => {
    const t = criarChaveTentativa(gerador());
    const primeira = t.atual;
    t.depoisDo({ tipo: "ok", dado: { id: "1" } });
    expect(t.atual).not.toBe(primeira);
    expect(t.atual).toBe("chave-2");
  });
});

describe("criarChavesPorAlvo (C3 da R1 do #291)", () => {
  it("cada alvo tem a própria tentativa; o incerto de um não prende o outro", () => {
    const c = criarChavesPorAlvo(gerador());
    const a = c.para("A").atual;
    c.para("A").depoisDo({ tipo: "incerto", mensagem: "x" });
    expect(c.para("B").atual).not.toBe(a);
    // Voltar ao alvo A reaproveita a tentativa ainda não confirmada.
    expect(c.para("A").atual).toBe(a);
    c.para("A").depoisDo({ tipo: "ok", dado: undefined });
    expect(c.para("A").atual).not.toBe(a);
  });
});
