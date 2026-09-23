import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { NAV, navParaPapeis } from "./nav";

describe("NAV", () => {
  it("não tem item de menu para /portal — usuário só-portal (ALUNO) é redirecionado antes do shell (app) renderizar", () => {
    expect(NAV.some((item) => item.href === "/portal")).toBe(false);
  });

  it("usuário só ALUNO não recebe nenhum item exclusivo dele — só o item universal (Home), que ele nunca vê porque é redirecionado antes do shell (app)", () => {
    expect(navParaPapeis([Papel.ALUNO]).every((item) => item.papeis === "all")).toBe(true);
  });
});
