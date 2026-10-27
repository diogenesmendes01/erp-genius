export type ValoresAlteracao = { professorNovoId: string; fusoOrigem: string; inicioLocal: string; fimLocal: string };

export function alternarEncontro(selecionados: string[], encontroId: string) {
  return selecionados.includes(encontroId) ? selecionados.filter(id => id !== encontroId) : [...selecionados, encontroId];
}

export function professorSelecionado(professorId: string | null, professores: { id: string }[]) {
  return professorId && professores.some(professor => professor.id === professorId) ? professorId : "";
}

export function montarAlteracoesAgenda(selecionados: string[], valores: Record<string, ValoresAlteracao>) {
  return selecionados.map(encontroId => {
    const valor = valores[encontroId];
    if (!valor?.professorNovoId || !valor.fusoOrigem || !valor.inicioLocal || !valor.fimLocal) throw new Error("Preencha a alteração proposta.");
    return { encontroId, professorNovoId: valor.professorNovoId, fusoOrigem: valor.fusoOrigem, inicioLocal: valor.inicioLocal, fimLocal: valor.fimLocal };
  });
}
