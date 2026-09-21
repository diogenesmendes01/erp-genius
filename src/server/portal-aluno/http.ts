const LIMITE_CORPO_BYTES = 10_000;

/** Limita os bytes efetivamente recebidos, inclusive sem Content-Length. */
export async function lerJsonPortalAluno(request: Request): Promise<unknown> {
  const declarado = request.headers.get("content-length");
  if (declarado !== null && (!/^\d+$/.test(declarado) || Number(declarado) > LIMITE_CORPO_BYTES)) {
    throw new Error("Corpo inválido.");
  }
  if (!request.body) throw new Error("Corpo ausente.");
  const reader = request.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > LIMITE_CORPO_BYTES) {
        await reader.cancel();
        throw new Error("Corpo excede o limite permitido.");
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const corpo = new Uint8Array(tamanho);
  let posicao = 0;
  for (const parte of partes) { corpo.set(parte, posicao); posicao += parte.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(corpo));
}
