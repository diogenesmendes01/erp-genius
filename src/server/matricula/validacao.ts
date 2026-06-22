import { StatusTurma, TipoCobranca } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

// Revalidação de matrícula no SERVIDOR (Issue #7).
// Regras PURAS (sem I/O) — o I/O (consultas frescas) vive na Server Action;
// aqui só decidimos, para manter tudo testável (ver docs/14).
//
// Princípio inegociável (doc 13): NÃO confiar em nada que o client envia.
// A action reconsulta turma/produto/país/preço no banco e passa os dados
// crus para estas funções, que aplicam as regras e lançam ErroRegra.

// ------------------------------------------------------------
// Tipos mínimos (subconjuntos do que a action consulta no Prisma).
// ------------------------------------------------------------

export interface ProdutoCoerencia {
  id: string;
  idiomaId: string;
  modalidadeId: string;
}

export interface TurmaCoerencia {
  id: string;
  status: StatusTurma;
  capacidade: number;
  modalidadeId: string;
  nivel: { idiomaId: string };
}

export interface PrecoCoerencia {
  tipoCobranca: TipoCobranca;
  produtoId: string;
  paisId: string;
  ativo: boolean;
}

/**
 * Coerência produto × país: o produto precisa estar OFERECIDO no país
 * (ProdutoPais.oferecido = true). Sem essa habilitação, não há catálogo
 * válido para a matrícula naquele país.
 */
export function validarOfertaPais(
  produtoOferecido: boolean | null | undefined,
): void {
  if (!produtoOferecido) {
    throw new ErroRegra("Produto não está disponível para o país selecionado.");
  }
}

/**
 * Coerência produto × turma: a turma escolhida precisa ser do MESMO idioma e
 * MESMA modalidade do produto ofertado, estar ABERTA e ter vaga.
 *
 * Vaga = capacidade − alocações ATIVAS (ativa: true). Alocações inativas
 * (troca/encerramento) NÃO ocupam vaga (Issue #7).
 */
export function validarTurmaParaProduto(
  turma: TurmaCoerencia,
  produto: ProdutoCoerencia,
  alocacoesAtivas: number,
): void {
  if (turma.status !== StatusTurma.ABERTA) {
    throw new ErroRegra("A turma selecionada não está aberta para matrícula.");
  }
  if (turma.modalidadeId !== produto.modalidadeId) {
    throw new ErroRegra("A turma não corresponde à modalidade do produto.");
  }
  if (turma.nivel.idiomaId !== produto.idiomaId) {
    throw new ErroRegra("A turma não corresponde ao idioma do produto.");
  }
  if (vagasDisponiveis(turma.capacidade, alocacoesAtivas) <= 0) {
    throw new ErroRegra("A turma selecionada não possui vagas disponíveis.");
  }
}

/** Vagas livres = capacidade − alocações ATIVAS (nunca negativo). */
export function vagasDisponiveis(capacidade: number, alocacoesAtivas: number): number {
  return Math.max(0, capacidade - alocacoesAtivas);
}

/**
 * Oferta de preço: precisa existir PrecoReferencia ATIVO de MATRÍCULA e de
 * MENSALIDADE para o par país+produto. Sem oferta válida, bloqueia — a menos
 * que haja um caminho de exceção EXPLÍCITO e APROVADO (excecaoPreco=true).
 *
 * Não confiamos no preço enviado pelo client: os valores negociados continuam
 * vindo do formulário, mas a EXISTÊNCIA de uma referência válida é o gate.
 */
export function validarOfertaPreco(
  precos: PrecoCoerencia[],
  produtoId: string,
  paisId: string,
  excecaoPreco: boolean,
): void {
  const validos = precos.filter(
    (p) => p.ativo && p.produtoId === produtoId && p.paisId === paisId,
  );
  const temTaxa = validos.some((p) => p.tipoCobranca === TipoCobranca.MATRICULA);
  const temMensalidade = validos.some((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE);

  if (temTaxa && temMensalidade) return;
  if (excecaoPreco) return; // caminho de exceção aprovado explicitamente

  throw new ErroRegra(
    "Não há preço de referência válido (matrícula/mensalidade) para este produto no país. " +
      "Cadastre o preço ou registre uma exceção aprovada.",
  );
}
