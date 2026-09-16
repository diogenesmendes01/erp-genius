import { expect, it, vi } from "vitest";
import { criarStreamAutorizado, ErroStreamAutorizado } from "./stream-autorizado";

async function lerTudo(stream: ReadableStream<Uint8Array>) {
  const leitor = stream.getReader();
  const partes: number[] = [];
  for (;;) {
    const parte = await leitor.read();
    if (parte.done) return partes;
    partes.push(...parte.value);
  }
}

it("preserva bytes sem acumular o vídeo e revalida antes de ler e entregar", async () => {
  const revalidar = vi.fn(async () => undefined);
  const stream = criarStreamAutorizado({
    origem: new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(new Uint8Array([1, 2]));
        controlador.enqueue(new Uint8Array([3]));
        controlador.close();
      },
    }),
    revalidar,
  });

  await expect(lerTudo(stream)).resolves.toEqual([1, 2, 3]);
  // Duas verificações para cada chunk e uma antes de observar o fim.
  expect(revalidar).toHaveBeenCalledTimes(5);
});

it("não libera o próximo chunk quando a autorização é revogada entre leituras", async () => {
  let cancelado = false;
  let chamadas = 0;
  const stream = criarStreamAutorizado({
    origem: new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(new Uint8Array([1]));
        controlador.enqueue(new Uint8Array([2]));
      },
      cancel() { cancelado = true; },
    }),
    revalidar: async () => {
      chamadas += 1;
      if (chamadas === 3) throw new Error("papel revogado");
    },
  });
  const leitor = stream.getReader();

  await expect(leitor.read()).resolves.toMatchObject({ done: false, value: new Uint8Array([1]) });
  await expect(leitor.read()).rejects.toBeInstanceOf(ErroStreamAutorizado);
  expect(cancelado).toBe(true);
});

it("abort cancela uma leitura pendente da origem", async () => {
  let cancelarLeitura: (() => void) | undefined;
  let cancelado = false;
  const origem = new ReadableStream<Uint8Array>({
    pull() {
      return new Promise<void>((resolver) => { cancelarLeitura = resolver; });
    },
    cancel() {
      cancelado = true;
      cancelarLeitura?.();
    },
  });
  const abortador = new AbortController();
  const stream = criarStreamAutorizado({ origem, revalidar: async () => undefined, signal: abortador.signal });
  const leitura = stream.getReader().read();

  await Promise.resolve();
  abortador.abort();
  await expect(leitura).rejects.toBeInstanceOf(ErroStreamAutorizado);
  expect(cancelado).toBe(true);
});

it("cancelamento do consumidor encerra a origem", async () => {
  let motivo: unknown;
  const stream = criarStreamAutorizado({
    origem: new ReadableStream<Uint8Array>({ cancel(valor) { motivo = valor; } }),
    revalidar: async () => undefined,
  });

  await stream.cancel("cliente saiu");
  expect(motivo).toBe("cliente saiu");
});

it("erros da origem têm superfície genérica", async () => {
  const stream = criarStreamAutorizado({
    origem: new ReadableStream<Uint8Array>({
      start(controlador) { controlador.error(new Error("segredo da origem")); },
    }),
    revalidar: async () => undefined,
  });

  const leitor = stream.getReader();
  await expect(leitor.read()).rejects.toThrow("Fluxo de vídeo indisponível.");
  await expect(leitor.closed).rejects.not.toThrow("segredo da origem");
});


it("descarta bytes que chegaram depois da revogação durante uma leitura pendente", async () => {
  let entregar!: (valor: Uint8Array) => void;
  let iniciou!: () => void;
  const inicio = new Promise<void>(resolve => { iniciou = resolve; });
  const cancel = vi.fn();
  const origem = new ReadableStream<Uint8Array>({
    start(c) { entregar = valor => c.enqueue(valor); },
    pull() { iniciou(); }, cancel,
  }, { highWaterMark: 0 });
  let permitido = true;
  const revalidar = vi.fn(async () => { if (!permitido) throw new Error("revogado"); });
  const leitor = criarStreamAutorizado({ origem, revalidar }).getReader();
  const pendente = leitor.read();
  await inicio;
  permitido = false;
  entregar(new Uint8Array([99]));
  await expect(pendente).rejects.toThrow("Fluxo de vídeo indisponível.");
  expect(revalidar).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(1);
});
