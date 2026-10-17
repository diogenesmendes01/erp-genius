import { describe, expect, it } from "vitest";
import { recursoDisponivel } from "@/components/conversa/recursos-canal";
import { capacidadesDoNumero } from "./capacidades";

describe("capacidadesDoNumero", () => {
  it("vazias se a sessão não está CONECTADO", () => {
    expect(capacidadesDoNumero({ driver: "MOTOR", ativo: true, sessao: "CAIU" })).toEqual([]);
    expect(capacidadesDoNumero({ driver: "MOTOR", ativo: true, sessao: "DESCONECTADO" })).toEqual([]);
  });
  it("vazias se o número está inativo", () => {
    expect(capacidadesDoNumero({ driver: "MOTOR", ativo: false, sessao: "CONECTADO" })).toEqual([]);
  });
  it("MOTOR conectado libera todos os recursos da Fase 3", () => {
    const c = capacidadesDoNumero({ driver: "MOTOR", ativo: true, sessao: "CONECTADO" });
    expect(c).toContain("editar");
    expect(c).toContain("bloquear");
    expect(c).toHaveLength(14);
  });
  it("Meta e Evolution seguem sem recursos", () => {
    expect(capacidadesDoNumero({ driver: "META_CLOUD", ativo: true, sessao: "CONECTADO" })).toEqual([]);
    expect(capacidadesDoNumero({ driver: "BAILEYS", ativo: true, sessao: "CONECTADO" })).toEqual([]);
  });
  it("recursoDisponivel('MOTOR', 'bloquear') é true", () => expect(recursoDisponivel("MOTOR", "bloquear")).toBe(true));
});
