import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ aluno: vi.fn(async (id: string) => `Aluno ${id}`), lead: vi.fn(async (id: string) => `Lead ${id}`), empresa: vi.fn(async (id: string) => `Empresa ${id}`) }));
vi.mock("@/server/titulos-registro", () => ({ tituloAluno: m.aluno, tituloLead: m.lead, tituloEmpresa: m.empresa }));

import * as Aluno from "./layout";
import * as Lead from "../../leads/[id]/layout";
import * as Empresa from "../../empresas/[id]/layout";

describe("layouts das fichas: título de aba (E2)", () => {
  it("cada ficha pede o título do seu registro e só repassa os filhos", async () => {
    const p = (id: string) => ({ params: Promise.resolve({ id }) });
    expect(await Aluno.generateMetadata(p("a1"))).toEqual({ title: "Aluno a1" });
    expect(await Lead.generateMetadata(p("l1"))).toEqual({ title: "Lead l1" });
    expect(await Empresa.generateMetadata(p("e1"))).toEqual({ title: "Empresa e1" });
    expect(Aluno.default({ children: "filho" })).toBe("filho");
  });
});
