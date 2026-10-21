// Espera cancelável (debounce): uma ação agendada substitui a anterior; `cancelar` descarta a pendente.
// Usada pelos selects de filtro — as setas do teclado mudam o valor a cada tecla, e só a última vale.
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
