export function criarAtualizadorEmLote(executar: (vigente: () => boolean) => Promise<void>) {
  let ativo = true;
  let contexto = 0;
  let emVoo = false;
  let contextoDoVoo: number | null = null;
  let pendente = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const agendar = () => {
    if (!ativo || emVoo || timer !== null || !pendente) return;
    timer = setTimeout(() => { void iniciar(); }, 50);
  };
  const iniciar = async () => {
    timer = null;
    if (!ativo || emVoo || !pendente) return;
    pendente = false;
    emVoo = true;
    const inicio = contexto;
    contextoDoVoo = inicio;
    try { await executar(() => ativo && contexto === inicio); } catch {  }
    finally {
      emVoo = false;
      contextoDoVoo = null;
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
    invalidarSnapshotEmVoo() { if (ativo && emVoo && contextoDoVoo === contexto) pendente = true; },
    cancelarPendentes,
    descartar() { ativo = false; cancelarPendentes(); },
  };
}
