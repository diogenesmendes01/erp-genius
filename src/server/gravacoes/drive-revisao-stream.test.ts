import { expect, it, vi } from "vitest";
import { abrirVideoRevisaoDrive } from "./drive-revisao-stream";
import type { FetchDrive } from "./drive";
const fonte = { fileId: "arquivo", driveId: "drive", revisionId: "rev-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" };
const arquivo = () => new Response(JSON.stringify({ id: "arquivo", driveId: "drive", headRevisionId: "rev-2", trashed: false, mimeType: "video/mp4", capabilities: { canDownload: true } }));
const revisao = () => new Response(JSON.stringify({ id: "rev-1", keepForever: true, md5Checksum: fonte.md5Checksum, size: "10", mimeType: "video/mp4" }));
function resposta(range: string, total = "10") {
  return new Response(new Uint8Array([1, 2]), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": `bytes ${range}/${total}`, "Content-Length": "2", "Set-Cookie": "segredo" } });
}
it("dois ranges continuam em rev-1 embora a cabeça atual seja rev-2", async () => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(arquivo()).mockResolvedValueOnce(revisao()).mockResolvedValueOnce(resposta("0-1"))
    .mockResolvedValueOnce(arquivo()).mockResolvedValueOnce(revisao()).mockResolvedValueOnce(resposta("2-3"));
  for (const range of ["bytes=0-1", "bytes=2-3"]) {
    const video = await abrirVideoRevisaoDrive({ fonte, token: async () => "privado", fetch, range });
    expect(video.headers.get("Set-Cookie")).toBeNull();
    expect(await new Response(video.body).arrayBuffer()).toHaveProperty("byteLength", 2);
  }
  const media = fetch.mock.calls.filter(([url]) => String(url).includes("alt=media"));
  expect(media).toHaveLength(2);
  for (const [url, init] of media) {
    expect(String(url)).toBe("https://www.googleapis.com/drive/v3/files/arquivo/revisions/rev-1?alt=media");
    expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
  }
});
it.each([["bytes=-2", "8-9"], ["bytes=8-", "8-9"]])("aceita range %s da revisão fixa", async (range, trecho) => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(arquivo()).mockResolvedValueOnce(revisao()).mockResolvedValueOnce(resposta(trecho));
  const video = await abrirVideoRevisaoDrive({ fonte, token: async () => "privado", fetch, range });
  await video.body.cancel();
  expect(video.status).toBe(206);
});
it("recusa total de bytes incompatível com a revisão conferida", async () => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(arquivo()).mockResolvedValueOnce(revisao()).mockResolvedValueOnce(resposta("0-1", "12"));
  await expect(abrirVideoRevisaoDrive({ fonte, token: async () => "privado", fetch, range: "bytes=0-1" })).rejects.toThrow("Vídeo indisponível");
});
it("falha segura sem cair para download da cabeça", async () => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(arquivo()).mockResolvedValueOnce(new Response("segredo", { status: 404 }));
  await expect(abrirVideoRevisaoDrive({ fonte, token: async () => "privado", fetch })).rejects.toThrow("Vídeo indisponível");
  expect(fetch.mock.calls.some(([url]) => String(url).includes("alt=media"))).toBe(false);
});


it("prazo encerra token que não responde antes de acessar o Drive", async () => {
  vi.useFakeTimers();
  try {
    const fetch = vi.fn<FetchDrive>();
    const pendente = abrirVideoRevisaoDrive({ fonte, token: () => new Promise<string>(() => {}), fetch, timeoutMs: 20 });
    const falha = expect(pendente).rejects.toThrow("Vídeo indisponível");
    await vi.advanceTimersByTimeAsync(20);
    await falha;
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
