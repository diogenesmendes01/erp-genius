import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { configPadrao } from "./config-schema";
import { definirEstadoAria, definirSupervisao, pausarAria, reativarAria, situacaoAria } from "./estado";
import { publicarRascunho, rascunhoAtual, salvarRascunho } from "./versoes";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let admin: Usuario;
let gerente: Usuario;
const logado = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });

async function publicarComPadrao() {
  logado(admin);
  expect((await salvarRascunho({ config: configPadrao(), baseVersaoId: null, rascunho: await rascunhoAtual() })).ok).toBe(true);
  expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(true);
}

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
});

describe("estado operacional da Aria", () => {
  it("nao_liga_sem_versao_publicada", async () => {
    logado(admin);
    expect(await definirEstadoAria("ATIVA")).toEqual({ ok: false, erro: "Publique uma versão antes de ligar a Aria." });
  });

  it("so_admin_muda_estado", async () => {
    await publicarComPadrao();
    logado(gerente);
    expect((await definirEstadoAria("SHADOW")).ok).toBe(false);
  });

  it("admin_muda_estado_e_grava_evento", async () => {
    await publicarComPadrao();
    logado(admin);
    expect((await definirEstadoAria("SHADOW")).ok).toBe(true);
    const s = await situacaoAria();
    expect(s.estado).toBe("SHADOW");
    expect(s.versao?.numero).toBe(1);
    const ev = (await eventosDo("AgenteIA", "aria")).find((e) => e.tipo === "AriaEstadoAlterado");
    expect(ev?.payload).toMatchObject({ de: "DESLIGADA", para: "SHADOW" });
  });

  it("pausa_exige_motivo_e_grava_evento", async () => {
    logado(gerente);
    expect((await pausarAria({ motivo: "" })).ok).toBe(false);
    expect((await pausarAria({ motivo: "Campanha nova" })).ok).toBe(true);
    expect((await situacaoAria()).pausada).toBe(true);
    const ev = (await eventosDo("AgenteIA", "aria")).find((e) => e.tipo === "AriaPausada");
    expect(ev?.payload).toMatchObject({ motivo: "Campanha nova" });
  });

  it("reativa_e_grava_evento", async () => {
    logado(gerente);
    await pausarAria({ motivo: "x" });
    expect((await reativarAria()).ok).toBe(true);
    expect((await situacaoAria()).pausada).toBe(false);
    expect((await eventosDo("AgenteIA", "aria")).some((e) => e.tipo === "AriaReativada")).toBe(true);
    expect((await reativarAria()).ok).toBe(false);
  });

  it("gerente_liga_mas_nao_desliga_supervisao", async () => {
    logado(gerente);
    expect((await definirSupervisao({ ate: new Date(Date.now() + 864e5) })).ok).toBe(true);
    expect((await situacaoAria()).supervisao).toBe(true);
    expect((await definirSupervisao({ ate: null })).ok).toBe(false);
    logado(admin);
    expect((await definirSupervisao({ ate: null })).ok).toBe(true);
    expect((await situacaoAria()).supervisao).toBe(false);
    expect((await eventosDo("AgenteIA", "aria")).filter((e) => e.tipo === "AriaSupervisaoAlterada")).toHaveLength(2);
  });

  it("gerente_nao_encurta_supervisao", async () => {
    logado(gerente);
    const ateDesligar = new Date("9999-12-31T00:00:00Z");
    expect((await definirSupervisao({ ate: ateDesligar })).ok).toBe(true);
    const r = await definirSupervisao({ ate: new Date(Date.now() + 60_000) });
    expect(r.ok).toBe(false);
    expect((await prisma.agenteIA.findUniqueOrThrow({ where: { id: "aria" } })).supervisaoAte).toEqual(ateDesligar);
    expect((await eventosDo("AgenteIA", "aria")).filter((e) => e.tipo === "AriaSupervisaoAlterada")).toHaveLength(1);
    logado(admin);
    expect((await definirSupervisao({ ate: new Date(Date.now() + 60_000) })).ok).toBe(true);
  });

  it("gerente_estende_supervisao_vigente", async () => {
    logado(gerente);
    expect((await definirSupervisao({ ate: new Date(Date.now() + 864e5) })).ok).toBe(true);
    expect((await definirSupervisao({ ate: new Date(Date.now() + 2 * 864e5) })).ok).toBe(true);
  });

  it("supervisao_no_passado_e_rejeitada", async () => {
    logado(admin);
    expect((await definirSupervisao({ ate: new Date(Date.now() - 1000) })).ok).toBe(false);
  });

  it("supervisao_vencida_nao_vale", async () => {
    await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria", supervisaoAte: new Date(Date.now() - 1000) }, update: { supervisaoAte: new Date(Date.now() - 1000) } });
    expect((await situacaoAria()).supervisao).toBe(false);
  });
});
