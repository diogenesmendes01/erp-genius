import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const bancos = Object.freeze({
  integracao: "erp_genius_test",
  "dev-email": "erp_genius_test_dev_email",
  "dev-gravacoes": "erp_genius_test_dev_gravacoes",
  tester: "erp_genius_test_tester",
  claude: "erp_genius_test_claude",
});

export function resolverBancoTeste(raiz = process.cwd(), ambiente = process.env) {
  const arquivo = path.join(raiz, ".erp-test-profile");
  const local = existsSync(arquivo) ? readFileSync(arquivo, "utf8").trim() : undefined;
  const solicitado = ambiente.ERP_TEST_PROFILE;
  if (local && solicitado && local !== solicitado) throw new Error("Perfil de teste diverge do worktree.");
  const perfil = local ?? solicitado ?? "integracao";
  if (!Object.hasOwn(bancos, perfil)) throw new Error("Perfil de teste desconhecido.");
  const banco = bancos[perfil];
  return { perfil, banco, url: `postgres://postgres:teste@localhost:54329/${banco}` };
}
