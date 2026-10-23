/** Agrupa somente invalidações da primeira página; não faz polling nem altera avisos/leitura. */
export function criarAtualizadorEmLote(executar: (vigente: () => boolean) => Promise<void>) {
  let ativo = true;
  let contexto = 0;
  let emVoo = false;
  let pendente = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const agendar = () => {
    if (!ativo || emVoo || timer !== null || !pendente) return;
    // Fronteira fixa a partir do primeiro aviso: novas entradas não adiam a consulta.
    timer = setTimeout(() => { void iniciar(); }, 50);
  };
  const iniciar = async () => {
    timer = null;
    if (!ativo || emVoo || !pendente) return;
    pendente = false;
    emVoo = true;
    const inicio = contexto;
    try { await executar(() => ativo && contexto === inicio); } catch { /* só uma nova invalidação tenta outra vez */ }
    finally {
      // O executor só termina depois de consumir o corpo HTTP, mesmo ao descartar o snapshot.
      emVoo = false;
      agendar();
    }
  };
  const cancelarPendentes = () => {
    contexto++;
    pendente = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    solicitar() { if (ativo) { pendente = true; agendar(); } },
    cancelarPendentes,
    descartar() { ativo = false; cancelarPendentes(); },
  };
}
