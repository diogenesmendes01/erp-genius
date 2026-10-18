import { DriverWhatsApp } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { recursoDisponivel } from "@/components/conversa/recursos-canal";
import { RECURSOS_MOTOR } from "@/components/conversa/recursos-canal";
import { ErroRegra } from "@/server/_shared/sessao";
import { MSG_MOTOR_DESCONECTADO, MSG_NUMERO_INATIVO, capacidadesDoNumero, exigirMotorConectado } from "./capacidades";

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
    expect(c).toEqual([...RECURSOS_MOTOR]);
  });
  it("Meta e Evolution seguem sem recursos", () => {
    expect(capacidadesDoNumero({ driver: DriverWhatsApp.META_CLOUD, ativo: true, sessao: "CONECTADO" })).toEqual([]);
    expect(capacidadesDoNumero({ driver: DriverWhatsApp.BAILEYS, ativo: true, sessao: "CONECTADO" })).toEqual([]);
  });
  it("recursoDisponivel('MOTOR', 'bloquear') é true", () => expect(recursoDisponivel("MOTOR", "bloquear")).toBe(true));
});

describe("exigirMotorConectado", () => {
  const recusa = (n: Parameters<typeof exigirMotorConectado>[0]) => {
    try { exigirMotorConectado(n); } catch (e) { expect(e).toBeInstanceOf(ErroRegra); return (e as Error).message; }
    return null;
  };
  it("aceita só MOTOR ativo e CONECTADO", () => {
    expect(recusa({ driver: "MOTOR", ativo: true, sessao: "CONECTADO" })).toBeNull();
  });
  it.each(["CAIU", "DESCONECTADO", "AGUARDANDO_QR"] as const)("recusa sessão %s com mensagem amigável", (sessao) => {
    expect(recusa({ driver: "MOTOR", ativo: true, sessao })).toBe(MSG_MOTOR_DESCONECTADO);
  });
  it("recusa número inativo", () => {
    expect(recusa({ driver: "MOTOR", ativo: false, sessao: "CONECTADO" })).toBe(MSG_NUMERO_INATIVO);
  });
  it("recusa driver que não é MOTOR", () => {
    expect(recusa({ driver: DriverWhatsApp.META_CLOUD, ativo: true, sessao: "CONECTADO" })).toBe("Este canal não executa esta ação.");
  });
});
