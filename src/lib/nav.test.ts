import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { NAV, navParaPapeis, hrefAtivoMaisLongo } from "./nav";

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
