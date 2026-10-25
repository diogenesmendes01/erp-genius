import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, PrismaClient, type AcaoAgenteIATipo, type Prisma, type StatusAcaoAgenteIA } from "@prisma/client";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import type { Db } from "@/server/whatsapp/escopo";
import { carregarAriaDoAtendimento } from "@/server/whatsapp/consultas-inbox";
import { configPadrao } from "./config-schema";
import { montarContextoTurno } from "./turno/contexto";
import { executarHandoff } from "./turno/handoff";
import { handoffDoAtendimento } from "./handoff-inbox";

beforeEach(truncarBanco);
async function cenario(semLead = false) {
  const cat = await seedCatalogoMinimo();
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outra equipe");
  const convidado = await criarUsuario([Papel.PROFESSOR], "Convidado leitor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Contato ficticio351" } });
  const op = await prisma.oportunidade.create({ data: { nome: "Oportunidade351", paisId: cat.pais.id, vendedorDonoId: vendedor.id, pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50670000351", rotulo: "351 ficticio", driver: "MOTOR", finalidade: "COBRANCA", setores: { create: { finalidade: "COMERCIAL" } } } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50680000351", nomeExibicao: "Contato", leadId: semLead ? null : op.id, pessoaId: pessoa.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const at = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, finalidade: "COMERCIAL", contextoChave: "351", leadId: semLead ? null : op.id } });
  const msg = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: at.id, conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", corpo: "quero uma pessoa", driver: "MOTOR", status: "ENTREGUE", providerMessageId: "351-ancora" } });
  const turno = await prisma.turnoAgenteIA.create({ data: { atendimentoId: at.id, ancoraMensagemId: msg.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" } });
  return { admin, gerente, vendedor, outro, convidado, op, pessoa, numero, conversa, at, turno, base: Date.parse("2026-10-24T10:00:00Z"), pedido: new Date("2026-10-24T11:00:00Z") };
}
type C = Awaited<ReturnType<typeof cenario>>;
const alvo = (c: C, db: Db = prisma) => db.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id }, include: { conversa: { include: { numero: true } } } });
const acao = (c: C, tipo: AcaoAgenteIATipo, payload: Prisma.InputJsonObject, o: { id?: string; em?: Date; opId?: string | null; status?: StatusAcaoAgenteIA; resultado?: Prisma.InputJsonObject } = {}) => prisma.acaoAgenteIA.create({ data: {
  id: o.id, turnoId: c.turno.id, atendimentoId: c.at.id, oportunidadeId: o.opId === undefined ? c.op.id : o.opId,
  acao: tipo, modoConfigurado: "SEMPRE", status: o.status ?? "EXECUTADA", confianca: 90, reversivel: false,
  payload: { ...payload, ...o.resultado }, criadoEm: o.em ?? new Date(c.base),
} });
async function pendente(c: C, o: { responsavelId?: string | null; payload?: Prisma.InputJsonObject; id?: string } = {}) {
  const responsavelId = o.responsavelId === undefined ? c.vendedor.id : o.responsavelId;
  await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: c.pedido, iaPausaMotivo: "HANDOFF", responsavelId } });
  return acao(c, "HANDOFF", o.payload ?? { motivo: "VALOR", destino: responsavelId ? "RESPONSAVEL" : "FILA_SETOR", responsavelId, nota: "Resumo: Quer turma\nPróximo passo: Ligar" }, { id: o.id, em: c.pedido });
}
const ler = async (c: C, u = c.gerente) => handoffDoAtendimento(prisma, u, await alvo(c), new Date());
const convite = (c: C) => prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.at.id, usuarioId: c.convidado.id, concedenteId: c.admin.id, motivo: "351 ficticio", podeEnviar: false, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 3600000) } });

describe("handoff351 no servidor", () => {
  it("executor real fornece nota, destino e tres acoes inclusive resposta de transicao", async () => {
    const c = await cenario();
    await acao(c, "TAG", { nome: "Quente" });
    await acao(c, "MOVER_ETAPA", { para: "QUALIFICADO" }, { em: new Date(c.base + 1) });
    const config = configPadrao(); config.handoff.camposResumo = ["motivo", "resumo", "proximoPasso"];
    const h = await prisma.$transaction(async tx => executarHandoff(tx, { turnoId: c.turno.id, ctx: await montarContextoTurno(c.at.id, tx), motivo: "VALOR", config, simulado: false, resumo: { motivo: "Valor alto", resumo: "Quer turma", proximoPasso: "Ligar" } }));
    const r = await ler(c);
    expect(r).toMatchObject({ acaoId: h.id, motivo: "VALOR", motivoTexto: "Valor alto", destino: "RESPONSAVEL", responsavelNome: "Vendedor", resumo: { quer: "Quer turma", proximoPasso: "Ligar" } });
    expect(r?.feito.map(f => f.texto)).toEqual(["Adicionou a tag Quente", "Moveu para Qualificado", "Respondeu ao contato"]);
    expect(JSON.stringify(r)).not.toContain("payload");
  });
  it("seleciona ultima EXECUTADA com idDESC e nao mistura nota de outro handoff", async () => {
    const c = await cenario(); await pendente(c, { id: "351-h-a" });
    await acao(c, "HANDOFF", { motivo: "CONFIANCA", destino: "USUARIO", responsavelId: c.outro.id, nota: "Resumo: Ultima" }, { id: "351-h-z", em: c.pedido });
    await acao(c, "HANDOFF", { nota: "NAO_VAZAR" }, { status: "SIMULADA", em: new Date(c.pedido.getTime() + 1000) });
    await acao(c, "HANDOFF", { nota: "NAO_VAZAR" }, { status: "BLOQUEADA", em: new Date(c.pedido.getTime() + 2000) });
    expect(await ler(c)).toMatchObject({ acaoId: "351-h-z", motivo: "CONFIANCA", destino: "USUARIO", responsavelNome: "Outra equipe", resumo: { quer: "Ultima", proximoPasso: null } });
  });
  it.each(["constructor", "__proto__", "LEGADO", "TURNO_INTERROMPIDO"])("motivo seguro: %s", async motivo => {
    const c = await cenario(); await pendente(c, { payload: { motivo, destino: "INVALIDO", responsavelId: "ausente", nota: 42 } });
    expect(await ler(c)).toMatchObject({ motivo: motivo === "TURNO_INTERROMPIDO" ? motivo : null, motivoTexto: motivo === "TURNO_INTERROMPIDO" ? "Turno interrompido" : "Motivo não informado", destino: "FILA_SETOR", responsavelNome: null, resumo: null });
  });
  it.each(["HUMANO", "CELULAR"] as const)("resposta %s so encerra quando estritamente posterior", async origem => {
    const c = await cenario(); await pendente(c);
    const m = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: c.at.id, conversaId: c.conversa.id, numeroId: c.numero.id, direcao: "SAIDA", origem, corpo: "fixture", driver: "MOTOR", status: "ENTREGUE", criadoEm: c.pedido } });
    expect(await ler(c)).not.toBeNull(); await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { criadoEm: new Date(c.pedido.getTime() + 1) } }); expect(await ler(c)).toBeNull();
  });
  it("Assumido posterior e encerramento encerram pendencia, sem acao e null", async () => {
    const c = await cenario(); await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: c.pedido, iaPausaMotivo: "HANDOFF" } }); expect(await ler(c)).toBeNull();
    await pendente(c); const e = await prisma.evento.create({ data: { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: c.at.id, autorId: c.admin.id, payload: {}, criadoEm: c.pedido } });
    expect(await ler(c)).not.toBeNull(); await prisma.evento.update({ where: { id: e.id }, data: { criadoEm: new Date(c.pedido.getTime() + 1) } }); expect(await ler(c)).toBeNull();
    await prisma.evento.update({ where: { id: e.id }, data: { criadoEm: c.pedido } });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } }); expect(await ler(c)).toBeNull();
  });
  it("convidado E0 recebe resumo e dados contextuais, campo/tarefa permanecem genericos", async () => {
    const c = await cenario(); await convite(c); await pendente(c);
    await acao(c, "TAG", { nome: "Contextual" });
    await acao(c, "ATUALIZAR_CAMPO", { nomeCampo: "NAO_VAZAR_CAMPO", para: "PRIVADO" }, { em: new Date(c.base + 1) });
    await acao(c, "CRIAR_TAREFA", { titulo: "NAO_VAZAR_TAREFA" }, { em: new Date(c.base + 2) });
    const opFora = await prisma.oportunidade.create({ data: { nome: "Outra", vendedorDonoId: c.outro.id } });
    await acao(c, "TAG", { nome: "NAO_VAZAR_OUTRO_LEAD" }, { opId: opFora.id, em: new Date(c.base + 3) });
    const r = await ler(c, c.convidado);
    expect(r).toMatchObject({ podeAssumir: false, ehResponsavel: false }); expect(r?.resumo?.quer).toBe("Quer turma"); expect(r?.feito.map(f => f.texto)).toEqual(["Adicionou a tag Contextual", "Preencheu um campo", "Criou uma tarefa"]); expect(JSON.stringify(r)).not.toContain("NAO_VAZAR");
  });
  it("tarefa exige payload.tarefaId e escopo atual minhas/fila/equipe em um lote", async () => {
    const c = await cenario(); await pendente(c);
    for (const [n, dono] of [["Propria", c.vendedor.id], ["Fila", null], ["Outra", c.outro.id]] as const) {
      const t = await prisma.tarefa.create({ data: { titulo: n, tipo: "OUTRO", setor: "COMERCIAL", fusoOrigem: "UTC", responsavelId: dono } });
      await acao(c, "CRIAR_TAREFA", { titulo: n }, { resultado: { tarefaId: t.id }, em: new Date(c.base + (n === "Propria" ? 0 : n === "Fila" ? 1 : 2)) });
    }
    await acao(c, "CRIAR_TAREFA", { titulo: "Sem ID" }, { em: new Date(c.base + 3) });
    await acao(c, "CRIAR_TAREFA", { titulo: "ID inexistente" }, { resultado: { tarefaId: "351-nao-existe" }, em: new Date(c.base + 4) });
    const spy = vi.spyOn(prisma.tarefa, "findMany");
    try { expect((await ler(c, c.vendedor))?.feito.map(f => f.texto)).toEqual(["Criou tarefa: Propria", "Criou tarefa: Fila", "Criou uma tarefa", "Criou uma tarefa", "Criou uma tarefa"]); expect(spy).toHaveBeenCalledTimes(1); }
    finally { spy.mockRestore(); }
    expect((await ler(c, c.gerente))?.feito.map(f => f.texto)).toEqual(["Criou tarefa: Propria", "Criou tarefa: Fila", "Criou uma tarefa", "Criou uma tarefa", "Criou uma tarefa"]);
  });
  it("dez ultimas autorizadas apos201 negadas, sem cap e sem N+1, em ordem cronologica", async () => {
    const c = await cenario(); await pendente(c);
    const fora = await prisma.oportunidade.create({ data: { nome: "Fora", vendedorDonoId: c.outro.id } });
    const molde = { turnoId: c.turno.id, atendimentoId: c.at.id, modoConfigurado: "SEMPRE" as const, status: "EXECUTADA" as const, acao: "TAG" as const, confianca: 90, reversivel: false };
    await prisma.acaoAgenteIA.createMany({ data: Array.from({ length: 201 }, (_, n) => ({ ...molde, id: "351-fora-" + String(n).padStart(3, "0"), oportunidadeId: fora.id, payload: { nome: "NAO_VAZAR" }, criadoEm: new Date(c.base + 1000) })) });
    await prisma.acaoAgenteIA.createMany({ data: Array.from({ length: 15 }, (_, n) => ({ ...molde, id: "351-ok-" + String(n).padStart(2, "0"), status: n % 2 ? "APROVADA" as const : "EXECUTADA" as const, oportunidadeId: c.op.id, payload: { nome: String(n).padStart(2, "0") }, criadoEm: new Date(c.base) })) });
    await acao(c, "TAG", { nome: "DEPOIS_NAO" }, { em: new Date(c.pedido.getTime() + 1) });
    await acao(c, "TAG", { nome: "SUGERIDA_NAO" }, { status: "SUGERIDA", em: new Date(c.base + 2000) });
    await acao(c, "TAG", { nome: "DESFEITA_NAO" }, { status: "DESFEITA", em: new Date(c.base + 2000) });
    const spy = vi.spyOn(prisma.oportunidade, "findMany");
    try { const r = await ler(c); expect(r?.feito.map(f => f.texto)).toEqual(Array.from({ length: 10 }, (_, n) => "Adicionou a tag " + String(n + 5).padStart(2, "0"))); expect(spy.mock.calls.length).toBeLessThanOrEqual(4); expect(JSON.stringify(r)).not.toContain("NAO_VAZAR"); }
    finally { spy.mockRestore(); }
  });
  it("sem alvo ou contexto nao renderiza nome e valor de payload", async () => {
    const c = await cenario(true); await pendente(c);
    await acao(c, "TAG", { nome: "NAO_VAZAR" }, { opId: null });
    await acao(c, "ATUALIZAR_CAMPO", { nomeCampo: "NAO_VAZAR", para: "NAO_VAZAR" }, { opId: null, em: new Date(c.base + 1) });
    expect((await ler(c, c.admin))?.feito.map(f => f.texto)).toEqual(["Adicionou uma tag", "Preencheu um campo"]);
  });
  it("assumir fila preserva linha/professor e responsabilidade e da conversa", async () => {
    const c = await cenario(true); await pendente(c, { responsavelId: null });
    expect(await ler(c, c.vendedor)).toMatchObject({ podeAssumir: true, ehResponsavel: false });
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { finalidade: "VENDAS", donoId: c.outro.id } });
    await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.at.id, usuarioId: c.vendedor.id, concedenteId: c.admin.id, motivo: "leitor na linha de outro", podeEnviar: false, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 3600000) } });
    expect(await ler(c, c.vendedor)).toMatchObject({ podeAssumir: false });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { responsavelId: c.vendedor.id } }); expect(await ler(c, c.vendedor)).toMatchObject({ podeAssumir: false, ehResponsavel: true });
  });
  it("wrapper entrega handoff so a leitor autorizado e revoga convite sem negar outra via", async () => {
    const c = await cenario(); const h = await pendente(c); expect(await carregarAriaDoAtendimento(c.convidado, c.at.id)).toBeNull();
    const p = await convite(c); expect((await carregarAriaDoAtendimento(c.convidado, c.at.id))?.handoff?.acaoId).toBe(h.id);
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { fim: new Date(Date.now() - 1000) } }); expect(await carregarAriaDoAtendimento(c.convidado, c.at.id)).toBeNull();
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { fim: new Date(Date.now() + 3600000), revogadoEm: new Date() } }); expect(await carregarAriaDoAtendimento(c.convidado, c.at.id)).toBeNull();
    expect((await carregarAriaDoAtendimento(c.gerente, c.at.id))?.handoff?.acaoId).toBe(h.id);
  });
  it("Db pool1 le nota, nome, tarefa e ACL nao commitados e preserva rollback", async () => {
    const c = await cenario(); await prisma.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: c.outro.id } });
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("connection_limit", "1"); const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
      await expect(db.$transaction(async tx => {
        const u = await tx.usuario.create({ data: { nome: "Nome TX", email: "351-tx@example.test", senhaHash: "fake", papeis: ["VENDEDOR"], gerenteComercialId: c.gerente.id } });
        const tarefa = await tx.tarefa.create({ data: { id: "351-tx-tarefa", titulo: "Tarefa TX", tipo: "OUTRO", setor: "COMERCIAL", fusoOrigem: "UTC", responsavelId: u.id } });
        await tx.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: u.id } });
        await tx.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: c.pedido, iaPausaMotivo: "HANDOFF", responsavelId: u.id } });
        const molde = { turnoId: c.turno.id, atendimentoId: c.at.id, oportunidadeId: c.op.id, modoConfigurado: "SEMPRE" as const, status: "EXECUTADA" as const, confianca: 90, reversivel: false };
        await tx.acaoAgenteIA.create({ data: { ...molde, id: "351-tx-tag", acao: "TAG", payload: { nome: "So TX" }, criadoEm: new Date(c.base) } });
        await tx.acaoAgenteIA.create({ data: { ...molde, id: "351-tx-criar-tarefa", acao: "CRIAR_TAREFA", payload: { titulo: "Tarefa TX", tarefaId: tarefa.id }, criadoEm: new Date(c.base + 1) } });
        await tx.acaoAgenteIA.create({ data: { ...molde, id: "351-tx-h", acao: "HANDOFF", payload: { motivo: "VALOR", destino: "USUARIO", responsavelId: u.id, nota: "Resumo: Apenas TX" }, criadoEm: c.pedido } });
        const r = await handoffDoAtendimento(tx, c.gerente, await alvo(c, tx), new Date());
        expect(r).toMatchObject({ acaoId: "351-tx-h", responsavelNome: "Nome TX", resumo: { quer: "Apenas TX", proximoPasso: null } }); expect(r?.feito.map(f => f.texto)).toEqual(["Adicionou a tag So TX", "Criou tarefa: Tarefa TX"]);
        throw Error("ROLLBACK_351");
      }, { timeout: 10000 })).rejects.toThrow("ROLLBACK_351");
      expect(await db.tarefa.findUnique({ where: { id: "351-tx-tarefa" } })).toBeNull();
      expect(await db.usuario.findUnique({ where: { email: "351-tx@example.test" } })).toBeNull(); expect(await db.acaoAgenteIA.findUnique({ where: { id: "351-tx-h" } })).toBeNull();
    } finally { await db.$disconnect(); }
  });
});
