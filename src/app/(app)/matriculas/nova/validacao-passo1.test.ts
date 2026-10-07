import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/server/matricula/acoes", () => ({ criarMatricula: vi.fn() }));
vi.mock("@/server/turmas/acoes", () => ({ solicitarAberturaTurma: vi.fn() }));

import { errosDoPasso1, type DadosPasso1 } from "./MatriculaFormulario";

// Revisão de integração da #145: a validação do passo 1 marca TODOS os campos pendentes de uma vez
// (o Campo liga cada erro ao controle). Cada regra aqui: apagar uma delas deixa a tela avançar com o
// campo vazio sem marcar nada.
const completo: DadosPasso1 = {
  primeiroNome: "Ana", sobrenome: "Souza", nascimento: "2010-05-01", genero: "FEMININO", alunoPaisId: "p1",
  tipoDocumentoId: "t1", documento: "123", nacionalidade: "CR", email: "ana@exemplo.com", telefone: "+50612345678",
  paisResidencia: "CR", respNome: "", pagador: "ALUNO",
};

describe("matrícula nova — validação do passo 1", () => {
  it("tudo preenchido: nenhum erro", () => {
    expect(errosDoPasso1(completo)).toEqual({});
  });

  it("cada obrigatório vazio (ou só espaços) vira o erro do próprio campo", () => {
    const esperados: [keyof DadosPasso1, string, string][] = [
      ["primeiroNome", "  ", "Informe o nome do aluno."],
      ["sobrenome", "", "Informe o sobrenome."],
      ["nascimento", "", "Informe a data de nascimento."],
      ["genero", "", "Selecione o gênero."],
      ["alunoPaisId", "", "Selecione o país."],
      ["tipoDocumentoId", "", "Selecione o tipo de documento."],
      ["documento", " ", "Informe o número do documento."],
      ["nacionalidade", "", "Selecione a nacionalidade."],
      ["email", "", "Informe o e-mail."],
      ["telefone", "", "Informe o telefone."],
      ["paisResidencia", "", "Selecione o país de residência."],
    ];
    for (const [campo, valor, mensagem] of esperados) {
      expect(errosDoPasso1({ ...completo, [campo]: valor }), campo).toEqual({ [campo]: mensagem });
    }
  });

  it("todos de uma vez: o formulário vazio marca os onze obrigatórios", () => {
    const vazio = Object.fromEntries(Object.keys(completo).map((k) => [k, ""])) as unknown as DadosPasso1;
    expect(Object.keys(errosDoPasso1({ ...vazio, pagador: "ALUNO" })).sort()).toEqual(
      ["alunoPaisId", "documento", "email", "genero", "nacionalidade", "nascimento", "paisResidencia", "primeiroNome", "sobrenome", "telefone", "tipoDocumentoId"],
    );
  });

  it("e-mail fora do formato: \"E-mail inválido.\"", () => {
    expect(errosDoPasso1({ ...completo, email: "ana@" })).toEqual({ email: "E-mail inválido." });
  });

  it("pagador: o próprio aluno dispensa o nome; responsável e empresa exigem, cada um com sua frase", () => {
    expect(errosDoPasso1({ ...completo, pagador: "ALUNO", respNome: "" })).toEqual({});
    expect(errosDoPasso1({ ...completo, pagador: "RESPONSAVEL", respNome: " " })).toEqual({ respNome: "Informe o nome do responsável financeiro." });
    expect(errosDoPasso1({ ...completo, pagador: "EMPRESA", respNome: "" })).toEqual({ respNome: "Informe o nome da empresa pagadora." });
    expect(errosDoPasso1({ ...completo, pagador: "EMPRESA", respNome: "Acme" })).toEqual({});
  });
});
