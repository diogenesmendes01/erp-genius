import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf-8");
const bloco = (nome: string) =>
  schema.match(new RegExp(`^(model|enum) ${nome} \\{([\\s\\S]*?)^\\}`, "m"))?.[2] ?? "";

describe("pré-requisitos da Fase 3 para a Fase 4", () => {
  it("Fase 3 entregou os campos que a Fase 4 usa", () => {
    expect(bloco("OrigemEnvio")).toMatch(/\bCELULAR\b/);
    expect(bloco("MensagemWhatsApp")).toMatch(/clientMessageId\s+String\?\s+@unique/);
    for (const c of ["participanteJid", "participanteE164", "participanteNome"]) {
      expect(bloco("MensagemWhatsApp")).toContain(c);
    }
    expect(bloco("GrupoWhatsApp")).toMatch(/@@unique\(\[numeroId, grupoJid\]\)/);
    expect(bloco("ConversaWhatsApp")).toMatch(/grupoId\s+String\?/);
    expect(bloco("AtendimentoWhatsApp")).toContain("primeiraRespostaEm");
  });
});
