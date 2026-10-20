import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo, seedCatalogoMinimo } from "@/test/integracao";
import { MAX_LINHAS_CARTEIRA, carregarCarteira, reatribuirEmLote, type FiltrosCarteira } from "./carteira";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });
const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const base: FiltrosCarteira = { donoId: "", busca: "", semInteracaoDias: "", emTurma: false, tipo: "todos" };

type U = Awaited<ReturnType<typeof criarUsuario>>;
let gerente: U;
let v1: U;
let v2: U;
let v3: U;
let op1: string;
let op2: string;
let opOutraEquipe: string;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const outroGerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  v3 = await criarUsuario([Papel.VENDEDOR], "V3");
  await prisma.usuario.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { gerenteComercialId: gerente.id } });
  await prisma.usuario.update({ where: { id: v3.id }, data: { gerenteComercialId: outroGerente.id } });
  const mk = async (nome: string, dono: string, extra: Record<string, unknown> = {}) =>
    (await prisma.oportunidade.create({ data: { nome, vendedorDonoId: dono, ...extra } as never })).id;
  op1 = await mk("Ana", v1.id);
  op2 = await mk("Bia", v2.id);
  opOutraEquipe = await mk("Carla", v3.id);
  await mk("Perdida", v1.id, { etapa: "PERDIDO" });
  await prisma.coberturaCarteira.create({
    data: { titularId: v1.id, substitutoId: v2.id, inicio: new Date(Date.now() - 86_400_000), fim: new Date("2099-10-20T15:00:00Z"), motivo: "Férias de V1", concedenteId: gerente.id },
  });
});

describe("carregarCarteira", () => {
  it("gerente vê só a equipe; vendedor vê própria + coberta", async () => {
    const r = await carregarCarteira(sessaoDe(gerente), base);
    expect(new Set(r.linhas.map((l) => l.dono!.id))).toEqual(new Set([v1.id, v2.id]));
    expect(r.linhas.map((l) => l.nome).sort()).toEqual(["Ana", "Bia"]);
    expect(r.total).toBe(2);
    expect((await carregarCarteira(sessaoDe(v2), base)).vendedores.map((v) => v.nome)).toEqual(["V2", "V1 (cobertura até 20/10)"]);
    expect((await carregarCarteira(sessaoDe(v2), base)).vendedores.map((v) => v.cobertoPor)).toEqual([null, "V2"]);
  });
  it("dias sem interação usa o último evento; filtros de tipo, turma e busca", async () => {
    await prisma.evento.create({ data: { tipo: "InteracaoRegistrada", agregadoTipo: "Lead", agregadoId: op1, payload: {}, criadoEm: new Date(Date.now() - 20 * 86_400_000) } });
    const r = await carregarCarteira(sessaoDe(gerente), base);
    const ana = r.linhas.find((l) => l.oportunidadeId === op1)!;
    expect(ana.diasSemInteracao).toBeGreaterThanOrEqual(19);
    expect(ana.diasSemInteracao).toBeLessThanOrEqual(20);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, semInteracaoDias: "15" })).linhas.map((l) => l.nome)).toEqual(["Ana"]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, busca: "bia" })).linhas.map((l) => l.nome)).toEqual(["Bia"]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, tipo: "pj" })).linhas).toEqual([]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, emTurma: true })).linhas).toEqual([]);
  });
  it("reatribuição e eventos administrativos não zeram os dias sem interação", async () => {
    const vinteDias = new Date(Date.now() - 20 * 86_400_000);
    await prisma.oportunidade.update({ where: { id: op1 }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    await prisma.evento.create({ data: { tipo: "InteracaoRegistrada", agregadoTipo: "Lead", agregadoId: op1, payload: {}, criadoEm: vinteDias } });
    logadoComo(gerente.id);
    const r = await reatribuirEmLote({ ids: [op1], vendedorId: v2.id, motivo: "Redistribuição" });
    expect(r.ok && r.dado).toMatchObject({ feitas: 1 });
    expect((await eventosDo("Lead", op1)).at(-1)).toMatchObject({ tipo: "LeadAtribuido" });
    for (const tipo of ["TagAtribuida", "TagRemovida", "CampoPersonalizadoAlterado"]) {
      await prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: op1, payload: {} } });
    }
    const ana = (await carregarCarteira(sessaoDe(gerente), base)).linhas.find((l) => l.oportunidadeId === op1)!;
    expect(ana.dono?.id).toBe(v2.id);
    expect(ana.diasSemInteracao).toBeGreaterThanOrEqual(19);
    expect(ana.diasSemInteracao).toBeLessThanOrEqual(20);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, semInteracaoDias: "15" })).linhas.map((l) => l.nome)).toEqual(["Ana"]);
  });
  it("só eventos administrativos: conta desde a criação da oportunidade", async () => {
    await prisma.oportunidade.update({ where: { id: op1 }, data: { criadoEm: new Date(Date.now() - 31 * 86_400_000) } });
    await prisma.evento.create({ data: { tipo: "LeadAtribuido", agregadoTipo: "Lead", agregadoId: op1, payload: {} } });
    const ana = (await carregarCarteira(sessaoDe(gerente), base)).linhas.find((l) => l.oportunidadeId === op1)!;
    expect(ana.diasSemInteracao).toBeGreaterThanOrEqual(30);
  });
  it("lead com só notas e edições depois do último contato: conta desde o último contato real (D13)", async () => {
    await prisma.oportunidade.update({ where: { id: op1 }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    await prisma.evento.create({ data: { tipo: "InteracaoRegistrada", agregadoTipo: "Lead", agregadoId: op1, payload: { canal: "LIGACAO" }, criadoEm: new Date(Date.now() - 20 * 86_400_000) } });
    for (const tipo of ["NotaInterna", "LeadEditado", "DatasAtualizadas", "ResumoAtualizado", "DocumentoAnexado", "ReguaComercialEnviada", "EtapaAlterada"]) {
      await prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: op1, payload: {} } });
    }
    const ana = (await carregarCarteira(sessaoDe(gerente), base)).linhas.find((l) => l.oportunidadeId === op1)!;
    expect(ana.diasSemInteracao).toBeGreaterThanOrEqual(19);
    expect(ana.diasSemInteracao).toBeLessThanOrEqual(20);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, semInteracaoDias: "15" })).linhas.map((l) => l.nome)).toEqual(["Ana"]);
  });
  it("mensagem recebida ou enviada no atendimento da oportunidade é contato; saída que falhou não é (D13)", async () => {
    await prisma.oportunidade.update({ where: { id: op1 }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    await prisma.oportunidade.update({ where: { id: op2 }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955557001", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS" } });
    const mensagem = async (leadId: string, fone: string, dados: { direcao: "ENTRADA" | "SAIDA"; status: "ENVIADA" | "FALHOU" | "LIDA"; dias: number; origem?: "HUMANO" }) => {
      const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: fone, leadId } });
      const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
      const at = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `COMERCIAL:${leadId}`, finalidade: "COMERCIAL", leadId } });
      await prisma.mensagemWhatsApp.create({ data: { conversaId: conversa.id, atendimentoId: at.id, numeroId: numero.id, direcao: dados.direcao, status: dados.status,
        driver: "MOTOR", corpo: "oi", origem: dados.origem ?? null, criadoEm: new Date(Date.now() - dados.dias * 86_400_000) } });
    };
    await mensagem(op1, "+50688887001", { direcao: "ENTRADA", status: "LIDA", dias: 2 });
    await mensagem(op2, "+50688887002", { direcao: "SAIDA", status: "FALHOU", dias: 1, origem: "HUMANO" });
    const linhas = (await carregarCarteira(sessaoDe(gerente), base)).linhas;
    expect(linhas.find((l) => l.oportunidadeId === op1)!.diasSemInteracao).toBeLessThanOrEqual(2);
    expect(linhas.find((l) => l.oportunidadeId === op2)!.diasSemInteracao).toBeGreaterThanOrEqual(39);
  });
  it("só a régua comercial e a Aria falaram depois do último contato: continua sem interação (decisão do dono no #254)", async () => {
    await prisma.oportunidade.update({ where: { id: op1 }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    await prisma.evento.create({ data: { tipo: "InteracaoRegistrada", agregadoTipo: "Lead", agregadoId: op1, payload: { canal: "LIGACAO" }, criadoEm: new Date(Date.now() - 20 * 86_400_000) } });
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955557101", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887101", leadId: op1 } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
    const at = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "COMERCIAL:LINHA", finalidade: "COMERCIAL", leadId: op1 } });
    const saida = (origem: "CRON" | "IA" | "LOTE" | "GESTAO" | "HUMANO" | "CELULAR", dias: number) => prisma.mensagemWhatsApp.create({ data: {
      conversaId: conversa.id, atendimentoId: at.id, numeroId: numero.id, direcao: "SAIDA", status: "LIDA", driver: "MOTOR", corpo: "régua", origem,
      criadoEm: new Date(Date.now() - dias * 86_400_000) } });
    for (const [origem, dias] of [["CRON", 5], ["IA", 3], ["LOTE", 2], ["GESTAO", 1]] as const) await saida(origem, dias);
    const ana = async () => (await carregarCarteira(sessaoDe(gerente), base)).linhas.find((l) => l.oportunidadeId === op1)!.diasSemInteracao;
    expect(await ana()).toBeGreaterThanOrEqual(19);
    expect(await ana()).toBeLessThanOrEqual(20);
    // Enviada por uma pessoa (pela Inbox ou pelo celular) conta.
    await saida("CELULAR", 4);
    expect(await ana()).toBeLessThanOrEqual(4);
    await saida("HUMANO", 1);
    expect(await ana()).toBeLessThanOrEqual(1);
  });
  it("caminho positivo: b2b, turma ativa e tags aparecem nas linhas e nos filtros", async () => {
    const b2b = (await prisma.oportunidade.create({ data: { nome: "Empresa Alfa", vendedorDonoId: v1.id, b2b: true } as never })).id;
    const pessoa = await prisma.pessoa.create({ data: { nome: "Ana Pessoa" } });
    const tag = await prisma.tag.create({ data: { nome: "VIP", cor: "MARCA" } });
    await prisma.pessoaTag.create({ data: { pessoaId: pessoa.id, tagId: tag.id } });
    await prisma.oportunidade.update({ where: { id: op1 }, data: { pessoaId: pessoa.id } });
    const cat = await seedCatalogoMinimo();
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nome: "Turma Salvador", modalidadeId: cat.modalidade.id, nivelId: nivel.id } });
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId: cat.pais.id, status: "ATIVO" } });
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, leadId: op1, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date() },
    });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id } });

    const pj = await carregarCarteira(sessaoDe(gerente), { ...base, tipo: "pj" });
    expect(pj.linhas.map((l) => [l.oportunidadeId, l.tipo])).toEqual([[b2b, "pj"]]);
    const pf = await carregarCarteira(sessaoDe(gerente), { ...base, tipo: "pf" });
    expect(pf.linhas.map((l) => l.oportunidadeId).sort()).toEqual([op1, op2].sort());

    const emTurma = await carregarCarteira(sessaoDe(gerente), { ...base, emTurma: true });
    expect(emTurma.linhas.map((l) => [l.oportunidadeId, l.turmaAtiva])).toEqual([[op1, "Turma Salvador"]]);
    expect(emTurma.linhas[0].tags).toEqual([{ id: tag.id, nome: "VIP", cor: "MARCA" }]);

    const todas = await carregarCarteira(sessaoDe(gerente), base);
    expect(todas.linhas.find((l) => l.oportunidadeId === op2)).toMatchObject({ turmaAtiva: null, tags: [] });
  });
  it("total por vendedor: só abertas do escopo e não muda com os filtros", async () => {
    await prisma.oportunidade.create({ data: { nome: "Bruno", vendedorDonoId: v2.id } as never });
    const totais = (r: Awaited<ReturnType<typeof carregarCarteira>>) => r.vendedores.map((v) => [v.nome, v.total]);
    expect(totais(await carregarCarteira(sessaoDe(gerente), base))).toEqual([["V1", 1], ["V2", 2]]);
    const filtrado = await carregarCarteira(sessaoDe(gerente), { ...base, busca: "ana" });
    expect(totais(filtrado)).toEqual([["V1", 1], ["V2", 2]]);
    expect(filtrado.total).toBe(1);
  });
  it(`corta as linhas em ${MAX_LINHAS_CARTEIRA} e mantém o total completo`, async () => {
    const extra = MAX_LINHAS_CARTEIRA + 3 - 2;
    await prisma.oportunidade.createMany({ data: Array.from({ length: extra }, (_, i) => ({ nome: `Lote ${i}`, vendedorDonoId: v1.id })) as never });
    const r = await carregarCarteira(sessaoDe(gerente), base);
    expect(r.linhas).toHaveLength(MAX_LINHAS_CARTEIRA);
    expect(r.total).toBe(MAX_LINHAS_CARTEIRA + 3);
    expect(r.vendedores.find((v) => v.id === v1.id)?.total).toBe(1 + extra);
  });
});

describe("reatribuirEmLote", () => {
  it("reatribuir exige motivo e respeita equipe", async () => {
    logadoComo(gerente.id);
    expect(await reatribuirEmLote({ ids: [op1], vendedorId: v2.id, motivo: "" })).toEqual({ ok: false, erro: "Informe o motivo (mínimo 5 caracteres)." });
    const r = await reatribuirEmLote({ ids: [op1, opOutraEquipe], vendedorId: v2.id, motivo: "Férias de V1" });
    expect(r.ok && r.dado).toEqual({ feitas: 1, jaEram: 0, recusadas: [{ id: opOutraEquipe, motivo: "Oportunidade fora da sua carteira." }] });
    expect((await eventosDo("Lead", op1)).at(-1)).toMatchObject({ tipo: "LeadAtribuido", payload: { motivo: "Férias de V1" } });
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: op1 } })).vendedorDonoId).toBe(v2.id);
  });
  it("limites de ids e vendedor fora da equipe", async () => {
    logadoComo(gerente.id);
    expect(await reatribuirEmLote({ ids: [], vendedorId: v2.id, motivo: "Férias de V1" })).toMatchObject({ ok: false });
    expect(await reatribuirEmLote({ ids: Array.from({ length: 51 }, (_, i) => `x${i}`), vendedorId: v2.id, motivo: "Férias de V1" })).toEqual({ ok: false, erro: "Selecione no máximo 50 oportunidades." });
    expect(await reatribuirEmLote({ ids: [op1], vendedorId: v2.id, motivo: "x".repeat(1001) })).toMatchObject({ ok: false });
    const r = await reatribuirEmLote({ ids: [op1], vendedorId: v3.id, motivo: "Férias de V1" });
    expect(r.ok && r.dado).toEqual({ feitas: 0, jaEram: 0, recusadas: [{ id: op1, motivo: "O vendedor não pertence à sua equipe." }] });
  });
  it("oportunidade que já é do destino não conta como reatribuída nem grava evento", async () => {
    logadoComo(gerente.id);
    const antes = (await eventosDo("Lead", op2)).length;
    const r = await reatribuirEmLote({ ids: [op1, op2], vendedorId: v2.id, motivo: "Férias de V1" });
    expect(r.ok && r.dado).toEqual({ feitas: 1, jaEram: 1, recusadas: [] });
    expect(await eventosDo("Lead", op2)).toHaveLength(antes);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: op2 } })).vendedorDonoId).toBe(v2.id);
  });
});
