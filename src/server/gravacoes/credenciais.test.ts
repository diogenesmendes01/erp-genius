import { expect, it, vi } from "vitest";
import { ErroCredenciaisDrive, obterDriveOrganizacaoId, obterTokenDrive, type CriarClienteTokenDrive } from "./credenciais";

const ambienteValido = {
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "gravacoes@projeto.iam.gserviceaccount.com",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nnao-e-uma-chave-real\\n-----END PRIVATE KEY-----",
  DRIVE_ORGANIZACAO_ID: "drive_organizacao-123",
};

it("cria cliente oficial injetável com escopo mínimo e obtém somente o token", async () => {
  const getAccessToken = vi.fn(async () => ({ token: "bearer-temporario" }));
  const criarCliente = vi.fn<CriarClienteTokenDrive>(() => ({ getAccessToken }));

  await expect(obterTokenDrive({ ambiente: ambienteValido, criarCliente })).resolves.toBe("bearer-temporario");
  expect(criarCliente).toHaveBeenCalledWith({
    email: ambienteValido.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
    chavePrivada: "-----BEGIN PRIVATE KEY-----\nnao-e-uma-chave-real\n-----END PRIVATE KEY-----",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  expect(getAccessToken).toHaveBeenCalledOnce();
  expect(obterDriveOrganizacaoId(ambienteValido)).toBe(ambienteValido.DRIVE_ORGANIZACAO_ID);
});

it.each([
  ["email ausente", { ...ambienteValido, GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "" }],
  ["chave ausente", { ...ambienteValido, GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: undefined }],
])("falha fechada para %s sem criar cliente", async (_caso, ambiente) => {
  const criarCliente = vi.fn<CriarClienteTokenDrive>();
  await expect(obterTokenDrive({ ambiente, criarCliente })).rejects.toBeInstanceOf(ErroCredenciaisDrive);
  expect(criarCliente).not.toHaveBeenCalled();
});

it("falha fechada quando o drive institucional não está configurado", () => {
  expect(() => obterDriveOrganizacaoId({ ...ambienteValido, DRIVE_ORGANIZACAO_ID: "" })).toThrow("Configuração de gravações indisponível.");
});

it("normaliza falha da biblioteca sem vazar token ou chave", async () => {
  const segredo = "bearer-que-nao-pode-vazar";
  const chave = "chave-que-nao-pode-vazar";
  const criarCliente = vi.fn<CriarClienteTokenDrive>(() => ({
    getAccessToken: vi.fn(async () => { throw new Error(`${segredo}:${chave}`); }),
  }));
  const erro = await obterTokenDrive({ ambiente: ambienteValido, criarCliente }).catch((causa: unknown) => causa);
  expect(erro).toBeInstanceOf(ErroCredenciaisDrive);
  expect(String(erro)).toBe("Error: Configuração de gravações indisponível.");
  expect(String(erro)).not.toContain(segredo);
  expect(String(erro)).not.toContain(chave);
});

it("recusa resposta de token vazia", async () => {
  const criarCliente: CriarClienteTokenDrive = () => ({ getAccessToken: async () => ({ token: null }) });
  await expect(obterTokenDrive({ ambiente: ambienteValido, criarCliente })).rejects.toThrow("Configuração de gravações indisponível.");
});
