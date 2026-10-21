import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ autorizar: vi.fn(), revalidar: vi.fn(), abrir: vi.fn(), token: vi.fn() }));
vi.mock("@/server/gravacoes/reproducao-continua", () => ({ prepararReproducaoContinua: async (id: string) => ({ fonte: await mocks.autorizar(id), revalidar: mocks.revalidar }) }));
vi.mock("@/server/gravacoes/drive-revisao-stream", () => ({ abrirVideoRevisaoDrive: mocks.abrir }));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterTokenDrive: mocks.token, obterDriveOrganizacaoId: () => "drive-institucional" }));
import { GET } from "./route";

const contexto = { params: Promise.resolve({ id: "reposicao-1" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.autorizar.mockResolvedValue({
    fileId: "arquivo-interno",
    matriculaId: "matricula-1",
    reposicaoId: "reposicao-1",
    driveId: "drive-institucional",
    revisionId: "revisao-1",
    md5Checksum: "a".repeat(32),
    size: "10",
    mimeType: "video/mp4",
  });
  mocks.abrir.mockImplementation(async () => ({ status: 206, body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.close(); } }), headers: new Headers({ "Content-Type": "video/mp4", "Content-Length": "2", "Content-Range": "bytes 0-1/10", "Location": "https://example.invalid/secreto", "Set-Cookie": "indevido" }) }));
});

it("revalida cada Range e transmite somente bytes e cabeçalhos permitidos", async () => {
  const request = new Request("http://localhost/api/portal-aluno/reposicoes/reposicao-1/video", { headers: { Range: "bytes=0-1", "sec-fetch-site": "same-origin" } });
  const response = await GET(request, contexto);
  expect(response.status).toBe(206);
  expect(mocks.autorizar).toHaveBeenCalledWith("reposicao-1");
  expect(mocks.abrir).toHaveBeenCalledWith(expect.objectContaining({
    fonte: expect.objectContaining({ fileId: "arquivo-interno", driveId: "drive-institucional", revisionId: "revisao-1" }),
    range: "bytes=0-1",
    signal: request.signal,
  }));
  expect(response.headers.get("Content-Disposition")).toBe("inline");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
  mocks.autorizar.mockRejectedValueOnce(new Error("Matrícula bloqueada"));
  const denied = await GET(request, contexto);
  expect(denied.status).toBe(403);
  expect(mocks.autorizar).toHaveBeenCalledTimes(2);
  expect(mocks.abrir).toHaveBeenCalledTimes(1);
});

it("recusa inclusão por outro site antes de consultar conta ou Drive", async () => {
  const response = await GET(new Request("http://localhost/video", { headers: { "sec-fetch-site": "cross-site" } }), contexto);
  expect(response.status).toBe(403);
  expect(mocks.autorizar).not.toHaveBeenCalled();
  expect(mocks.abrir).not.toHaveBeenCalled();
});

it("transmite usando o drive conferido na autorização da publicação", async () => {
  mocks.autorizar.mockResolvedValue({ fileId: "arquivo-interno", matriculaId: "matricula-1", reposicaoId: "reposicao-1", driveId: "drive-publicado", revisionId: "revisao-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" });
  const response = await GET(new Request("http://localhost/video"), contexto);
  expect(response.status).toBe(206);
  expect(mocks.abrir).toHaveBeenCalledWith(expect.objectContaining({ fonte: expect.objectContaining({ driveId: "drive-publicado" }) }));
  await response.arrayBuffer();
});

it("falha do provedor não expõe token, arquivo ou URL", async () => {
  mocks.abrir.mockRejectedValue(new Error("token-secreto arquivo-interno https://googleapis.com/privado"));
  const response = await GET(new Request("http://localhost/video"), contexto);
  expect(response.status).toBe(403);
  expect(await response.text()).toBe("Reprodução indisponível para esta matrícula.");
});


it("revogação no mesmo stream impede novos bytes e cancela a origem", async () => {
  const cancel = vi.fn();
  let sequencia = 0;
  mocks.abrir.mockResolvedValueOnce({ status: 200, headers: new Headers({ "Content-Type": "video/mp4" }),
    body: new ReadableStream({ pull(c) { c.enqueue(new Uint8Array([++sequencia])); }, cancel }, { highWaterMark: 0 }) });
  const response = await GET(new Request("http://localhost/video"), contexto);
  const leitor = response.body!.getReader();
  expect((await leitor.read()).value).toEqual(new Uint8Array([1]));
  mocks.revalidar.mockRejectedValueOnce(new Error("sessão revogada segredo"));
  await expect(leitor.read()).rejects.toThrow("Fluxo de vídeo indisponível.");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(sequencia).toBe(1);
});
