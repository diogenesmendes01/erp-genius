import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trava de pré-requisitos da Fase 5: falha se um nome das Fases 1–4 ou o SDK exato faltar.
// Nomes conferidos contra o main d15e0969 (com a 4D #219 e a 4E #221). Divergências do plano (seção 0):
// Tarefa.leadId (plano: oportunidadeId), Tag.ativo (plano: arquivadaEm), PrazoRespostaSetor{finalidade,minutos}
// (plano: ConfigSetorAtendimento{prazoPrimeiraRespostaMin}). O envio do Inbox pelo motor vive em
// whatsapp/motor/acoes-mensagem.ts (plano: whatsapp/envio-inbox.ts). Ainda fora do main (Fase 4F, a reconferir quando
// integrar): NotaAtendimento, NumeroWhatsApp.perfilNome/privacidade/temporariasSegundos e, em drivers/motor.ts,
// atualizarPerfil/atualizarPrivacidade/definirTemporarias.
const raiz = process.cwd();
const schema = readFileSync(join(raiz, "prisma/schema.prisma"), "utf8");
const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

function ler(rel: string): string {
  return readFileSync(join(raiz, rel), "utf8");
}
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
  it("fase4d_inbox_pelo_motor", () => {
    const driver = ler("src/server/whatsapp/drivers/motor.ts");
    expect(driver).toMatch(/export const driverMotor\b/);
    for (const m of ["enviarTexto", "enviarMidia", "enviarConteudo"]) expect(driver).toMatch(new RegExp(`\\b${m}\\(`));
    const acoes = ler("src/server/whatsapp/motor/acoes-mensagem.ts");
    for (const f of ["editarMensagemWhatsApp", "apagarMensagemWhatsApp", "reagirMensagemWhatsApp", "encaminharMensagemWhatsApp", "enviarConteudoInbox", "enviarMensagemGrupo", "bloquearContatoWhatsApp"])
      expect(acoes).toMatch(new RegExp(`export async function ${f}\\(`));
  });
  it("fase4d_inbound_e_eco_celular", () => {
    const msg = ler("src/server/whatsapp/motor/processar-mensagem.ts");
    expect(msg).toMatch(/export async function processarMensagemRecebida\(/);
    expect(msg).toMatch(/export async function processarMensagemEnviada\(/);
    expect(msg).toMatch(/inboundDeEventoMotor\(env, dados, fromMe\)/);
    expect(ler("src/server/whatsapp/inbound.ts")).toMatch(/origem: m\.fromMe \? "CELULAR"/);
    expect(ler("src/server/whatsapp/motor/processar-grupo.ts")).toMatch(/origem: fromMe \? "CELULAR"/);
  });
  it("fase4e_removeu_legados", () => {
    for (const f of ["src/server/whatsapp/drivers/meta-cloud.ts", "src/server/whatsapp/drivers/evolution.ts", "src/server/whatsapp/meta-templates.ts", "src/app/api/whatsapp/webhook/evolution/route.ts", "src/app/api/whatsapp/webhook/meta/route.ts"])
      expect(existsSync(join(raiz, f))).toBe(false);
  });
  it("sdk_com_versao_exata", () => expect(pkg.dependencies["@anthropic-ai/sdk"]).toMatch(/^\d+\.\d+\.\d+$/));
});
