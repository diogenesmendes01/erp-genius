export function identificacaoContrato(codigo: string | null | undefined, matriculaId: string) {
  return codigo?.trim() || `ID ${matriculaId}`;
}

export function idsAposSelecaoMatricula(ids: string[], matriculaId: string, selecionada: boolean) {
  return selecionada ? [...ids, matriculaId] : ids.filter((id) => id !== matriculaId);
}
