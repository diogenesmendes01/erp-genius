import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { Papel, PrismaClient } from "@prisma/client";
import { Client } from "pg";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { CANAL_INBOX } from "./barramento";
import * as aviso from "./aviso";
import * as dominioTags from "@/server/crm/tags";
import { pessoaDoAtendimento } from "./painel-detalhes";
import { carregarUsuarioFresco } from "@/server/_shared/sessao";
import { atribuirTagNoInbox, removerTagNoInbox, criarEAtribuirTagNoInbox } from "./acoes-painel";
import { alterarTagNaTransacao, criarOuObterTagNaTransacao } from "@/server/crm/tags";
let seq = 0;
beforeEach(async () => { vi.restoreAllMocks(); await truncarBanco(); });
afterAll(() => prisma.$disconnect());
async function cenario() {
  const dono = await criarUsuario([Papel.VENDEDOR]);
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
  await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia324" } });
  const op = await prisma.oportunidade.create({ data: { nome: "Curso fictício324", vendedorDonoId: dono.id, pessoaId: pessoa.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5500000324" + ++seq, pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500001324" + seq, rotulo: "Linha fictícia324", driver: "MOTOR", finalidade: "VENDAS", donoId: dono.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "COMERCIAL::324:" + seq, finalidade: "COMERCIAL", leadId: op.id } });
  const tag = await prisma.tag.create({ data: { nome: "Tag fictícia324", cor: "NEUTRA" } });
  authMock.mockResolvedValue({ user: { id: dono.id } });
  return { dono, gerente, pessoa, op, contato, numero, conversa, a, tag };
}
async function escutar() {
  const client = new Client({ connectionString: process.env.DATABASE_URL }); const quadros: Record<string, unknown>[] = [];
  client.on("notification", n => { if (n.channel === CANAL_INBOX && n.payload) quadros.push(JSON.parse(n.payload)); });
  await client.connect(); await client.query("LISTEN " + CANAL_INBOX);
  return { quadros, sair: () => client.end() };
}
async function sentinela(c: Awaited<ReturnType<typeof cenario>>, quadros: Record<string, unknown>[]) {
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: c.conversa.id, contextoChave: "COMERCIAL::sentinela324:" + ++seq, finalidade: "COMERCIAL", leadId: c.op.id } });
  await aviso.avisarAtendimento(prisma, a.id);
  await vi.waitFor(() => expect(quadros.some(q => q.atendimentoId === a.id)).toBe(true));
}
it("atribuição humana registra autor/Evento e aviso IDs somente; repetição e remoção ausente não avisam", async () => {
  const c = await cenario(), e = await escutar();
  try {
    expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(true);
    expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(true);
    const ausente = await prisma.tag.create({ data: { nome: "Sem vínculo324", cor: "NEUTRA" } });
    expect((await removerTagNoInbox(c.a.id, ausente.id)).ok).toBe(true);
    await sentinela(c, e.quadros);
    expect(await prisma.pessoaTag.findUnique({ where: { pessoaId_tagId: { pessoaId: c.pessoa.id, tagId: c.tag.id } } })).toMatchObject({ criadoPorId: c.dono.id });
    expect(await prisma.evento.count({ where: { tipo: "TagAtribuida", agregadoId: c.pessoa.id } })).toBe(1);
    expect(e.quadros.filter(q => q.atendimentoId === c.a.id)).toEqual([{ tipo: "atendimento.atualizado", atendimentoId: c.a.id, conversaId: c.conversa.id, mensagemId: null }]);
  } finally { await e.sair(); }
});
it("no-op conserva autoria IA e vínculo histórico inativo pode ser removido uma vez", async () => {
  const c = await cenario();
  await prisma.pessoaTag.create({ data: { pessoaId: c.pessoa.id, tagId: c.tag.id } });
  expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(true);
  expect((await prisma.pessoaTag.findFirst())?.criadoPorId).toBeNull();
  expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(0);
  await prisma.tag.update({ where: { id: c.tag.id }, data: { ativo: false } });
  expect((await removerTagNoInbox(c.a.id, c.tag.id)).ok).toBe(true);
  expect((await removerTagNoInbox(c.a.id, c.tag.id)).ok).toBe(true);
  expect(await prisma.evento.count({ where: { tipo: "TagRemovida" } })).toBe(1);
  expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(false);
});
it("gerente cria uma vez com nome trim e reutiliza sem modificar cor/grupo de tag existente", async () => {
  const c = await cenario(); authMock.mockResolvedValue({ user: { id: c.gerente.id } });
  const r1 = await criarEAtribuirTagNoInbox(c.a.id, " Nova324 "), r2 = await criarEAtribuirTagNoInbox(c.a.id, "Nova324");
  expect(r1.ok).toBe(true); expect(r2).toEqual(r1);
  expect(await prisma.tag.count({ where: { nome: "Nova324" } })).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: { in: ["TagCriada", "TagAtribuida"] } } })).toBe(2);
  await prisma.tag.update({ where: { id: c.tag.id }, data: { cor: "INFO", grupo: "Grupo original" } });
  expect((await criarEAtribuirTagNoInbox(c.a.id, c.tag.nome)).ok).toBe(true);
  expect(await prisma.tag.findUnique({ where: { id: c.tag.id } })).toMatchObject({ cor: "INFO", grupo: "Grupo original" });
});
it("vendedor edita da carteira mas não cria, vazio/excesso/inativa não criam vínculo nem Evento", async () => {
  const c = await cenario();
  expect((await criarEAtribuirTagNoInbox(c.a.id, "Negada324")).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: c.gerente.id } });
  for (const nome of [" ", "x".repeat(41)]) expect((await criarEAtribuirTagNoInbox(c.a.id, nome)).ok).toBe(false);
  await prisma.tag.update({ where: { id: c.tag.id }, data: { ativo: false } });
  expect((await criarEAtribuirTagNoInbox(c.a.id, c.tag.nome)).ok).toBe(false);
  expect(await prisma.pessoaTag.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it.each(["sem pessoa", "legal", "linha alheia", "sem lead", "outro setor"] as const)("não altera tags no contexto %s nem usa pessoa do contato como atalho", async caso => {
  const c = await cenario();
  if (caso === "sem pessoa") await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: null } });
  if (caso === "legal") await prisma.responsavel.create({ data: { pessoaId: c.pessoa.id, nome: "Legal fictício324" } });
  if (caso === "linha alheia") await prisma.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: (await criarUsuario([Papel.VENDEDOR])).id } });
  if (caso === "sem lead") await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: null } });
  if (caso === "outro setor") {
    const aluno = await import("@/test/integracao").then(async m => { const cat = await m.seedCatalogoMinimo(); return prisma.aluno.create({ data: { primeiroNome: "Aluno fictício324", paisId: cat.pais.id } }); });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { finalidade: "SECRETARIA", alunoId: aluno.id, contextoChave: "SECRETARIA::324" } });
  }
  expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(false);
  expect((await removerTagNoInbox(c.a.id, c.tag.id)).ok).toBe(false);
  expect(await prisma.pessoaTag.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it("convidado com leitura mas sem contatos.editar e convite revogado não escrevem", async () => {
  const c = await cenario(), leitor = await criarUsuario([Papel.FINANCEIRO]);
  const convite = await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.a.id, usuarioId: leitor.id, concedenteId: c.dono.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3600_000), motivo: "Leitura fictícia324" } });
  authMock.mockResolvedValue({ user: { id: leitor.id } });
  expect((await atribuirTagNoInbox(c.a.id, c.tag.id)).ok).toBe(false);
  await prisma.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: new Date() } });
  expect((await removerTagNoInbox(c.a.id, c.tag.id)).ok).toBe(false);
  expect(await prisma.pessoaTag.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it("rollback após mutação/aviso desfaz tag, vínculo e Eventos sem NOTIFY", async () => {
  const c = await cenario(), e = await escutar(), original = aviso.avisarAtendimento;
  authMock.mockResolvedValue({ user: { id: c.gerente.id } });
  const spy = vi.spyOn(aviso, "avisarAtendimento").mockImplementation(async (db, id) => { await original(db, id); throw new Error("rollback-controlado324"); });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await criarEAtribuirTagNoInbox(c.a.id, "Rollback324")).ok).toBe(false);
    spy.mockRestore(); await sentinela(c, e.quadros);
    expect(await prisma.tag.count({ where: { nome: "Rollback324" } })).toBe(0);
    expect(await prisma.pessoaTag.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
    expect(e.quadros.filter(q => q.atendimentoId === c.a.id)).toEqual([]);
  } finally { spy.mockRestore(); log.mockRestore(); await e.sair(); }
});
it("concorrência real entre conexões: um nome e um Evento por vínculo, autoria não é reescrita", async () => {
  const c = await cenario(); const db2 = new PrismaClient();
  try {
    const criar = (db: typeof prisma | PrismaClient) => db.$transaction(async tx => {
      const t = await criarOuObterTagNaTransacao(tx, c.gerente, { nome: "Concorrente324", cor: "NEUTRA" });
      await alterarTagNaTransacao(tx, c.gerente, { pessoaId: c.pessoa.id, tagId: t.id }, "atribuir"); return t.id;
    }, { timeout: 15000 });
    const ids = await Promise.all([criar(prisma), criar(db2)]);
    expect(ids[0]).toBe(ids[1]); expect(await prisma.tag.count({ where: { nome: "Concorrente324" } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "TagCriada" } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(1);
    expect(await prisma.pessoaTag.count()).toBe(1);
  } finally { await db2.$disconnect(); }
});

it.each(["troca pessoa", "revoga convite"] as const)("revalida contexto depois de aguardar lock real: %s", async caso => {
  const c = await cenario(), holder = new PrismaClient();
  let ator = c.dono, conviteId: string | undefined;
  if (caso === "revoga convite") {
    ator = await criarUsuario([Papel.VENDEDOR]);
    await prisma.oportunidade.create({ data: { nome: "Carteira adicional fictícia324", vendedorDonoId: ator.id, pessoaId: c.pessoa.id } });
    const convite = await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.a.id, usuarioId: ator.id, concedenteId: c.dono.id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 3600000), motivo: "Acesso fictício324" } });
    conviteId = convite.id;
  }
  if (caso === "troca pessoa") await prisma.oportunidade.create({ data: { nome: "Carteira antiga preservada324", vendedorDonoId: ator.id, pessoaId: c.pessoa.id } });
  expect(await pessoaDoAtendimento(ator, c.a.id)).toEqual({ pessoaId: c.pessoa.id, leadId: c.op.id });
  authMock.mockResolvedValue({ user: { id: ator.id } });
  let pronto!: () => void, entrou!: () => void, liberar!: () => void;
  const lockPronto = new Promise<void>(r => { pronto = r; }), entrada = new Promise<void>(r => { entrou = r; }), livre = new Promise<void>(r => { liberar = r; });
  const real = dominioTags.alterarTagNaTransacao;
  const spy = vi.spyOn(dominioTags, "alterarTagNaTransacao").mockImplementation((...args) => { entrou(); return real(...args); });
  try {
    const trava = holder.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["crm-tag-vinculo", "Pessoa", c.pessoa.id, c.tag.id])}, 0))`;
      pronto(); await livre;
      if (caso === "troca pessoa") {
        const outra = await tx.pessoa.create({ data: { nome: "Nova identidade fictícia324" } });
        await tx.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: outra.id } });
      } else await tx.participanteAtendimentoWhatsApp.update({ where: { id: conviteId! }, data: { revogadoEm: new Date() } });
    }, { timeout: 15000 });
    await lockPronto;
    const tentativa = atribuirTagNoInbox(c.a.id, c.tag.id);
    await entrada; liberar(); await trava;
    expect((await tentativa).ok).toBe(false);
    expect(await prisma.pessoaTag.count()).toBe(0); expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(0);
  } finally { liberar?.(); spy.mockRestore(); await holder.$disconnect(); }
});

it("núcleos em duas conexões/pessoas reutilizam nome sem perder vínculos; sessão concorrente não é exercida", async () => {
  const c = await cenario(), db2 = new PrismaClient();
  const pessoa2 = await prisma.pessoa.create({ data: { nome: "Outra pessoa fictícia324" } });
  await prisma.oportunidade.create({ data: { nome: "Outro curso fictício324", pessoaId: pessoa2.id, vendedorDonoId: c.dono.id } });
  const autor = await carregarUsuarioFresco(c.gerente.id);
  if (!autor) throw new Error("Ator real não encontrado.");
  // Ator fresco do banco; os núcleos revalidam capacidade e escopo. Sessão concorrente fica fora deste caso.
  const atribuicoes = (db: typeof prisma | PrismaClient, pessoaId: string) => db.$transaction(async tx => {
    const tag = await criarOuObterTagNaTransacao(tx, autor, { nome: "Compartilhada324", cor: "NEUTRA" });
    await alterarTagNaTransacao(tx, autor, { pessoaId, tagId: tag.id }, "atribuir"); return tag.id;
  }, { timeout: 15000 });
  try {
    const ids = await Promise.all([atribuicoes(prisma, c.pessoa.id), atribuicoes(db2, pessoa2.id)]);
    expect(ids[0]).toBe(ids[1]);
    expect(await prisma.pessoaTag.findMany({ where: { tagId: ids[0] }, orderBy: { pessoaId: "asc" }, select: { pessoaId: true, criadoPorId: true } })).toEqual([c.pessoa.id, pessoa2.id].sort().map(pessoaId => ({ pessoaId, criadoPorId: c.gerente.id })));
    expect(await prisma.evento.count({ where: { tipo: "TagCriada", agregadoId: ids[0] } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(2);
  } finally { await db2.$disconnect(); }
});
