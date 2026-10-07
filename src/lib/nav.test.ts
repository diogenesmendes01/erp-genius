import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { NAV, navParaPapeis, hrefAtivoMaisLongo, hrefDaAbaAtiva, abasParaPapeis } from "./nav";

describe("NAV", () => {
  it("não tem item de menu para /portal — usuário só-portal (ALUNO) é redirecionado antes do shell (app) renderizar", () => {
    expect(NAV.some((item) => item.href === "/portal")).toBe(false);
  });

  it("usuário só ALUNO não recebe nenhum item exclusivo dele — só o item universal (Home), que ele nunca vê porque é redirecionado antes do shell (app)", () => {
    expect(navParaPapeis([Papel.ALUNO]).every((item) => item.papeis === "all")).toBe(true);
  });
});

describe("hrefAtivoMaisLongo", () => {
  it("escolhe o prefixo mais longo entre dois hrefs que compartilham prefixo (o bug real de /financeiro e /financeiro/permuta)", () => {
    expect(hrefAtivoMaisLongo("/financeiro/permuta", ["/financeiro", "/financeiro/permuta"])).toBe("/financeiro/permuta");
  });

  it("não deixa a ordem dos hrefs influenciar o resultado", () => {
    expect(hrefAtivoMaisLongo("/financeiro/permuta", ["/financeiro/permuta", "/financeiro"])).toBe("/financeiro/permuta");
  });

  it("casa a rota exata mesmo sem nenhum prefixo mais longo disponível", () => {
    expect(hrefAtivoMaisLongo("/financeiro", ["/financeiro", "/financeiro/permuta"])).toBe("/financeiro");
  });

  it("respeita borda de segmento — não casa um prefixo de string cru sem barra", () => {
    expect(hrefAtivoMaisLongo("/alunos-outro-nome", ["/alunos"])).toBeUndefined();
  });

  it("devolve undefined quando nenhum href corresponde", () => {
    expect(hrefAtivoMaisLongo("/rota-sem-item-de-menu", ["/financeiro", "/alunos"])).toBeUndefined();
  });
});

describe("hrefDaAbaAtiva (sub-navegação com prefixos aninhados — E2)", () => {
  const abas = [
    { href: "/academico", exato: true },
    { href: "/academico/recuperacoes" },
    { href: "/academico/recuperacoes/designadas" },
    { href: "/academico/modalidades/quantidade", prefixo: "/academico/modalidades" },
  ];

  it("sem opções, é o prefixo mais longo (o mesmo do Sidebar)", () => {
    expect(hrefDaAbaAtiva("/configuracao/whatsapp/numeros", [{ href: "/configuracao" }, { href: "/configuracao/whatsapp" }])).toBe("/configuracao/whatsapp");
    expect(hrefDaAbaAtiva("/configuracao/usuarios", [{ href: "/configuracao" }, { href: "/configuracao/whatsapp" }])).toBe("/configuracao");
  });

  it("aninhado: a aba filha vence a do ramo, nas duas ordens", () => {
    expect(hrefDaAbaAtiva("/academico/recuperacoes/designadas", abas)).toBe("/academico/recuperacoes/designadas");
    expect(hrefDaAbaAtiva("/academico/recuperacoes/designadas", [...abas].reverse())).toBe("/academico/recuperacoes/designadas");
    expect(hrefDaAbaAtiva("/academico/recuperacoes/planos/p1", abas)).toBe("/academico/recuperacoes");
  });

  it("exato: a raiz acende só na própria rota, nunca por prefixo", () => {
    expect(hrefDaAbaAtiva("/academico", abas)).toBe("/academico");
    expect(hrefDaAbaAtiva("/academico/segundas-chamadas/a1/P1", abas)).toBeUndefined();
  });

  it("prefixo: acende abaixo do prefixo declarado e devolve o href da aba", () => {
    expect(hrefDaAbaAtiva("/academico/modalidades/quantidade", abas)).toBe("/academico/modalidades/quantidade");
    expect(hrefDaAbaAtiva("/academico/modalidades/m1/quantidade", abas)).toBe("/academico/modalidades/quantidade");
    expect(hrefDaAbaAtiva("/academico/modalidades-outra", abas)).toBeUndefined();
  });
});

describe("abasParaPapeis", () => {
  const secoes = [
    { href: "/a", label: "A", exato: true, papeis: [Papel.PROFESSOR] },
    { href: "/a/b", label: "B", prefixo: "/a", papeis: [Papel.GERENTE_PEDAGOGICO] },
  ];

  it("filtra pelos papéis, Administrador vê todas, e não leva a lista de papéis para o cliente", () => {
    expect(abasParaPapeis(secoes, [Papel.PROFESSOR])).toEqual([{ href: "/a", label: "A", exato: true }]);
    expect(abasParaPapeis(secoes, [Papel.ADMINISTRADOR])).toEqual([
      { href: "/a", label: "A", exato: true },
      { href: "/a/b", label: "B", prefixo: "/a" },
    ]);
    expect(abasParaPapeis(secoes, [Papel.FINANCEIRO])).toEqual([]);
  });
});
