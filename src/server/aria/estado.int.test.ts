import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const s = await authMock(); const u = s?.user?.id ? await real.carregarUsuarioFresco(s.user.id) : null;
    if (!u) throw new real.ErroAutenticacao(); return u;
  } };
});
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
    expect((await reativarAria()).ok).toBe(true);
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

describe("definirSupervisao: reenvio idêntico não grava (#166, PR #267 B1)", () => {
  const supervisoes = () => prisma.evento.count({ where: { tipo: "AriaSupervisaoAlterada" } });

  it("duas chamadas com o mesmo ate gravam 1 Evento; mudar o ate ainda grava", async () => {
    logado(admin);
    const ate = new Date(Date.now() + 864e5);
    expect((await definirSupervisao({ ate })).ok).toBe(true);
    expect((await definirSupervisao({ ate: new Date(ate.getTime()) })).ok).toBe(true);
    expect(await supervisoes()).toBe(1);
    const depois = new Date(ate.getTime() + 864e5);
    expect((await definirSupervisao({ ate: depois })).ok).toBe(true);
    expect(await supervisoes()).toBe(2);
    expect((await prisma.agenteIA.findUniqueOrThrow({ where: { id: "aria" } })).supervisaoAte?.toISOString()).toBe(depois.toISOString());
  });

  it("desligar duas vezes grava 1 Evento", async () => {
    logado(admin);
    expect((await definirSupervisao({ ate: new Date(Date.now() + 864e5) })).ok).toBe(true);
    expect((await definirSupervisao({ ate: null })).ok).toBe(true);
    expect((await definirSupervisao({ ate: null })).ok).toBe(true);
    expect(await supervisoes()).toBe(2);
  });
});

describe("359: pausa global idempotente e autorização após o lock", () => {
  const quantidade = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "AgenteIA", agregadoId: "aria" } });
  it("pausar_repetido_pelo_mesmo_autor_e_motivo_trim_e_ok_sem_novo_evento", async () => {
    logado(gerente);
    expect((await pausarAria({ motivo: "  Revisão  " })).ok).toBe(true);
    expect((await pausarAria({ motivo: "Revisão" })).ok).toBe(true);
    expect(await quantidade("AriaPausada")).toBe(1);
  });
  it("pausar_ja_pausada_por_outro_ou_motivo_diferente_falha", async () => {
    logado(admin); await pausarAria({ motivo: "Revisão" });
    logado(gerente); expect((await pausarAria({ motivo: "Revisão" })).ok).toBe(false);
    logado(admin); expect((await pausarAria({ motivo: "Outro" })).ok).toBe(false);
    expect(await quantidade("AriaPausada")).toBe(1);
  });
  it("reativar_repetido_mesmo_autor_e_ok_outro_autor_ou_sem_evento_falha", async () => {
    logado(gerente); expect((await reativarAria()).ok).toBe(false);
    await pausarAria({ motivo: "x" });
    expect((await reativarAria()).ok).toBe(true);
    expect((await reativarAria()).ok).toBe(true);
    logado(admin); expect((await reativarAria()).ok).toBe(false);
    expect(await quantidade("AriaReativada")).toBe(1);
  });
  it("concorrência do mesmo autor grava uma pausa e uma reativação", async () => {
    logado(admin);
    expect((await Promise.all([pausarAria({ motivo: "x" }), pausarAria({ motivo: "x" })])).every(r => r.ok)).toBe(true);
    expect(await quantidade("AriaPausada")).toBe(1);
    expect((await Promise.all([reativarAria(), reativarAria()])).every(r => r.ok)).toBe(true);
    expect(await quantidade("AriaReativada")).toBe(1);
  });
  it.each(["pausar", "reativar"] as const)("papel revogado após precheck e lock real impede %s", async verbo => {
    logado(gerente);
    if (verbo === "reativar") await pausarAria({ motivo: "x" });
    let chegou!: () => void, liberar!: () => void;
    const travou = new Promise<void>(r => chegou = r), podeContinuar = new Promise<void>(r => liberar = r);
    let observar = true;
    prisma.$use(async (params, next) => {
      const resultado = await next(params);
      if (observar && params.action === "queryRaw" && JSON.stringify(params.args).includes('AgenteIA')) {
        observar = false; chegou(); await podeContinuar;
      }
      return resultado;
    });
    const chamada = verbo === "pausar" ? pausarAria({ motivo: "revogada" }) : reativarAria();
    try { await travou; await prisma.usuario.update({ where: { id: gerente.id }, data: { papeis: [Papel.VENDEDOR] } }); }
    finally { observar = false; liberar(); }
    expect((await chamada).ok).toBe(false);
    expect((await situacaoAria()).pausada).toBe(verbo === "reativar");
  });
  it("limite500 e papéis existentes são preservados", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR]); logado(vendedor);
    expect((await pausarAria({ motivo: "x" })).ok).toBe(false);
    logado(admin);
    expect((await pausarAria({ motivo: " ".repeat(3) })).ok).toBe(false);
    expect((await pausarAria({ motivo: "x".repeat(501) })).ok).toBe(false);
    expect((await pausarAria({ motivo: "x".repeat(500) })).ok).toBe(true);
  });
});

it("359 revogação durante espera real pelo singleton é relida dentro da TX", async () => {
  logado(gerente); await prisma.agenteIA.create({ data: { id: "aria" } });
  let preso!: () => void, liberar!: () => void;
  const temLock = new Promise<void>(r => preso = r), soltar = new Promise<void>(r => liberar = r);
  let pid = 0;
  const detentor = prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`; pid = rows[0].pid;
    await tx.$queryRaw`SELECT "id" FROM "AgenteIA" WHERE "id"='aria' FOR UPDATE`; preso(); await soltar;
  }, { timeout: 10000 });
  await temLock;
  const chamada = pausarAria({ motivo: "permissão em revisão" });
  try {
    let observou = false; const limite = Date.now() + 3000;
    while (Date.now() < limite) {
      const rows = await prisma.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))) AS espera`;
      if (rows[0].espera) { observou = true; break; }
      await new Promise<void>(r => setImmediate(r));
    }
    expect(observou).toBe(true);
    await prisma.usuario.update({ where: { id: gerente.id }, data: { ativo: false } });
  } finally { liberar(); await detentor; }
  expect((await chamada).ok).toBe(false);
  expect((await situacaoAria()).pausada).toBe(false);
  expect(await prisma.evento.count({where:{tipo:"AriaPausada"}})).toBe(0);
});
