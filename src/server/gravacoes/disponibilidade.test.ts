import { expect, it, vi } from "vitest";
import { ErroVideoDrive } from "./drive";
import { verificarDisponibilidadeGravacaoDrive } from "./disponibilidade";

const entrada = (stream: ReadableStream<Uint8Array>) => vi.fn(async () => ({
  status: 206 as const,
  body: stream,
  headers: new Headers(),
}));

it("lê somente o primeiro byte e sempre cancela o stream do preflight", async () => {
  let cancelado = false;
  const abrir = entrada(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2])); },
    cancel() { cancelado = true; },
  }));
  await verificarDisponibilidadeGravacaoDrive("arquivo_oficial-1", {
    abrirVideo: abrir,
    obterDriveId: () => "drive_organizacao-1",
    obterToken: async () => "token",
  });
  expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ fileId: "arquivo_oficial-1", range: "bytes=0-0" }));
  expect(cancelado).toBe(true);
});

it("recusa resposta vazia, falha de credencial e timeout sem expor a causa", async () => {
  const vazio = entrada(new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }));
  await expect(verificarDisponibilidadeGravacaoDrive("arquivo_vazio-1", {
    abrirVideo: vazio, obterDriveId: () => "drive_organizacao-1", obterToken: async () => "token",
  })).rejects.toBeInstanceOf(ErroVideoDrive);

  await expect(verificarDisponibilidadeGravacaoDrive("arquivo_credencial-1", {
    abrirVideo: vi.fn(async () => { throw new Error("segredo de provedor"); }),
    obterDriveId: () => "drive_organizacao-1", obterToken: async () => "token",
  })).rejects.toThrow("Vídeo indisponível no repositório institucional.");

  const pendente = entrada(new ReadableStream<Uint8Array>({ pull() { return new Promise<void>(() => undefined); } }));
  await expect(verificarDisponibilidadeGravacaoDrive("arquivo_lento-1", {
    abrirVideo: pendente, obterDriveId: () => "drive_organizacao-1", obterToken: async () => "token", tempoLimiteMs: 1,
  })).rejects.toBeInstanceOf(ErroVideoDrive);

  const aberturaPendente = vi.fn(() => new Promise<never>(() => undefined));
  await expect(verificarDisponibilidadeGravacaoDrive("arquivo_abertura-lenta", {
    abrirVideo: aberturaPendente, obterDriveId: () => "drive_organizacao-1", obterToken: async () => "token", tempoLimiteMs: 1,
  })).rejects.toBeInstanceOf(ErroVideoDrive);
});

it("descarta stream que chegou depois de a abertura exceder o limite", async () => {
  let resolver: ((valor: { status: 206; body: ReadableStream<Uint8Array>; headers: Headers }) => void) | undefined;
  let cancelado = false;
  const abertura = vi.fn(() => new Promise<{ status: 206; body: ReadableStream<Uint8Array>; headers: Headers }>((resolve) => { resolver = resolve; }));
  await expect(verificarDisponibilidadeGravacaoDrive("arquivo_tardio-1", {
    abrirVideo: abertura, obterDriveId: () => "drive_organizacao-1", obterToken: async () => "token", tempoLimiteMs: 1,
  })).rejects.toBeInstanceOf(ErroVideoDrive);

  resolver?.({
    status: 206,
    body: new ReadableStream<Uint8Array>({ cancel() { cancelado = true; } }),
    headers: new Headers(),
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(cancelado).toBe(true);
});
