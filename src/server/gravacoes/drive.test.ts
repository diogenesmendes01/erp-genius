import { expect, it, vi } from "vitest";
import { abrirVideoDriveOrganizacional, conferirVideoDriveOrganizacional, ErroVideoDrive, type FetchDrive } from "./drive";

const fileId = "video_interno-123";
const driveId = "drive_organizacao-456";
const metadata = (extra: Record<string, unknown> = {}) => new Response(JSON.stringify({
  id: fileId, driveId, mimeType: "video/mp4", trashed: false, capabilities: { canDownload: true }, ...extra,
}), { status: 200, headers: { "content-type": "application/json" } });

const bytes = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } });

it("conferência para publicação valida a fonte sem baixar bytes ou expor credenciais", async () => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValue(metadata());
  expect(await conferirVideoDriveOrganizacional(entrada(fetch))).toEqual({ fileId, driveId, mimeType: "video/mp4" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(String(fetch.mock.calls[0][0])).not.toContain("alt=media");
});

it.each([
  { driveId: "drive_alheio" }, { id: "outro_video" }, { trashed: true }, { mimeType: "application/pdf" }, { capabilities: { canDownload: false } },
])("conferência para publicação recusa metadados incompatíveis %j", async extra => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValue(metadata(extra));
  await expect(conferirVideoDriveOrganizacional(entrada(fetch))).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(fetch).toHaveBeenCalledOnce();
});

it("conferência inválida não busca token e falha de credencial não vaza o erro externo", async () => {
  const fetch = vi.fn<FetchDrive>();
  const d = entrada(fetch);
  await expect(conferirVideoDriveOrganizacional({ ...d, fileId: "https://externo.example/video" })).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(d.token).not.toHaveBeenCalled();
  await expect(conferirVideoDriveOrganizacional({ ...d, token: async () => { throw new Error("segredo-externo"); } })).rejects.toThrow("Vídeo indisponível no repositório institucional.");
  expect(fetch).not.toHaveBeenCalled();
});

function entrada(fetch: FetchDrive, extra: Partial<Parameters<typeof abrirVideoDriveOrganizacional>[0]> = {}) {
  return { fileId, driveIdOrganizacao: driveId, token: vi.fn(async () => "token-secreto-que-nao-sai-do-servidor"), fetch, ...extra };
}

it("valida metadata organizacional e encaminha Range único como stream 206", async () => {
  const fetch = vi.fn<FetchDrive>()
    .mockResolvedValueOnce(metadata())
    .mockResolvedValueOnce(new Response(bytes, { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-2/3", "content-length": "3", "x-drive-interno": "não vazar" } }));
  const resultado = await abrirVideoDriveOrganizacional(entrada(fetch, { range: "bytes=0-2" }));
  expect(resultado).toMatchObject({ status: 206, body: bytes });
  expect(Object.fromEntries(resultado.headers)).toEqual({ "content-length": "3", "content-range": "bytes 0-2/3", "content-type": "video/mp4" });
  expect(fetch).toHaveBeenCalledTimes(2);
  const [metadataUrl, metadataInit] = fetch.mock.calls[0]!;
  const [mediaUrl, mediaInit] = fetch.mock.calls[1]!;
  expect(String(metadataUrl)).toBe(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id%2CdriveId%2CmimeType%2Ctrashed%2Ccapabilities%28canDownload%29`);
  expect(String(mediaUrl)).toBe(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  for (const init of [metadataInit, mediaInit]) {
    expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-secreto-que-nao-sai-do-servidor");
  }
  expect(new Headers(metadataInit?.headers).get("accept")).toBe("application/json");
  expect(new Headers(mediaInit?.headers).get("accept")).toBe("video/*");
  expect(new Headers(mediaInit?.headers).get("range")).toBe("bytes=0-2");
});

it.each([
  ["drive alheio", metadata({ driveId: "drive_de_terceiro-999" })],
  ["tipo não vídeo", metadata({ mimeType: "application/pdf" })],
  ["sem permissão de download", metadata({ capabilities: { canDownload: false } })],
  ["arquivo apagado", metadata({ trashed: true })],
  ["metadado sem trashed explícito", metadata({ trashed: undefined })],
  ["JSON nulo", new Response("null", { status: 200, headers: { "content-type": "application/json" } })],
])("recusa %s antes de solicitar bytes", async (_caso, resposta) => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValue(resposta);
  await expect(abrirVideoDriveOrganizacional(entrada(fetch))).rejects.toThrow("Vídeo indisponível no repositório institucional.");
  expect(fetch).toHaveBeenCalledOnce();
});

it("recusa redirecionamento e Range múltiplo sem revelar URL, token ou causa externa", async () => {
  const redirect = vi.fn<FetchDrive>()
    .mockResolvedValueOnce(metadata())
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://terceiro.example/segredo" } }));
  await expect(abrirVideoDriveOrganizacional(entrada(redirect))).rejects.toThrow("Vídeo indisponível no repositório institucional.");
  expect(redirect).toHaveBeenCalledTimes(2);
  const naoChamado = vi.fn<FetchDrive>();
  await expect(abrirVideoDriveOrganizacional(entrada(naoChamado, { range: "bytes=0-1,3-4" }))).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(naoChamado).not.toHaveBeenCalled();
});

it("recusa sufixo zero e Content-Range incoerente, cancelando a resposta parcial", async () => {
  const semBusca = vi.fn<FetchDrive>();
  await expect(abrirVideoDriveOrganizacional(entrada(semBusca, { range: "bytes=-0" }))).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(semBusca).not.toHaveBeenCalled();

  let cancelado = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); },
    cancel() { cancelado = true; },
  });
  const fetch = vi.fn<FetchDrive>()
    .mockResolvedValueOnce(metadata())
    .mockResolvedValueOnce(new Response(stream, { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 1-3/4", "content-length": "3" } }));
  await expect(abrirVideoDriveOrganizacional(entrada(fetch, { range: "bytes=0-2" }))).rejects.toThrow("Vídeo indisponível no repositório institucional.");
  expect(cancelado).toBe(true);
});


it.each(["bytes 0-1/10", "bytes 7-8/10", "bytes 9-9/10"])("recusa sufixo que não corresponde ao fim real: %s", async contentRange => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(
    new Response(new Uint8Array([1, 2]), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": contentRange } }));
  await expect(abrirVideoDriveOrganizacional(entrada(fetch, { range: "bytes=-2" }))).rejects.toBeInstanceOf(ErroVideoDrive);
});
it.each([["bytes=-2", "bytes 8-9/10"], ["bytes=-20", "bytes 0-9/10"]])("aceita sufixo correto %s", async (range, contentRange) => {
  const fetch = vi.fn<FetchDrive>().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(
    new Response(new Uint8Array([1, 2]), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": contentRange } }));
  const video = await abrirVideoDriveOrganizacional(entrada(fetch, { range }));
  expect(video.status).toBe(206);
  await video.body.cancel();
});
