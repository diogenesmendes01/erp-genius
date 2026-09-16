import { expect, it, vi } from "vitest";
import { ErroVideoDrive, type FetchDrive } from "./drive";
import { consultarRevisaoDriveFixada, fixarRevisaoDriveOrganizacional } from "./drive-revisao";

const fileId = "video-interno-123";
const driveId = "drive-organizacao-456";
const revisionId = "revision-789";
const md5 = "0123456789abcdef0123456789abcdef";

function resposta(json: unknown) {
  return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
}

function arquivo() {
  return resposta({ id: fileId, driveId, headRevisionId: revisionId, mimeType: "video/mp4", trashed: false, capabilities: { canDownload: true } });
}

function revisao(keepForever = false, extra: Record<string, unknown> = {}) {
  return resposta({ id: revisionId, keepForever, md5Checksum: md5, size: "42", mimeType: "video/mp4", ...extra });
}

function entrada(fetch: FetchDrive) {
  return { fileId, driveIdOrganizacao: driveId, token: vi.fn(async () => "token-secreto"), fetch };
}

it("fixa a revisão de cabeça com PATCH e confirma a identidade permanente", async () => {
  const fetch = vi.fn<FetchDrive>()
    .mockResolvedValueOnce(arquivo())
    .mockResolvedValueOnce(revisao())
    .mockResolvedValueOnce(revisao(true))
    .mockResolvedValueOnce(revisao(true));

  await expect(fixarRevisaoDriveOrganizacional(entrada(fetch))).resolves.toEqual({ fileId, driveId, revisionId, md5Checksum: md5, size: "42", mimeType: "video/mp4" });
  expect(fetch).toHaveBeenCalledTimes(4);
  const [headUrl, headInit] = fetch.mock.calls[0]!;
  expect(String(headUrl)).toContain("headRevisionId");
  expect(headInit).toMatchObject({ redirect: "error", cache: "no-store" });
  expect(new Headers(headInit?.headers).get("authorization")).toBe("Bearer token-secreto");
  const [patchUrl, patchInit] = fetch.mock.calls[2]!;
  expect(String(patchUrl)).toContain(`/revisions/${revisionId}`);
  expect(patchInit).toMatchObject({ method: "PATCH", body: JSON.stringify({ keepForever: true }), redirect: "error", cache: "no-store" });
  expect(new Headers(patchInit?.headers).get("content-type")).toBe("application/json");
});

it.each([
  ["revisão confirmada trocada", [arquivo(), revisao(), revisao(true), revisao(true, { id: "outra-revisao" })]],
  ["revisão não permanente", [arquivo(), revisao(), revisao(true), revisao(false)]],
  ["metadata de revisão divergente", [arquivo(), revisao(), revisao(true), revisao(true, { md5Checksum: "ffffffffffffffffffffffffffffffff" })]],
])("recusa %s sem expor detalhes", async (_caso, respostas) => {
  const fetch = vi.fn<FetchDrive>();
  for (const item of respostas) fetch.mockResolvedValueOnce(item);
  await expect(fixarRevisaoDriveOrganizacional(entrada(fetch))).rejects.toBeInstanceOf(ErroVideoDrive);
});

it("recusa erro de rede e mantém redirect error em todas as chamadas", async () => {
  const fetch = vi.fn<FetchDrive>().mockRejectedValue(new Error("URL secreta externa"));
  await expect(fixarRevisaoDriveOrganizacional(entrada(fetch))).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", cache: "no-store" });
});

it("respeita abortamento externo sem chamar a rede", async () => {
  const fetch = vi.fn<FetchDrive>();
  const abortador = new AbortController();
  abortador.abort();
  await expect(fixarRevisaoDriveOrganizacional({ ...entrada(fetch), signal: abortador.signal })).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(fetch).not.toHaveBeenCalled();
});

it("consulta a revisão fixa sem rejeitar uma cabeça posterior do arquivo", async () => {
  const fetch = vi.fn<FetchDrive>()
    .mockResolvedValueOnce(resposta({ id: fileId, driveId, headRevisionId: "revision-nova", mimeType: "video/mp4", trashed: false, capabilities: { canDownload: true } }))
    .mockResolvedValueOnce(revisao(true));
  const fonte = { fileId, driveId, revisionId, md5Checksum: md5, size: "42", mimeType: "video/mp4" };
  await expect(consultarRevisaoDriveFixada({ fonte, token: async () => "token-secreto", fetch })).resolves.toEqual(fonte);
});

it("encerra no prazo mesmo se o token injetado nunca responder", async () => {
  vi.useFakeTimers();
  try {
    const fetch = vi.fn<FetchDrive>();
    const promessa = fixarRevisaoDriveOrganizacional({ fileId, driveIdOrganizacao: driveId, token: async () => await new Promise<string>(() => undefined), fetch, timeoutMs: 10 });
    const esperado = expect(promessa).rejects.toBeInstanceOf(ErroVideoDrive);
    await vi.advanceTimersByTimeAsync(10);
    await esperado;
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("sinal já abortado não busca token nem rede", async () => {
  const abortador = new AbortController();
  abortador.abort();
  const token = vi.fn(async () => "token-secreto");
  const fetch = vi.fn<FetchDrive>();
  await expect(fixarRevisaoDriveOrganizacional({ fileId, driveIdOrganizacao: driveId, token, fetch, signal: abortador.signal })).rejects.toBeInstanceOf(ErroVideoDrive);
  expect(token).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("timeout no PATCH pendente não confirma uma resposta tardia", async () => {
  vi.useFakeTimers();
  try {
    let resolverPatch: ((resposta: Response) => void) | undefined;
    const fetch = vi.fn<FetchDrive>()
      .mockResolvedValueOnce(arquivo())
      .mockResolvedValueOnce(revisao())
      .mockImplementationOnce(() => new Promise<Response>((resolver) => { resolverPatch = resolver; }));
    const promessa = fixarRevisaoDriveOrganizacional({ ...entrada(fetch), timeoutMs: 10 });
    const esperado = expect(promessa).rejects.toBeInstanceOf(ErroVideoDrive);
    await vi.advanceTimersByTimeAsync(10);
    await esperado;
    resolverPatch?.(revisao(true));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});
