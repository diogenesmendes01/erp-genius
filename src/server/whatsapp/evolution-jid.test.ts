import { describe, expect, it } from "vitest";
import { descarteInesperado, resolverContatoEvolution } from "./evolution-jid";

describe("resolverContatoEvolution (SPEC-ERP-005 Fase 0)", () => {
  it("conversa 1:1 por telefone", () => {
    expect(resolverContatoEvolution({ remoteJid: "50688887777@s.whatsapp.net" })).toEqual({ waId: "50688887777" });
  });

  it("jid de aparelho vinculado usa só o telefone", () => {
    expect(resolverContatoEvolution({ remoteJid: "50688887777:12@s.whatsapp.net" })).toEqual({ waId: "50688887777" });
  });

  it("LID resolve pelo telefone alternativo em vez de descartar", () => {
    expect(resolverContatoEvolution({ remoteJid: "123456789012345@lid", remoteJidAlt: "50688887777@s.whatsapp.net" }))
      .toEqual({ waId: "50688887777" });
    expect(resolverContatoEvolution({ remoteJid: "123456789012345@lid", senderPn: "5511999990000@s.whatsapp.net" }))
      .toEqual({ waId: "5511999990000" });
  });

  it("LID sem telefone alternativo é descarte inesperado (vai para o log)", () => {
    const r = resolverContatoEvolution({ remoteJid: "123456789012345@lid" });
    expect(r).toEqual({ descarte: "lid_sem_telefone" });
    expect(descarteInesperado("lid_sem_telefone")).toBe(true);
  });

  it("grupo, status e broadcast continuam fora (gap 18) e não poluem o log", () => {
    expect(resolverContatoEvolution({ remoteJid: "1203630@g.us" })).toEqual({ descarte: "grupo" });
    expect(resolverContatoEvolution({ remoteJid: "status@broadcast" })).toEqual({ descarte: "status" });
    expect(resolverContatoEvolution({ remoteJid: "123@broadcast" })).toEqual({ descarte: "broadcast" });
    expect(descarteInesperado("grupo")).toBe(false);
    expect(descarteInesperado("status")).toBe(false);
  });

  it("sem chave ou jid estranho", () => {
    expect(resolverContatoEvolution(undefined)).toEqual({ descarte: "sem_jid" });
    expect(resolverContatoEvolution({ remoteJid: "abc@outro" })).toEqual({ descarte: "jid_desconhecido" });
  });
});
