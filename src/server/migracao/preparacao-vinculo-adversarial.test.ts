import { expect, it } from "vitest";
import { EntradaPrepararLoteMigracao, pendenciasDaLinha } from "./preparacao";

const aluno = { id: "aluno-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "BR", fuso: "America/Sao_Paulo" };

it("preserva alocação legível com intervalo inválido como pendência da preparação", () => {
  const entrada = EntradaPrepararLoteMigracao.parse({
    origem: "FONTE",
    chaveLote: "vinculo-alocacao-invalida",
    linhas: [{
      linhaOrigem: "vinculos!2",
      tipoEntrada: "VINCULO_MATRICULA",
      aluno,
      turma: { id: "turma-1", codigo: "T1", nome: "Turma 1" },
      matricula: { id: "matricula-1", situacao: "ATIVA", inicio: "2026-02-01", fim: "2026-12-01", produtoOrigem: "oferta-1", moeda: "BRL", pais: "BR" },
      alocacao: { inicio: "2026-04-02", fim: "2026-04-01" },
      dadosAdicionais: {},
    }],
  });
  const linha = entrada.linhas[0]!;
  expect(linha.alocacao).toEqual({ inicio: "2026-04-02", fim: "2026-04-01" });
  expect(pendenciasDaLinha(linha).map((pendencia) => pendencia.codigo)).toContain("FIM_ALOCACAO_ANTES_INICIO");
});

it("não aceita data civil impossível ou formato não ISO como início da matrícula", () => {
  const linha = EntradaPrepararLoteMigracao.parse({
    origem: "FONTE",
    chaveLote: "data-civil-impossivel",
    linhas: [{
      linhaOrigem: "vinculos!3",
      tipoEntrada: "VINCULO_MATRICULA",
      aluno,
      turma: { id: "turma-1", codigo: "T1", nome: "Turma 1" },
      matricula: { id: "matricula-1", situacao: "ATIVA", inicio: "2026-02-30", fim: "2026-12-01", produtoOrigem: "oferta-1", moeda: "BRL", pais: "BR" },
      dadosAdicionais: {},
    }],
  }).linhas[0]!;
  expect(pendenciasDaLinha(linha).map((pendencia) => pendencia.codigo)).toContain("INICIO_MATRICULA_INVALIDO");
});
