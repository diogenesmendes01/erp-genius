export function criarEspera(ms: number) {
  let pendente: ReturnType<typeof setTimeout> | null = null;
  const cancelar = () => { if (pendente) { clearTimeout(pendente); pendente = null; } };
  return {
    agendar(acao: () => void) {
      cancelar();
      pendente = setTimeout(() => { pendente = null; acao(); }, ms);
    },
    cancelar,
    get pendente() { return pendente !== null; },
  };
}
