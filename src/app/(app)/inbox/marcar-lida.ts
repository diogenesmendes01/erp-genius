/** Junta avisos da mesma conversa enquanto a leitura no servidor está em voo. */
export function criarMarcadorDeLeitura(marcar: (id: string) => Promise<unknown>, podeRepetir: (id: string) => boolean = () => true): (id: string) => void {
  const voos = new Map<string, { pendente: boolean }>();

  const executar = async (id: string): Promise<void> => {
    try { await marcar(id); } catch { /* o próximo aviso ou abertura tenta novamente */ }
    const voo = voos.get(id);
    if (!voo) return;
    if (voo.pendente && podeRepetir(id)) {
      voo.pendente = false;
      void executar(id);
    } else {
      voos.delete(id);
    }
  };

  return (id) => {
    const voo = voos.get(id);
    if (voo) { voo.pendente = true; return; }
    voos.set(id, { pendente: false });
    void executar(id);
  };
}
