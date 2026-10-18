import { readFileSync } from "node:fs";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { papeisDoGuardFonte } from "@/test/guard-pagina";
import { tabsParaPapeis } from "../_componentes/tabs";
import { SECOES_CRM, secoesCrmParaPapeis } from "./secoes";

const fonte = (caminho: string) => readFileSync(caminho, "utf-8");

describe("seções da configuração do CRM", () => {
  it("ia_so_admin", () =>
    expect(secoesCrmParaPapeis([Papel.GERENTE_COMERCIAL]).map((s) => s.id)).toEqual(["distribuicao", "tags-campos", "respostas", "metas"]));
  it("admin_tudo", () => expect(secoesCrmParaPapeis([Papel.ADMINISTRADOR])).toHaveLength(5));
  it("cada_secao_tem_guard_igual", () => {
    for (const s of SECOES_CRM) {
      expect(papeisDoGuardFonte(fonte(`src/app/(app)/configuracao/crm/${s.id}/page.tsx`), s.id)).toEqual([...s.papeis].sort());
    }
  });
  it("aba_crm_no_menu_de_configuracao", () => {
    expect(tabsParaPapeis([Papel.GERENTE_COMERCIAL]).some((t) => t.href === "/configuracao/crm")).toBe(true);
    expect(tabsParaPapeis([Papel.SECRETARIA_ACADEMICA]).some((t) => t.href === "/configuracao/crm")).toBe(false);
  });
});
