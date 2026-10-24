import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sql = (pasta: string) => { const path = `prisma/migrations/${pasta}/migration.sql`; expect(existsSync(path), path).toBe(true); return ler(path).replace(/--.*$/gm, "").trim(); };
describe("#337 unicidade por nota preservando unicidade temporal legada", () => {
  it("enum isolado, sem usar novo valor para escrita na mesma migration", () => {
    expect(sql("20261023140000_notificacao_mencao_nota")).toBe('ALTER TYPE "TipoNotificacao" ADD VALUE \'MENCAO_NOTA\';');
  });
  it("criar parcial antes de retirar global, mesmo conjunto de4colunas e apenas menção excluída", () => {
    const criar = sql("20261023170000_notificacao_mencao_unicidade_legada");
    expect(criar).toBe('CREATE UNIQUE INDEX CONCURRENTLY "NotificacaoUsuario_legado_temporal_key" ON "NotificacaoUsuario"("tipo", "refId", "usuarioId", "criadaEm") WHERE "tipo" <> \'MENCAO_NOTA\';');
    expect(sql("20261023180000_notificacao_mencao_retira_unicidade_global")).toBe('DROP INDEX CONCURRENTLY "NotificacaoUsuario_tipo_refId_usuarioId_criadaEm_key";');
  });
  it("schema não promete unique global e mantém índice de leitura do sino", () => {
    const bloco = ler("prisma/schema.prisma").match(/^model NotificacaoUsuario \{([\s\S]*?)^\}/m)![1];
    expect(bloco).not.toContain("@@unique([tipo, refId, usuarioId, criadaEm])"); expect(bloco).toContain("@@index([usuarioId, lidaEm])");
  });
});
