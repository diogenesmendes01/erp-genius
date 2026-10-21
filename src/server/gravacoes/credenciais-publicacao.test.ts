import { expect, it, vi } from "vitest";
import { obterTokenPublicacaoDrive } from "./credenciais-publicacao";
const ambiente = {
  GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL: "publicador@example.test",
  GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nteste\\n-----END PRIVATE KEY-----",
};
it("usa credencial explícita de publicação e escopo de retenção", async () => {
  const criarCliente = vi.fn(() => ({ getAccessToken: async () => ({ token: "publicacao" }) }));
  expect(await obterTokenPublicacaoDrive({ ambiente, criarCliente })).toBe("publicacao");
  expect(criarCliente).toHaveBeenCalledWith({ email: ambiente.GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL,
    chavePrivada: "-----BEGIN PRIVATE KEY-----\nteste\n-----END PRIVATE KEY-----", scopes: ["https://www.googleapis.com/auth/drive"] });
});
it("não substitui configuração ausente por credencial de leitura", async () => {
  const criarCliente = vi.fn();
  await expect(obterTokenPublicacaoDrive({ ambiente: {}, criarCliente })).rejects.toThrow("Configuração de gravações indisponível.");
  expect(criarCliente).not.toHaveBeenCalled();
});
it("falha externa não revela credenciais", async () => {
  const criarCliente = () => ({ getAccessToken: async () => { throw new Error("segredo da chave"); } });
  await expect(obterTokenPublicacaoDrive({ ambiente, criarCliente })).rejects.toThrow("Configuração de gravações indisponível.");
});
