/**
 * Envolve o corpo de vídeo para que a autorização seja conferida antes de
 * buscar cada parte e novamente antes de entregá-la ao consumidor.
 */
export class ErroStreamAutorizado extends Error {
  constructor() {
    super("Fluxo de vídeo indisponível.");
    this.name = "ErroStreamAutorizado";
  }
}

export type OpcoesStreamAutorizado = {
  origem: ReadableStream<Uint8Array>;
  revalidar: () => Promise<void>;
  signal?: AbortSignal;
};

/**
 * Não acumula o conteúdo em memória. Qualquer falha de autorização, origem ou
 * cancelamento tem a mesma superfície pública e encerra o leitor de origem.
 */
export function criarStreamAutorizado({ origem, revalidar, signal }: OpcoesStreamAutorizado): ReadableStream<Uint8Array> {
  const leitor = origem.getReader();
  let controlador: ReadableStreamDefaultController<Uint8Array> | null = null;
  let encerrado = false;
  let lockLiberado = false;

  const liberarLock = () => {
    if (lockLiberado) return;
    lockLiberado = true;
    try {
      leitor.releaseLock();
    } catch {
      // O leitor pode já ter sido liberado depois de uma falha da origem.
    }
  };

  const cancelarOrigem = async (motivo?: unknown) => {
    try {
      await leitor.cancel(motivo);
    } catch {
      // A origem não define a mensagem exposta ao cliente.
    } finally {
      liberarLock();
    }
  };

  const encerrarComErro = async () => {
    if (encerrado) return;
    encerrado = true;
    signal?.removeEventListener("abort", abortar);
    if (controlador) controlador.error(new ErroStreamAutorizado());
    await cancelarOrigem();
  };

  const abortar = () => {
    void encerrarComErro();
  };

  if (signal) signal.addEventListener("abort", abortar, { once: true });

  return new ReadableStream<Uint8Array>({
    start(novoControlador) {
      controlador = novoControlador;
      if (signal?.aborted) abortar();
    },
    async pull(novoControlador) {
      if (encerrado) return;
      try {
        await revalidar();
        if (encerrado) return;

        const proximo = await leitor.read();
        if (encerrado) return;
        if (proximo.done) {
          encerrado = true;
          signal?.removeEventListener("abort", abortar);
          novoControlador.close();
          liberarLock();
          return;
        }

        await revalidar();
        if (encerrado) return;
        novoControlador.enqueue(proximo.value);
      } catch {
        await encerrarComErro();
      }
    },
    async cancel(motivo) {
      if (encerrado) return;
      encerrado = true;
      signal?.removeEventListener("abort", abortar);
      await cancelarOrigem(motivo);
    },
  }, { highWaterMark: 0 });
}
