import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { PREDEFINICOES, configPadrao, type ConfigAria } from "./config-schema";
import {
  descartarRascunho, diffConfig, publicarRascunho, rascunhoAtual, restaurarVersao, salvarRascunho, versaoPublicada,
} from "./versoes";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let admin: Usuario;
let gerente: Usuario;
let vendedor: Usuario;
const logado = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });
const comNome = (nome: string): ConfigAria => ({ ...configPadrao(), nome });
const comMatriz = (matriz: ConfigAria["matriz"]): ConfigAria => ({ ...configPadrao(), matriz });

async function publicarComPadrao() {
  const r = await salvarRascunho({ config: configPadrao(), baseVersaoId: null, rascunho: await rascunhoAtual() });
  expect(r.ok).toBe(true);
  expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(true);
  return (await versaoPublicada())!;
}
async function ultimoEvento(tipo: string) {
  return (await prisma.evento.findFirst({ where: { tipo }, orderBy: { criadoEm: "desc" } }))!;
}

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
  vendedor = await criarUsuario([Papel.VENDEDOR]);
});

describe("versões da Aria", () => {
  it("primeiro_rascunho_parte_do_padrao", async () => {
    logado(admin);
    const r = await salvarRascunho({ config: configPadrao(), baseVersaoId: null, rascunho: await rascunhoAtual() });
    expect(r.ok).toBe(true);
    expect(await eventosDo("VersaoAgenteIA", r.ok ? r.dado!.versaoId : "")).toHaveLength(1);
  });

  it("bloqueio_otimista", async () => {
    logado(admin);
    const pub = await publicarComPadrao();
    expect((await salvarRascunho({ config: configPadrao(), baseVersaoId: pub.id, rascunho: await rascunhoAtual() })).ok).toBe(true);
    const velho = await salvarRascunho({ config: configPadrao(), baseVersaoId: "outra", rascunho: await rascunhoAtual() });
    expect(velho).toEqual({ ok: false, erro: "A configuração mudou desde que você abriu. Recarregue para ver a versão atual." });
    expect((await salvarRascunho({ config: configPadrao(), baseVersaoId: null, rascunho: await rascunhoAtual() })).ok).toBe(false);
  });

  it("rascunho_alterado_por_outra_pessoa_nao_e_sobrescrito", async () => {
    const msg = { ok: false, erro: "O rascunho foi alterado por outra pessoa desde que você abriu. Recarregue para ver a versão atual." };
    logado(admin);
    const pub = await publicarComPadrao();
    // Admin e gerente abrem a tela sem rascunho; o gerente salva primeiro.
    const abertoAdmin = await rascunhoAtual();
    expect(abertoAdmin).toBeNull();
    logado(gerente);
    const doGerente = await salvarRascunho({ config: comNome("Lia"), baseVersaoId: pub.id, rascunho: null });
    expect(doGerente.ok).toBe(true);
    logado(admin);
    expect(await salvarRascunho({ config: comNome("Bia"), baseVersaoId: pub.id, rascunho: abertoAdmin })).toEqual(msg);
    expect(await restaurarVersao(pub.id, abertoAdmin)).toEqual(msg);
    // Quem abriu o rascunho do gerente salva; o token antigo desse rascunho deixa de valer.
    const aberto = await rascunhoAtual();
    expect(aberto?.id).toBe(doGerente.ok ? doGerente.dado!.versaoId : "");
    const salvo = await salvarRascunho({ config: comNome("Bia"), baseVersaoId: pub.id, rascunho: aberto });
    expect(salvo.ok).toBe(true);
    expect(salvo.ok && salvo.dado!.atualizadoEm.getTime()).toBeGreaterThan(aberto!.atualizadoEm.getTime());
    logado(gerente);
    expect(await salvarRascunho({ config: comNome("Lia 2"), baseVersaoId: pub.id, rascunho: aberto })).toEqual(msg);
    expect(await restaurarVersao(pub.id, aberto)).toEqual(msg);
    const final = await prisma.versaoAgenteIA.findFirstOrThrow({ where: { status: "RASCUNHO" } });
    expect((final.config as { nome: string }).nome).toBe("Bia");
    // O token devolvido pelo salvamento serve para o próximo salvamento de quem salvou.
    logado(admin);
    const r = await restaurarVersao(pub.id, salvo.ok ? { id: salvo.dado!.versaoId, atualizadoEm: salvo.dado!.atualizadoEm } : null);
    expect(r.ok).toBe(true);
  });

  it("publicar_numera_arquiva_e_aponta_agente", async () => {
    logado(admin);
    await publicarComPadrao();
    await salvarRascunho({ config: comNome("Lia"), baseVersaoId: (await versaoPublicada())!.id, rascunho: await rascunhoAtual() });
    expect(await publicarRascunho({ nota: "nome", rascunho: await rascunhoAtual() })).toEqual({ ok: true, dado: { numero: 2 } });
    expect(await prisma.versaoAgenteIA.count({ where: { status: "PUBLICADA" } })).toBe(1);
    expect(await prisma.versaoAgenteIA.count({ where: { status: "ARQUIVADA" } })).toBe(1);
    expect((await prisma.agenteIA.findUnique({ where: { id: "aria" } }))!.versaoPublicadaId).toBe((await versaoPublicada())!.id);
    expect((await ultimoEvento("AgenteIAPublicado")).payload).toMatchObject({ numero: 2, diff: ["nome"], nota: "nome" });
  });

  it("publicar_e_descartar_recusam_rascunho_alterado_por_outra_pessoa", async () => {
    const msg = { ok: false, erro: "O rascunho foi alterado por outra pessoa desde que você abriu. Recarregue para ver a versão atual." };
    logado(admin);
    const pub = await publicarComPadrao();
    await salvarRascunho({ config: comNome("Lia"), baseVersaoId: pub.id, rascunho: null });
    // O admin abre a tela com o rascunho "Lia"; o gerente salva por cima antes do admin publicar.
    const abertoAdmin = await rascunhoAtual();
    logado(gerente);
    expect((await salvarRascunho({ config: comNome("Bia"), baseVersaoId: pub.id, rascunho: abertoAdmin })).ok).toBe(true);
    logado(admin);
    expect(await publicarRascunho({ rascunho: abertoAdmin })).toEqual(msg);
    expect(await descartarRascunho(abertoAdmin)).toEqual(msg);
    // Sem token (a tela abriu sem rascunho) também não publica nem descarta o rascunho de outra pessoa.
    expect(await publicarRascunho({ rascunho: null })).toEqual(msg);
    expect(await descartarRascunho(null)).toEqual(msg);
    // Token como string (vindo da tela) e token de rascunho que já não existe.
    const atual = await rascunhoAtual();
    expect(await descartarRascunho({ id: "outro", atualizadoEm: atual!.atualizadoEm.toISOString() })).toEqual(msg);
    const final = await prisma.versaoAgenteIA.findFirstOrThrow({ where: { status: "RASCUNHO" } });
    expect((final.config as { nome: string }).nome).toBe("Bia");
    expect((await versaoPublicada())!.id).toBe(pub.id);
    expect(await prisma.evento.count({ where: { tipo: { in: ["AgenteIARascunhoDescartado"] } } })).toBe(0);
    // Com o token atual (inclusive serializado como string) publica.
    expect(await publicarRascunho({ rascunho: { id: atual!.id, atualizadoEm: atual!.atualizadoEm.toISOString() } })).toEqual({ ok: true, dado: { numero: 2 } });
    // Rascunho já publicado: o token antigo não descarta nada.
    expect(await descartarRascunho(atual)).toEqual(msg);
  });

  it("publicar_sem_rascunho_falha", async () => {
    logado(admin);
    expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(false);
  });

  it("descartar_apaga_rascunho_sem_tocar_publicada", async () => {
    logado(admin);
    const pub = await publicarComPadrao();
    const r = await salvarRascunho({ config: comNome("Lia"), baseVersaoId: pub.id, rascunho: await rascunhoAtual() });
    expect(await descartarRascunho(await rascunhoAtual())).toEqual({ ok: true, dado: undefined });
    expect(await prisma.versaoAgenteIA.count({ where: { status: "RASCUNHO" } })).toBe(0);
    expect((await versaoPublicada())!.id).toBe(pub.id);
    expect((await ultimoEvento("AgenteIARascunhoDescartado")).agregadoId).toBe(r.ok ? r.dado!.versaoId : "");
  });

  it("restaurar_copia_versao_antiga_para_rascunho", async () => {
    logado(admin);
    const v1 = await publicarComPadrao();
    await salvarRascunho({ config: comNome("Lia"), baseVersaoId: v1.id, rascunho: await rascunhoAtual() });
    await publicarRascunho({ rascunho: await rascunhoAtual() });
    const r = await restaurarVersao(v1.id, await rascunhoAtual());
    expect(r.ok).toBe(true);
    const rascunho = await prisma.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
    expect(rascunho!.id).toBe(r.ok ? r.dado!.versaoId : "");
    expect(rascunho!.config).toEqual(v1.config);
    expect(rascunho!.baseVersaoId).toBe((await versaoPublicada())!.id);
    expect((await ultimoEvento("AgenteIAVersaoRestaurada")).payload).toMatchObject({ deVersaoId: v1.id });
    expect((await restaurarVersao(rascunho!.id, await rascunhoAtual())).ok).toBe(false);
  });

  it("gerente_nao_publica_matriz_alterada", async () => {
    logado(admin);
    const pub = await publicarComPadrao();
    logado(gerente);
    expect((await salvarRascunho({ config: comMatriz(PREDEFINICOES.AUTONOMO), baseVersaoId: pub.id, rascunho: await rascunhoAtual() })).ok).toBe(false);
    logado(admin);
    await salvarRascunho({ config: comMatriz(PREDEFINICOES.AUTONOMO), baseVersaoId: pub.id, rascunho: await rascunhoAtual() });
    logado(gerente);
    expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(false);
    expect((await salvarRascunho({ config: comNome("Lia"), baseVersaoId: pub.id, rascunho: await rascunhoAtual() })).ok).toBe(true);
    expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(true);
  });

  it("vendedor_sem_acesso", async () => {
    logado(vendedor);
    expect((await salvarRascunho({ config: configPadrao(), baseVersaoId: null, rascunho: await rascunhoAtual() })).ok).toBe(false);
    expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(false);
    expect((await descartarRascunho(await rascunhoAtual())).ok).toBe(false);
  });

  it("diffConfig_lista_caminhos", () => {
    const a = configPadrao();
    const b = { ...a, nome: "Lia", confianca: { ...a.confianca, executaAPartirDe: 90 }, nuncas: ["x"] };
    expect(diffConfig(a, b)).toEqual(["confianca.executaAPartirDe", "nome", "nuncas"]);
    expect(diffConfig(a, structuredClone(a))).toEqual([]);
  });
});
