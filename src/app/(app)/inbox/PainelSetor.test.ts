import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PainelSetor as Painel } from "@/server/inbox/paineis";
import { PainelSetor } from "./PainelSetor";

const h = (painel: Painel | null) => renderToStaticMarkup(createElement(PainelSetor, { painel }));

describe("PainelSetor", () => {
  it("comercial mostra oportunidade, etapa e valor; sem oportunidade avisa", () => {
    const t = h({ setor: "COMERCIAL", oportunidade: { id: "o1", titulo: "Maria", etapa: "PROPOSTA", valor: "1500.00" }, pessoaId: "p1" });
    expect(t).toContain("Maria"); expect(t).toContain("PROPOSTA"); expect(t).toContain("R$ 1500,00");
    expect(h({ setor: "COMERCIAL", oportunidade: null, pessoaId: null })).toContain("Sem oportunidade visível");
  });
  it("financeiro lista cobranças ou diz que não há", () => {
    expect(h({ setor: "FINANCEIRO", matriculaCodigo: "M-1", cobrancas: [{ id: "c1", vencimento: "2026-10-10", valor: "99.90", status: "ATRASADO" }] })).toContain("R$ 99,90");
    expect(h({ setor: "FINANCEIRO", matriculaCodigo: null, cobrancas: [] })).toContain("Nenhuma cobrança");
  });
  it("secretaria mostra documentos pendentes", () => {
    expect(h({ setor: "SECRETARIA", matriculaCodigo: "M-2", documentosPendentes: 2 })).toContain("Documentos pendentes");
  });
  it("pedagógico mostra turma e frequência, sem telefone", () => {
    const t = h({ setor: "PEDAGOGICO", turma: "T1", frequenciaPct: 80 });
    expect(t).toContain("T1"); expect(t).toContain("80%"); expect(t).not.toMatch(/\+\d{6,}/);
    expect(h({ setor: "PEDAGOGICO", turma: null, frequenciaPct: null })).toContain("Sem registros");
  });
  it("sem painel mostra aviso neutro", () => { expect(h(null)).toContain("Sem detalhes"); });
});
