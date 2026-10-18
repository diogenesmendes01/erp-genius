import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ErroPermissao } from "../_shared";
import { PREDEFINICOES, configPadrao, type ConfigAria } from "./config-schema";
import { capacidadesAria, validarAlteracaoPorPapel, type CapacidadeAria } from "./permissoes-tela";

const u = (papeis: Papel[]) => ({ id: "u1", nome: "U", papeis, permissoes: [] as string[] });
const admin = u([Papel.ADMINISTRADOR]);
const gerente = { ...u([Papel.GERENTE_COMERCIAL]), limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null };
const vendedor = u([Papel.VENDEDOR]);
const base = configPadrao();
const comConfianca = (c: ConfigAria, p: Partial<ConfigAria["confianca"]>): ConfigAria => ({ ...c, confianca: { ...c.confianca, ...p } });
const comDesconto = (c: ConfigAria, t: "MATRICULA" | "MENSALIDADE", pct: number): ConfigAria => ({
  ...c, politicas: { ...c.politicas, [t]: { ...c.politicas[t], descontoComAprovacaoPct: pct } },
});

describe("permissoes-tela", () => {
  it("admin_tudo", () => expect(capacidadesAria(admin).size).toBe(11));
  it("gerente_sem_matriz_estado_provedor_desligar", () => {
    const c = capacidadesAria(gerente);
    for (const x of ["editarMatriz", "mudarEstado", "verProvedor", "desligarSupervisao"]) expect(c.has(x as CapacidadeAria)).toBe(false);
    for (const x of ["editarComportamento", "publicar", "pausar", "ligarSupervisao", "decidirHistorico"]) expect(c.has(x as CapacidadeAria)).toBe(true);
  });
  it("vendedor_nada", () => expect(capacidadesAria(vendedor).size).toBe(0));
  it("gerente_nao_muda_matriz", () => expect(() => validarAlteracaoPorPapel(gerente, base, { ...base, matriz: PREDEFINICOES.AUTONOMO })).toThrow(ErroPermissao));
  it("gerente_nao_afrouxa_confianca", () => {
    expect(() => validarAlteracaoPorPapel(gerente, base, comConfianca(base, { executaAPartirDe: 70 }))).toThrow(ErroPermissao);
    expect(() => validarAlteracaoPorPapel(gerente, base, comConfianca(base, { executaAPartirDe: 90 }))).not.toThrow();
    expect(() => validarAlteracaoPorPapel(gerente, base, comConfianca(base, { transfereAbaixoDe: 40 }))).toThrow(ErroPermissao);
    expect(() => validarAlteracaoPorPapel(gerente, base, comConfianca(base, { transfereAbaixoDe: 55 }))).not.toThrow();
  });
  it("gerente_desconto_ate_a_propria_alcada", () => {
    const g = { ...gerente, limiteDescontoMensalidadePct: 15, limiteDescontoTaxaPct: 15 };
    expect(() => validarAlteracaoPorPapel(g, base, comDesconto(base, "MENSALIDADE", 15))).not.toThrow();
    expect(() => validarAlteracaoPorPapel(g, base, comDesconto(base, "MENSALIDADE", 16))).toThrow(ErroPermissao);
    expect(() => validarAlteracaoPorPapel(g, base, comDesconto(base, "MATRICULA", 16))).toThrow(ErroPermissao);
  });
  it("gerente_sem_alcada_nao_sobe_desconto", () =>
    expect(() => validarAlteracaoPorPapel(gerente, base, comDesconto(base, "MATRICULA", 25))).toThrow(ErroPermissao));
  it("admin_pode_tudo", () =>
    expect(() => validarAlteracaoPorPapel({ ...admin, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null }, base, { ...comConfianca(base, { executaAPartirDe: 60 }), matriz: PREDEFINICOES.AUTONOMO })).not.toThrow());
  it("vendedor_nao_altera", () =>
    expect(() => validarAlteracaoPorPapel({ ...vendedor, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null }, base, base)).toThrow(ErroPermissao));
});
