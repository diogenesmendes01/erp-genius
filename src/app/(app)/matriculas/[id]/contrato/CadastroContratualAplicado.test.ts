import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CadastroContratualAplicado } from "./CadastroContratualAplicado";
import { projetarCadastroContratual } from "@/server/contratos/cadastro-contratual";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";

it("apresenta os oito campos do contrato e escapa conteúdo cadastral", () => {
  const campos = {
    ALUNO_NOME: "<script>nome</script>", ALUNO_DOCUMENTO: "DOC-ALUNO",
    ALUNO_EMAIL: "aluno@example.test", ALUNO_ENDERECO: "Rua do aluno, 1",
    PAGADOR_NOME: "Pagador contratual", PAGADOR_DOCUMENTO: "DOC-PAGADOR",
    PAGADOR_EMAIL: "pagador@example.test", PAGADOR_ENDERECO: "Rua do pagador, 2",
  };
  const condicoes = Object.fromEntries(Object.entries(campos).map(([campo, valor]) => [campo,
    campo.endsWith("EMAIL") ? { tipo: "EMAIL", email: valor } : { tipo: "TEXT", texto: valor }]));
  const condicoesHash = hashSubstituicao(condicoes);
  const cadastro = projetarCadastroContratual("matricula", {
    matriculaId: "matricula", versao: 3, vigenciaInicio: new Date("2030-01-01T00:00:00Z"),
    condicoes, condicoesHash, aplicacao: { id: "aplicacao", condicoesHash },
  }, new Date("2029-12-31T00:00:00Z"));
  const html = renderToStaticMarkup(CadastroContratualAplicado({ cadastro, preferenciaFusoExibicao: "America/Costa_Rica" }));
  expect(cadastro?.campos).toEqual(campos);
  expect(html).toContain("Vigência programada");
  expect(html).toContain("31/12/2029, 18:00");
  expect(html).toContain("referência contratual preservada");
  expect(html).toContain("versão 3");
  expect(html.match(/<dt /g)).toHaveLength(8);
  expect(html).toContain("&lt;script&gt;nome&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Versões posteriores podem substituí-los");
});

it("recorre a UTC quando a preferência não está disponível", () => {
  const html = renderToStaticMarkup(CadastroContratualAplicado({ cadastro: {
    versao: 1, estado: "VIGENCIA_INICIADA", vigenciaInicio: "2030-01-01T00:00:00Z",
    campos: { ALUNO_NOME: "Ana" },
  }, preferenciaFusoExibicao: null }));
  expect(html).toContain("01/01/2030, 00:00");
  expect(html).toContain("horário exibido em UTC");
});

it("apresenta vigência ISO com offset como o mesmo instante", () => {
  const html = renderToStaticMarkup(CadastroContratualAplicado({ cadastro: {
    versao: 1, estado: "VIGENCIA_INICIADA", vigenciaInicio: "2026-01-01T00:30:00-03:00",
    campos: { ALUNO_NOME: "Ana" },
  }, preferenciaFusoExibicao: "America/Costa_Rica" }));
  expect(html).toContain("31/12/2025, 21:30");
});

it("não apresenta campos financeiros ou conteúdo sem projeção cadastral", () => {
  expect(renderToStaticMarkup(CadastroContratualAplicado({ cadastro: null }))).toBe("");
  expect(renderToStaticMarkup(CadastroContratualAplicado({ cadastro: {
    versao: 1, estado: "VIGENCIA_INICIADA", vigenciaInicio: "2030-01-01T00:00:00Z",
    campos: { MENSALIDADE_VALOR: "100.00", segredo: "não divulgar" },
  } }))).toBe("");
});
