import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { historicoAria, visaoGeralAria } from "./consultas";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });
const agora = new Date("2026-10-18T15:00:00Z");

let seq = 0;
async function lead(cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>, nome: string, donoId: string, numeroId: string) {
  const tel = `+5068${String(1000000 + ++seq)}`;
  const pessoa = await prisma.pessoa.create({ data: { nome } });
  const op = await prisma.oportunidade.create({ data: { nome, paisId: cat.pais.id, telefoneE164: tel, vendedorDonoId: donoId, pessoaId: pessoa.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: tel, leadId: op.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  return { op, at, conversaId: conv.conversaId, numeroId };
}

describe("consultas da tela da Aria", () => {
  let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
  let admin: U, gerente: U, gerenteOutra: U, dono: U, donoOutro: U;
  let numeroId: string;
  let propria: Awaited<ReturnType<typeof lead>>;
  let alheia: Awaited<ReturnType<typeof lead>>;
  const equipe = new Set<string>();

  async function turno(l: typeof propria, resultado: string, quando = agora) {
    const m = await prisma.mensagemWhatsApp.create({
      data: { atendimentoId: l.at.id, conversaId: l.conversaId, numeroId, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: `c-${++seq}` },
    });
    return prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: m.id, atendimentoId: l.at.id, tipo: "ATENDIMENTO", resultado, criadoEm: quando } });
  }
  async function acao(l: typeof propria, turnoId: string, extra: Record<string, unknown> = {}) {
    return prisma.acaoAgenteIA.create({
      data: { turnoId, atendimentoId: l.at.id, oportunidadeId: l.op.id, acao: "TAG", modoConfigurado: "EXECUTA", status: "EXECUTADA", confianca: 90, payload: {}, reversivel: true, criadoEm: agora, ...extra } as never,
    });
  }

  beforeEach(async () => {
    await truncarBanco();
    authMock.mockReset();
    cat = await seedCatalogoMinimo();
    admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
    gerenteOutra = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outra");
    dono = await criarUsuario([Papel.VENDEDOR]);
    donoOutro = await criarUsuario([Papel.VENDEDOR]);
    await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
    await prisma.usuario.update({ where: { id: donoOutro.id }, data: { gerenteComercialId: gerenteOutra.id } });
    numeroId = (await seedCanal({ estado: "ATIVA" })).numero.id;
    propria = await lead(cat, "Maria Silva", dono.id, numeroId);
    alheia = await lead(cat, "Joana Alheia", donoOutro.id, numeroId);
    equipe.clear();
    logado(admin);
  });

  it("taxa_handoff_e_null_sem_conversas", async () => {
    expect((await visaoGeralAria({ dias: 7, agora })).taxaHandoff).toBeNull();
  });

  it("conta_por_turnos_do_periodo", async () => {
    for (let i = 0; i < 3; i++) await turno(propria, "RESPONDEU");
    await turno(propria, "HANDOFF");
    await turno(propria, "RESPONDEU", new Date("2026-09-01T12:00:00Z")); // fora do período
    const v = await visaoGeralAria({ dias: 7, agora });
    expect(v).toMatchObject({ conversas: 4, taxaHandoff: 0.25 });
    expect(v.volume).toHaveLength(7);
    expect(v.volume.at(-1)).toEqual({ dia: "2026-10-18", resolvidas: 3, comHandoff: 1 });
    expect(v.custoUsd).toBe(0);
  });

  it("dias_corridos_respeitam_o_fuso_institucional", async () => {
    await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Costa_Rica" }, update: { fusoInstitucional: "America/Costa_Rica" } });
    // 03:00Z de 18/10 ainda é 17/10 em Costa Rica (UTC-6); cai fora de "hoje" quando agora é 18/10 15:00Z? Não: hoje local = 18/10 00:00-06 = 06:00Z.
    await turno(propria, "RESPONDEU", new Date("2026-10-18T03:00:00Z"));
    await turno(propria, "RESPONDEU", new Date("2026-10-18T07:00:00Z"));
    const v = await visaoGeralAria({ dias: 1, agora });
    expect(v.conversas).toBe(1);
    expect(v.volume).toEqual([{ dia: "2026-10-18", resolvidas: 1, comHandoff: 0 }]);
  });

  it("contadores_de_acoes_e_custo", async () => {
    const t = await turno(propria, "RESPONDEU");
    await acao(propria, t.id, { acao: "MOVER_ETAPA" });
    await acao(propria, t.id, { acao: "CRIAR_TAREFA", status: "APROVADA" });
    await acao(propria, t.id, { acao: "ATUALIZAR_CAMPO" });
    await acao(propria, t.id, { acao: "ATUALIZAR_CAMPO", status: "DESFEITA" });
    await acao(propria, t.id, { acao: "TAG", status: "REJEITADA" });
    await prisma.chamadaIA.create({ data: { origem: "ATENDIMENTO", modelo: "claude-sonnet-5-5", provedor: "anthropic", tokensEntrada: 1, tokensSaida: 1, tokensCache: 0, custoMicroUsd: 2_500_000, latenciaMs: 1, resultado: "OK", criadoEm: agora } });
    const v = await visaoGeralAria({ dias: 7, agora });
    expect(v).toMatchObject({ etapasAvancadas: 1, tarefasCriadas: 1, camposPreenchidos: 1, custoUsd: 2.5, aprovadasSemEdicao: 0.5 });
    expect(v.desfeitas).toBeCloseTo(0.25);
  });

  it("gerente_nao_ve_custo", async () => {
    logado(gerente);
    expect((await visaoGeralAria({ dias: 7, agora })).custoUsd).toBeNull();
  });

  it("gerente_so_conta_a_propria_equipe", async () => {
    await turno(propria, "RESPONDEU");
    await turno(alheia, "RESPONDEU");
    logado(gerente);
    expect((await visaoGeralAria({ dias: 7, agora })).conversas).toBe(1);
  });

  it("vendedor_sem_acesso", async () => {
    logado(dono);
    await expect(visaoGeralAria({ dias: 7, agora })).rejects.toThrow();
    await expect(historicoAria({})).rejects.toThrow();
  });

  it("historico_filtra_e_pagina", async () => {
    const t = await turno(propria, "RESPONDEU");
    const base = agora.getTime();
    await prisma.acaoAgenteIA.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        turnoId: t.id, atendimentoId: propria.at.id, oportunidadeId: propria.op.id, acao: "TAG" as const, modoConfigurado: "EXECUTA",
        status: "EXECUTADA" as const, confianca: 90, payload: {}, reversivel: true, criadoEm: new Date(base - i * 1000),
      })),
    });
    const p1 = await historicoAria({});
    expect(p1.itens).toHaveLength(50);
    expect(p1.proximo).not.toBeNull();
    const p2 = await historicoAria({ cursor: p1.proximo! });
    expect(p2.itens).toHaveLength(10);
    expect(p2.proximo).toBeNull();
    expect(new Set([...p1.itens, ...p2.itens].map((i) => i.id)).size).toBe(60);
    expect(p1.itens[0]).toMatchObject({ contato: "Maria Silva", podeDesfazer: true, motivoIrreversivel: null });
  });

  it("historico_filtros", async () => {
    const t = await turno(propria, "RESPONDEU");
    const a = await acao(propria, t.id, { acao: "MOVER_ETAPA", etapaNoMomento: "NOVO", decididaPorId: admin.id });
    await acao(propria, t.id, { status: "SUGERIDA" });
    await acao(propria, t.id, { status: "DESFEITA" });
    await acao(propria, t.id, { reversivel: false, motivoIrreversivel: "Mensagem já enviada" });
    expect((await historicoAria({ acao: "MOVER_ETAPA" })).itens.map((i) => i.id)).toEqual([a.id]);
    expect((await historicoAria({ etapa: "NOVO" })).itens).toHaveLength(1);
    expect((await historicoAria({ resultado: "PENDENTES" })).itens).toHaveLength(1);
    expect((await historicoAria({ resultado: "DESFEITAS" })).itens[0]?.podeDesfazer).toBe(false);
    expect((await historicoAria({ resultado: "EXECUTADAS" })).itens).toHaveLength(2);
    expect((await historicoAria({ busca: "maria" })).itens).toHaveLength(4);
    expect((await historicoAria({ busca: "inexistente" })).itens).toHaveLength(0);
    const irrev = (await historicoAria({ resultado: "EXECUTADAS" })).itens.find((i) => i.motivoIrreversivel);
    expect(irrev).toMatchObject({ podeDesfazer: false, motivoIrreversivel: "Mensagem já enviada" });
    expect((await historicoAria({ acao: "MOVER_ETAPA" })).itens[0]?.decididaPor).toBe("Admin");
  });

  it("gerente_so_ve_acoes_da_equipe", async () => {
    const t1 = await turno(propria, "RESPONDEU");
    const t2 = await turno(alheia, "RESPONDEU");
    const minha = await acao(propria, t1.id);
    await acao(alheia, t2.id);
    equipe.add(minha.id);
    logado(gerente);
    const r = await historicoAria({});
    expect(r.itens).toHaveLength(1);
    expect(r.itens.every((i) => equipe.has(i.id))).toBe(true);
  });
});
