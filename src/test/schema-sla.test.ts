import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SLA (horário de atendimento e alerta de prazo estourado): nomes do schema e da migration.
const raiz = process.cwd();
const schema = readFileSync(join(raiz, "prisma/schema.prisma"), "utf8");
const bloco = (palavra: "model" | "enum", nome: string) => schema.match(new RegExp(`^${palavra} ${nome} \\{([\\s\\S]*?)^\\}`, "m"))?.[1] ?? null;
const modelTem = (model: string, campo: string) => new RegExp(`^\\s*${campo}\\s`, "m").test(bloco("model", model) ?? "");

describe("schema do SLA", () => {
  it("schema_tem_campos_sla", () => {
    expect(modelTem("PrazoRespostaSetor", "horario")).toBe(true);
    expect(modelTem("AtendimentoWhatsApp", "slaAlertadoEm")).toBe(true);
    expect(bloco("enum", "TipoNotificacao")).toMatch(/^\s*SLA_ESTOURADO\b/m);
  });
  it("notificacao_unica_por_usuario", () => {
    expect(bloco("model", "NotificacaoUsuario")).not.toContain("@@unique([tipo, refId, usuarioId, criadaEm])");
    const parcial = readFileSync(join(raiz, "prisma/migrations/20261023170000_notificacao_mencao_unicidade_legada/migration.sql"), "utf8").trim();
    // Mesma garantia para SLA/lembrete; apenas menções têm identidade por nota, sem usar horário.
    expect(parcial).toBe('CREATE UNIQUE INDEX CONCURRENTLY "NotificacaoUsuario_legado_temporal_key" ON "NotificacaoUsuario"("tipo", "refId", "usuarioId", "criadaEm") WHERE "tipo" <> \'MENCAO_NOTA\';');
  });
  it("migration_so_estrutura", () => {
    const pasta = readdirSync(join(raiz, "prisma/migrations")).find((d) => d.endsWith("_sla_horario_alertas"));
    expect(pasta).toBeDefined();
    const sql = readFileSync(join(raiz, "prisma/migrations", pasta!, "migration.sql"), "utf8").replace(/--.*$/gm, "");
    // UPDATE em AtendimentoWhatsApp dispararia notificar_inbox em massa.
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).toContain('"NotificacaoUsuario_tipo_refId_usuarioId_criadaEm_key"');
  });
});
