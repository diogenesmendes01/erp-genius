import { describe, it, expect } from "vitest";
import { Papel, StatusTurma, TipoCobranca } from "@prisma/client";
import { ErroRegra, ErroPermissao, temPapel, type UsuarioSessao } from "@/server/_shared";
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
  // Sem exceção: nem justificativa nem papel autorizado.
  const semExcecao = { justificativa: null, autorizado: false };

  it("passa com matrícula + mensalidade ativos e não marca ausência", () => {
    const r = validarOfertaPreco(completos, "prod-1", "pais-1", semExcecao);
    expect(r).toEqual({ precoReferenciaAusente: false });
  });

  it("bloqueia (ErroRegra) quando falta preço e não há justificativa", () => {
    const soTaxa = [preco({ tipoCobranca: TipoCobranca.MATRICULA })];
    expect(() => validarOfertaPreco(soTaxa, "prod-1", "pais-1", semExcecao)).toThrow(ErroRegra);
    expect(() => validarOfertaPreco([], "prod-1", "pais-1", semExcecao)).toThrow(/justificativa/);
  });

  it("trata justificativa só de espaços como vazia (bloqueia)", () => {
    expect(() =>
      validarOfertaPreco([], "prod-1", "pais-1", { justificativa: "   ", autorizado: true }),
    ).toThrow(ErroRegra);
  });

  it("ignora preços de outro país/produto ou inativos", () => {
    const ruidos = [
      preco({ tipoCobranca: TipoCobranca.MATRICULA, paisId: "outro" }),
      preco({ tipoCobranca: TipoCobranca.MENSALIDADE, produtoId: "outro" }),
      preco({ tipoCobranca: TipoCobranca.MATRICULA, ativo: false }),
      preco({ tipoCobranca: TipoCobranca.MENSALIDADE, ativo: false }),
    ];
    expect(() => validarOfertaPreco(ruidos, "prod-1", "pais-1", semExcecao)).toThrow(ErroRegra);
  });

  it("bloqueia (ErroPermissao) com justificativa mas SEM papel autorizado", () => {
    expect(() =>
      validarOfertaPreco([], "prod-1", "pais-1", {
        justificativa: "Cliente B2B sem tabela cadastrada",
        autorizado: false,
      }),
    ).toThrow(ErroPermissao);
  });

  it("permite e marca ausência com justificativa + papel autorizado", () => {
    const r = validarOfertaPreco([], "prod-1", "pais-1", {
      justificativa: "Cliente B2B sem tabela cadastrada",
      autorizado: true,
    });
    expect(r).toEqual({ precoReferenciaAusente: true });
  });

  // Reproduz exatamente como a action apura `autorizado` (temPapel) para garantir
  // que vendedor comum não consegue forçar a exceção nem com justificativa.
  describe("integração com papel (como na Server Action)", () => {
    const PAPEIS_EXCECAO = [Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR];
    const vendedor: UsuarioSessao = { id: "v", nome: "V", papeis: [Papel.VENDEDOR] };
    const gerente: UsuarioSessao = { id: "g", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
    const admin: UsuarioSessao = { id: "a", nome: "A", papeis: [Papel.ADMINISTRADOR] };

    function tentar(autor: UsuarioSessao, justificativa: string | null) {
      return validarOfertaPreco([], "prod-1", "pais-1", {
        justificativa,
        autorizado: temPapel(autor, ...PAPEIS_EXCECAO),
      });
    }

    it("vendedor comum NÃO força a exceção mesmo com justificativa", () => {
      expect(() => tentar(vendedor, "tentando pular o bloqueio")).toThrow(ErroPermissao);
    });

    it("gerente comercial pode, com justificativa", () => {
      expect(tentar(gerente, "tabela em revisão")).toEqual({ precoReferenciaAusente: true });
    });

    it("administrador pode, com justificativa", () => {
      expect(tentar(admin, "exceção pontual")).toEqual({ precoReferenciaAusente: true });
    });

    it("nem gerente prossegue sem justificativa", () => {
      expect(() => tentar(gerente, null)).toThrow(ErroRegra);
    });
  });
});
