import { instanteDaGrade } from "@/server/agenda/grade";

export type ValoresAlteracao = { professorNovoId: string; fusoOrigem: string; inicioLocal: string; fimLocal: string };

export function alternarEncontro(selecionados: string[], encontroId: string) {
  return selecionados.includes(encontroId) ? selecionados.filter(id => id !== encontroId) : [...selecionados, encontroId];
}

export function professorSelecionado(professorId: string | null, professores: { id: string }[]) {
  return professorId && professores.some(professor => professor.id === professorId) ? professorId : "";
}

/** Converte o horário civil só antes da chamada ao servidor; DST ambíguo ou inexistente falha aqui. */
export function montarAlteracoesAgenda(selecionados: string[], valores: Record<string, ValoresAlteracao>) {
  return selecionados.map(encontroId => {
    const valor = valores[encontroId];
    if (!valor?.professorNovoId || !valor.fusoOrigem || !valor.inicioLocal || !valor.fimLocal) throw new Error("Preencha a alteração proposta.");
    const inicioNovo = instanteDaGrade(valor.inicioLocal.slice(0, 10), valor.inicioLocal.slice(11, 16), valor.fusoOrigem).toISOString();
    const fimNovo = instanteDaGrade(valor.fimLocal.slice(0, 10), valor.fimLocal.slice(11, 16), valor.fusoOrigem).toISOString();
    return { encontroId, professorNovoId: valor.professorNovoId, inicioNovo, fimNovo, duracaoMinutos: Math.round((Date.parse(fimNovo) - Date.parse(inicioNovo)) / 60_000), fusoOrigem: valor.fusoOrigem };
  });
}
