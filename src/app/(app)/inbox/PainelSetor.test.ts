import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PainelSetor as Painel } from "@/server/inbox/paineis";
import { PainelSetor } from "./PainelSetor";

const h = (painel: Painel | null) => renderToStaticMarkup(createElement(PainelSetor, { painel }));

describe("PainelSetor", () => {
  it("comercial mostra oportunidade, etapa e valor; sem oportunidade avisa", () => {
    const t = h({ setor: "COMERCIAL", oportunidade: { id: "o1", titulo: "Maria", etapa: "PROPOSTA", valor: "1500.00" }, pessoaId: "p1" });
    expect(t).toContain("Maria"); expect(t).toContain("Proposta"); expect(t).not.toContain("PROPOSTA"); expect(t).toContain("R$ 1500,00");
    expect(h({ setor: "COMERCIAL", oportunidade: null, pessoaId: null })).toContain("Sem oportunidade visível");
  });
  it("comercial: a oportunidade abre no funil (/funil?o=<id>), nunca em /leads", () => {
    const t = h({ setor: "COMERCIAL", oportunidade: { id: "o1", titulo: "Maria", etapa: "PROPOSTA", valor: null }, pessoaId: null });
    expect(t).toMatch(/<a [^>]*href="\/funil\?o=o1"[^>]*>Maria<\/a>/);
    expect(t).not.toContain("/leads");
  });
  it("financeiro lista cobranças ou diz que não há", () => {
    expect(h({ setor: "FINANCEIRO", matriculaCodigo: "M-1", cobrancas: [{ id: "c1", vencimento: "2026-10-10", valor: "99.90", status: "ATRASADO" }] })).toContain("R$ 99,90 · Atrasado");
    expect(h({ setor: "FINANCEIRO", matriculaCodigo: "M-1", cobrancas: [{ id: "c1", vencimento: "2026-10-10", valor: "99.90", status: "ATRASADO" }] })).toContain("10/10/2026");
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
  it("rótulo e estado vazio usam texto secundário definido na paleta", () => {
    const comOportunidade = h({ setor: "COMERCIAL", oportunidade: { id: "o1", titulo: "Maria", etapa: "PROPOSTA", valor: null }, pessoaId: null });
    const semOportunidade = h({ setor: "COMERCIAL", oportunidade: null, pessoaId: null });
    expect(comOportunidade).toContain('<dt class="text-gray-600">');
    expect(semOportunidade).toContain('class="text-sm text-gray-600"');
    expect(comOportunidade + semOportunidade).not.toContain("text-muted-foreground");
  });
});
