import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sugestaoNovoCadastroDoLead } from "./sugestao-novo-cadastro";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/server/matricula/preparacao-comercial", () => ({ prepararContratacao: vi.fn(), prepararContratacaoNovaPessoa: vi.fn() }));

import { PreparacaoFormulario } from "@/app/(app)/oportunidades/[id]/contratacao/PreparacaoFormulario";

describe("sugestaoNovoCadastroDoLead", () => {
  it("separa o nome do lead e usa e-mail e país da pessoa", () => {
    expect(sugestaoNovoCadastroDoLead({
      nome: "Lead sem pessoa",
      paisId: "cr",
      pessoa: { nome: "Ana Souza", email: "ana@exemplo.test" },
    })).toEqual({ primeiroNome: "Ana", sobrenome: "Souza", email: "ana@exemplo.test", paisId: "cr" });
    expect(sugestaoNovoCadastroDoLead({ nome: "Bruno", paisId: null, pessoa: null })).toEqual({
      primeiroNome: "Bruno", sobrenome: "", email: "", paisId: "",
    });
  });

  it("preenche os campos de pessoa nova", () => {
    const html = renderToStaticMarkup(createElement(PreparacaoFormulario, {
      leadId: "op1",
      novaPessoa: true,
      paises: [{ id: "cr", nome: "Costa Rica" }],
      sugestaoNovoCadastro: { primeiroNome: "Ana", sobrenome: "Souza", email: "ana@exemplo.test", paisId: "cr" },
      oferta: { id: "of1", versaoEntrada: 1, formaAgenda: null, produtoId: "p", paisId: "cr", moeda: "CRC" },
      candidatos: [],
      turmas: [{ id: "t1", nome: "Turma" }],
    }));
    expect(html).toContain('name="primeiroNome"');
    expect(html).toContain('value="Ana"');
    expect(html).toContain('value="Souza"');
    expect(html).toContain('value="ana@exemplo.test"');
    expect(html).toContain('value="cr"');
  });
});
