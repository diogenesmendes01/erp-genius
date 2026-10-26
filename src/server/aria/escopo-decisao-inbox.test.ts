import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { excecaoResponsavelNoInbox } from "./escopo-decisao-inbox";
import { capacidadesAria } from "./permissoes-tela";

const usuario = { id: "vendedor", nome: "Vendedor", papeis: [Papel.VENDEDOR] };
const atendimento = { id: "thread", finalidade: "COMERCIAL", responsavelId: usuario.id, leadId: "lead" };
const acao = { atendimentoId: atendimento.id, oportunidadeId: atendimento.leadId };
describe("D1: exceção contextual do responsável atual", () => {
  it("autoriza responsável comercial com alvo atual existente, sem conceder capacidade global", () => {
    expect(excecaoResponsavelNoInbox(usuario, atendimento, acao, true)).toBe(true);
    expect(capacidadesAria(usuario).has("decidirHistorico")).toBe(false);
  });
  it("permite fallback ao lead atual existente da mesma thread", () => {
    expect(excecaoResponsavelNoInbox(usuario, atendimento, { ...acao, oportunidadeId: null }, true)).toBe(true);
  });
  it.each([null, "outro"])("não confunde carteira/convite com responsável atual %s", responsavelId => {
    expect(excecaoResponsavelNoInbox(usuario, { ...atendimento, responsavelId }, acao, true)).toBe(false);
  });
  it.each(["FINANCEIRO", "SECRETARIA", "PEDAGOGICO"])("não estende para %s", finalidade => {
    expect(excecaoResponsavelNoInbox(usuario, { ...atendimento, finalidade }, acao, true)).toBe(false);
  });
  it.each([null, "outra-thread"])("nega ação com atendimento divergente %s", atendimentoId => {
    expect(excecaoResponsavelNoInbox(usuario, atendimento, { ...acao, atendimentoId }, true)).toBe(false);
  });
  it("nega alvo divergente mesmo para o responsável", () => {
    expect(excecaoResponsavelNoInbox(usuario, atendimento, { ...acao, oportunidadeId: "outro-lead" }, true)).toBe(false);
  });
  it("igualdade null não prova alvo válido", () => {
    expect(excecaoResponsavelNoInbox(usuario, { ...atendimento, leadId: null }, { ...acao, oportunidadeId: null }, true)).toBe(false);
  });
  it("alvo removido não autoriza pela identidade antiga", () => {
    expect(excecaoResponsavelNoInbox(usuario, atendimento, acao, false)).toBe(false);
  });
  it("papel sem vendedor não recebe a exceção", () => {
    expect(excecaoResponsavelNoInbox({ ...usuario, papeis: [Papel.PROFESSOR] }, atendimento, acao, true)).toBe(false);
  });
});
