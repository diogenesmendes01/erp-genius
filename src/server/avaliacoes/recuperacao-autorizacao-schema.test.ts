import { describe, expect, it } from "vitest";
import {
  AutorizacaoEspecialRecuperacaoEntradaSchema,
  AutorizacaoEspecialRecuperacaoSchema,
  decidirVigenciaAutorizacaoEspecialRecuperacao,
} from "./recuperacao-autorizacao-schema";

const entrada = () => ({
  itemReservaId: "item-1",
  motivo: "Gestão liberou a pendência específica.",
  prazoAte: "2026-09-20T12:00:00.000Z",
  chaveIdempotencia: "autorizacao-recuperacao-1",
});

const autorizacao = () => ({
  id: "autorizacao-1",
  matriculaId: "matricula-1",
  alocacaoId: "alocacao-1",
  regraId: "regra-1",
  autorizadorId: "gestor-1",
  autorizadaEm: "2026-09-20T10:00:00.000Z",
  ...entrada(),
});

const realizacao = () => ({
  matriculaId: "matricula-1",
  itemReservaId: "item-1",
  alocacaoId: "alocacao-1",
  regraId: "regra-1",
  realizadaEm: "2026-09-20T11:00:00.000Z",
  autorizadorVigente: true,
});

describe("autorização especial de recuperação", () => {
  it("aceita somente a entrada estrita sem defaults", () => {
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse(entrada()).success).toBe(true);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), extra: true }).success).toBe(false);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), motivo: "abc" }).success).toBe(false);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), prazoAte: "2026-02-30T12:00:00.000Z" }).success).toBe(false);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), prazoAte: "0040-02-29T12:00:00.000Z" }).success).toBe(true);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), prazoAte: "0000-01-01T12:00:00.000Z" }).success).toBe(false);
    expect(AutorizacaoEspecialRecuperacaoEntradaSchema.safeParse({ ...entrada(), prazoAte: "0001-01-01T00:00:00.000+14:00" }).success).toBe(false);
  });

  it("exige uma janela válida no registro persistido", () => {
    expect(AutorizacaoEspecialRecuperacaoSchema.safeParse(autorizacao()).success).toBe(true);
    expect(AutorizacaoEspecialRecuperacaoSchema.safeParse({ ...autorizacao(), prazoAte: "2026-09-20T09:59:59.999Z" }).success).toBe(false);
  });

  it("aceita a realização nos limites inclusivos da autorização", () => {
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), realizadaEm: "2026-09-20T10:00:00.000Z" })).toEqual({ vigente: true });
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), realizadaEm: "2026-09-20T12:00:00.000Z" })).toEqual({ vigente: true });
  });

  it("recusa autorizador não vigente, contexto divergente e datas fora da janela", () => {
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), autorizadorVigente: false })).toEqual({ vigente: false, motivo: "AUTORIZADOR_NAO_VIGENTE" });
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), itemReservaId: "outro-item" })).toEqual({ vigente: false, motivo: "CONTEXTO_DIVERGENTE" });
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), realizadaEm: "2026-09-20T09:59:59.999Z" })).toEqual({ vigente: false, motivo: "ANTES_DA_AUTORIZACAO" });
    expect(decidirVigenciaAutorizacaoEspecialRecuperacao(autorizacao(), { ...realizacao(), realizadaEm: "2026-09-20T12:00:00.001Z" })).toEqual({ vigente: false, motivo: "PRAZO_VENCIDO" });
  });
});
