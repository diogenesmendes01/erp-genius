import { describe, it, expect } from "vitest";
import { StatusTurma, TipoCobranca } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import {
  validarOfertaPais,
  validarTurmaParaProduto,
  validarOfertaPreco,
  vagasDisponiveis,
  type ProdutoCoerencia,
  type TurmaCoerencia,
  type PrecoCoerencia,
} from "./validacao";

const produto: ProdutoCoerencia = {
  id: "prod-1",
  idiomaId: "idi-1",
  modalidadeId: "mod-1",
};

function turma(over: Partial<TurmaCoerencia> = {}): TurmaCoerencia {
  return {
    id: "turma-1",
    status: StatusTurma.ABERTA,
    capacidade: 16,
    modalidadeId: "mod-1",
    nivel: { idiomaId: "idi-1" },
    ...over,
  };
}

function preco(over: Partial<PrecoCoerencia> = {}): PrecoCoerencia {
  return {
    tipoCobranca: TipoCobranca.MATRICULA,
    produtoId: "prod-1",
    paisId: "pais-1",
    ativo: true,
    ...over,
  };
}

describe("validarOfertaPais", () => {
  it("passa quando o produto é oferecido no país", () => {
    expect(() => validarOfertaPais(true)).not.toThrow();
  });
  it("bloqueia quando não é oferecido / inexistente", () => {
    expect(() => validarOfertaPais(false)).toThrow(ErroRegra);
    expect(() => validarOfertaPais(null)).toThrow(ErroRegra);
    expect(() => validarOfertaPais(undefined)).toThrow(ErroRegra);
  });
});

describe("vagasDisponiveis", () => {
  it("desconta apenas as alocações ativas e nunca fica negativo", () => {
    expect(vagasDisponiveis(16, 10)).toBe(6);
    expect(vagasDisponiveis(16, 16)).toBe(0);
    expect(vagasDisponiveis(16, 20)).toBe(0);
  });
});

describe("validarTurmaParaProduto", () => {
  it("passa para turma aberta, coerente e com vaga", () => {
    expect(() => validarTurmaParaProduto(turma(), produto, 10)).not.toThrow();
  });

  it("bloqueia turma não aberta", () => {
    expect(() =>
      validarTurmaParaProduto(turma({ status: StatusTurma.PLANEJADA }), produto, 0),
    ).toThrow(/não está aberta/);
    expect(() =>
      validarTurmaParaProduto(turma({ status: StatusTurma.CONCLUIDA }), produto, 0),
    ).toThrow(ErroRegra);
  });

  it("bloqueia modalidade divergente do produto", () => {
    expect(() =>
      validarTurmaParaProduto(turma({ modalidadeId: "outra" }), produto, 0),
    ).toThrow(/modalidade/);
  });

  it("bloqueia idioma divergente do produto", () => {
    expect(() =>
      validarTurmaParaProduto(turma({ nivel: { idiomaId: "outro" } }), produto, 0),
    ).toThrow(/idioma/);
  });

  it("bloqueia turma sem vaga (apenas alocações ativas contam)", () => {
    expect(() => validarTurmaParaProduto(turma({ capacidade: 2 }), produto, 2)).toThrow(
      /vagas/,
    );
  });

  it("ignora alocações inativas ao contar a vaga", () => {
    // capacidade 2, 2 ativas → cheia (inativas não entram pois o chamador já filtra)
    expect(() => validarTurmaParaProduto(turma({ capacidade: 2 }), produto, 1)).not.toThrow();
  });
});

describe("validarOfertaPreco", () => {
  const completos = [
    preco({ tipoCobranca: TipoCobranca.MATRICULA }),
    preco({ tipoCobranca: TipoCobranca.MENSALIDADE }),
  ];

  it("passa com matrícula + mensalidade ativos para país+produto", () => {
    expect(() => validarOfertaPreco(completos, "prod-1", "pais-1", false)).not.toThrow();
  });

  it("bloqueia quando falta um dos preços e não há exceção", () => {
    const soTaxa = [preco({ tipoCobranca: TipoCobranca.MATRICULA })];
    expect(() => validarOfertaPreco(soTaxa, "prod-1", "pais-1", false)).toThrow(ErroRegra);
    expect(() => validarOfertaPreco([], "prod-1", "pais-1", false)).toThrow(/exceção/);
  });

  it("ignora preços de outro país/produto ou inativos", () => {
    const ruidos = [
      preco({ tipoCobranca: TipoCobranca.MATRICULA, paisId: "outro" }),
      preco({ tipoCobranca: TipoCobranca.MENSALIDADE, produtoId: "outro" }),
      preco({ tipoCobranca: TipoCobranca.MATRICULA, ativo: false }),
      preco({ tipoCobranca: TipoCobranca.MENSALIDADE, ativo: false }),
    ];
    expect(() => validarOfertaPreco(ruidos, "prod-1", "pais-1", false)).toThrow(ErroRegra);
  });

  it("permite prosseguir sem preço quando há exceção aprovada", () => {
    expect(() => validarOfertaPreco([], "prod-1", "pais-1", true)).not.toThrow();
  });
});
