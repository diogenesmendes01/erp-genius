import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trava de pré-requisitos da Fase 5: falha se um nome das Fases 1–4 ou o SDK exato faltar.
// Nomes conferidos contra o main 6d6d33ee. Divergências do plano (seção 0), a reconferir quando as faixas pendentes integrarem:
// Tarefa.leadId (plano: oportunidadeId), Tag.ativo (plano: arquivadaEm), PrazoRespostaSetor{finalidade,minutos}
// (plano: ConfigSetorAtendimento{prazoPrimeiraRespostaMin}); NotaAtendimento e envio-inbox.ts ainda não existem.
const raiz = process.cwd();
const schema = readFileSync(join(raiz, "prisma/schema.prisma"), "utf8");
const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

function bloco(palavra: "model" | "enum", nome: string): string | null {
  const m = schema.match(new RegExp(`^${palavra} ${nome} \\{([\\s\\S]*?)^\\}`, "m"));
  return m ? m[1] : null;
}
function modelTem(model: string, ...campos: string[]): boolean {
  const b = bloco("model", model);
  if (!b) return false;
  return campos.every((c) => new RegExp(`^\\s*${c}\\s`, "m").test(b));
}
function enumTem(nome: string, ...valores: string[]): boolean {
  const b = bloco("enum", nome);
  if (!b) return false;
  return valores.every((v) => new RegExp(`^\\s*${v}\\b`, "m").test(b));
}

describe("pré-requisitos da Fase 5", () => {
  it("fase1_removeu_copiloto", () => expect(existsSync(join(raiz, "src/server/ia"))).toBe(false));
  it("fase2_nomes", () => {
    expect(schema).toMatch(/model Oportunidade \{[\s\S]*?@@map\("Lead"\)/);
    expect(modelTem("Tarefa", "leadId", "responsavelId", "concluidaEm", "canceladaEm", "origem")).toBe(true);
    expect(modelTem("Tag", "nome", "ativo")).toBe(true);
    expect(modelTem("CampoPersonalizado", "nome", "tipo", "arquivadoEm")).toBe(true);
  });
  it("fase3_nomes", () => {
    expect(modelTem("NumeroSetorWhatsApp", "numeroId", "finalidade")).toBe(true);
    expect(modelTem("AtendimentoWhatsApp", "status", "primeiroInboundEm", "primeiraRespostaEm", "prazoRespostaEm")).toBe(true);
    expect(modelTem("PrazoRespostaSetor", "finalidade", "minutos")).toBe(true);
    expect(modelTem("ConversaWhatsApp", "grupoId")).toBe(true);
    expect(enumTem("OrigemEnvio", "HUMANO", "CELULAR", "IA")).toBe(true);
  });
  it("fase4_motor", () => expect(enumTem("DriverWhatsApp", "MOTOR")).toBe(true));
  it("sdk_com_versao_exata", () => expect(pkg.dependencies["@anthropic-ai/sdk"]).toMatch(/^\d+\.\d+\.\d+$/));
});
