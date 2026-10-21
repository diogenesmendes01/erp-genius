export function identificacaoContrato(codigo: string | null | undefined, matriculaId: string) {
  return codigo?.trim() || `ID ${matriculaId}`;
}
