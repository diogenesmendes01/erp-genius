import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ autorizar: vi.fn(), revalidar: vi.fn(), abrir: vi.fn(), token: vi.fn() }));
vi.mock("@/server/gravacoes/aula-institucional", () => ({ prepararVideoAulaInstitucionalContinuo: async (id: string) => ({ fonte: await mocks.autorizar(id), revalidar: mocks.revalidar }) }));
vi.mock("@/server/gravacoes/drive", () => ({ abrirVideoDriveOrganizacional: mocks.abrir }));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterTokenDrive: mocks.token }));
import { GET } from "./route";

const contexto = { params: Promise.resolve({ id: "encontro-1" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.autorizar.mockResolvedValue({ fileId: "arquivo-interno", driveId: "drive-aula" });
  mocks.abrir.mockImplementation(async () => ({ status: 206, body: new ReadableStream({ start(controlador) { controlador.enqueue(new Uint8Array([1, 2])); controlador.close(); } }), headers: new Headers({ "Content-Type": "video/mp4", "Content-Length": "2", "Content-Range": "bytes 0-1/10", Location: "https://example.invalid/secreto", "Set-Cookie": "indevido" }) }));
});

it("reautoriza cada Range e transmite somente bytes e cabeçalhos permitidos", async () => {
  const request = new Request("http://localhost/api/diario/encontros/encontro-1/video", { headers: { Range: "bytes=0-1", "sec-fetch-site": "same-origin" } });
  const response = await GET(request, contexto);
  expect(response.status).toBe(206);
  expect(mocks.autorizar).toHaveBeenCalledWith("encontro-1");
  expect(mocks.abrir).toHaveBeenCalledWith(expect.objectContaining({ fileId: "arquivo-interno", driveIdOrganizacao: "drive-aula", range: "bytes=0-1", signal: request.signal }));
  expect(response.headers.get("Content-Disposition")).toBe("inline");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]));

  mocks.autorizar.mockRejectedValueOnce(new Error("designação revogada"));
  const negada = await GET(request, contexto);
  expect(negada.status).toBe(403);
  expect(mocks.autorizar).toHaveBeenCalledTimes(2);
  expect(mocks.abrir).toHaveBeenCalledTimes(1);
});

it("recusa cross-site antes de consultar autorização ou Drive", async () => {
  const response = await GET(new Request("http://localhost/video", { headers: { "sec-fetch-site": "cross-site" } }), contexto);
  expect(response.status).toBe(403);
  expect(await response.text()).toBe("Gravação indisponível para este acesso.");
  expect(mocks.autorizar).not.toHaveBeenCalled();
  expect(mocks.abrir).not.toHaveBeenCalled();
});

it("não expõe token, arquivo ou URL em falha do Drive", async () => {
  mocks.abrir.mockRejectedValue(new Error("token-secreto arquivo-interno https://googleapis.com/privado"));
  const response = await GET(new Request("http://localhost/video"), contexto);
  expect(response.status).toBe(403);
  expect(await response.text()).toBe("Gravação indisponível para este acesso.");
});


it("revogação da atribuição interrompe o mesmo stream institucional", async () => {
  let sequencia = 0;
  const cancel = vi.fn();
  mocks.abrir.mockResolvedValueOnce({ status: 200, headers: new Headers({ "Content-Type": "video/mp4" }),
    body: new ReadableStream({ pull(c) { c.enqueue(new Uint8Array([++sequencia])); }, cancel }, { highWaterMark: 0 }) });
  const resposta = await GET(new Request("http://localhost/video"), contexto);
  const leitor = resposta.body!.getReader();
  expect((await leitor.read()).value).toEqual(new Uint8Array([1]));
  mocks.revalidar.mockRejectedValueOnce(new Error("atribuição revogada"));
  await expect(leitor.read()).rejects.toThrow("Fluxo de vídeo indisponível.");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(sequencia).toBe(1);
});
