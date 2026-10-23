import { describe, expect, it } from "vitest";
import { DriverWhatsApp, SessaoNumero } from "@prisma/client";
import { saudeDoNumero } from "./opcoes-filtro";

describe("saúde pública do número", () => {
  for (const driver of Object.values(DriverWhatsApp)) {
    for (const sessao of Object.values(SessaoNumero)) {
      it(`${driver}/${sessao}: inativo é desconectado`, () => {
        expect(saudeDoNumero({ driver, sessao, ativo: false })).toBe("desconectado");
      });
      it(`${driver}/${sessao}: ativo segue o domínio do canal`, () => {
        const esperada = driver === DriverWhatsApp.META_CLOUD || sessao === SessaoNumero.CONECTADO
          ? "conectado" : sessao === SessaoNumero.DESCONECTADO ? "desconectado" : "instavel";
        expect(saudeDoNumero({ driver, sessao, ativo: true })).toBe(esperada);
      });
    }
  }
});
