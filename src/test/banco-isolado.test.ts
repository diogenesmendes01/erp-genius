import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { resolverBancoTeste } from "../../scripts/test-profile.mjs";

const pastas: string[] = [];
function pasta() { const p = mkdtempSync(join(tmpdir(), "erp-test-profile-")); pastas.push(p); return p; }
afterEach(() => { for (const p of pastas.splice(0)) rmSync(p, { recursive: true }); });
it("separa quatro bancos e ignora DATABASE_URL externa", () => {
  const urls = ["integracao", "dev-email", "dev-gravacoes", "tester"].map(perfil => resolverBancoTeste(pasta(), { ERP_TEST_PROFILE: perfil, DATABASE_URL: "postgres://producao/remoto" }).url);
  expect(new Set(urls).size).toBe(4);
  expect(urls.every(url => url.startsWith("postgres://postgres:teste@localhost:54329/erp_genius_test"))).toBe(true);
});
it("worktree fixa perfil e rejeita substituição divergente", () => {
  const p = pasta(); writeFileSync(join(p, ".erp-test-profile"), "dev-email");
  expect(resolverBancoTeste(p, {}).banco).toBe("erp_genius_test_dev_email");
  expect(() => resolverBancoTeste(p, { ERP_TEST_PROFILE: "tester" })).toThrow("diverge");
});
it("perfil inválido não vira conexão arbitrária", () => {
  expect(() => resolverBancoTeste(pasta(), { ERP_TEST_PROFILE: "../../producao" })).toThrow("desconhecido");
});
