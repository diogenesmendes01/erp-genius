import { StatusTurma, TipoCobranca } from "@prisma/client";
import { ErroRegra, ErroPermissao } from "@/server/_shared";

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

export function validarOfertaPais(
  produtoOferecido: boolean | null | undefined,
): void {
  if (!produtoOferecido) {
    throw new ErroRegra("Produto não está disponível para o país selecionado.");
  }
}

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

export function vagasDisponiveis(capacidade: number, alocacoesAtivas: number): number {
  return Math.max(0, capacidade - alocacoesAtivas);
}

export interface ExcecaoPreco {
  justificativa?: string | null;
  autorizado: boolean;
}

export function validarOfertaPreco(
  precos: PrecoCoerencia[],
  produtoId: string,
  paisId: string,
  excecao: ExcecaoPreco,
): { precoReferenciaAusente: boolean } {
  const validos = precos.filter(
    (p) => p.ativo && p.produtoId === produtoId && p.paisId === paisId,
  );
  const temTaxa = validos.some((p) => p.tipoCobranca === TipoCobranca.MATRICULA);
  const temMensalidade = validos.some((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE);

  if (temTaxa && temMensalidade) return { precoReferenciaAusente: false };

  const justificativa = excecao.justificativa?.trim();
  if (!justificativa) {
    throw new ErroRegra(
      "Não há preço de referência válido (matrícula/mensalidade) para este produto no país. " +
        "Cadastre o preço ou informe uma justificativa para a exceção.",
    );
  }
  if (!excecao.autorizado) {
    throw new ErroPermissao(
      "Apenas Gerente Comercial ou Administrador podem matricular sem preço de referência.",
    );
  }
  return { precoReferenciaAusente: true };
}
