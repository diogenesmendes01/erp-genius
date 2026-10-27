import { beforeEach, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel, PrismaClient } from "@prisma/client";
import type { ConteudoEspecial } from "./canal";

const { authMock, driver } = vi.hoisted(() => ({
  authMock: vi.fn(),
  driver: { enviarConteudo: vi.fn(), enviarTexto: vi.fn(), enviarMidia: vi.fn(), enviarTemplate: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const id = (await authMock())?.user?.id;
    const u = id ? await real.carregarUsuarioFresco(id) : null;
    if (!u) throw new real.ErroAutenticacao();
    if (real.apenasPortal(u)) throw new real.ErroPermissao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: driver }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { enviarConteudoInbox } from "./motor/acoes-mensagem";
import { assumirConversaDaAria } from "./acoes-atendimento";
import { obterItemListaInbox } from "@/server/inbox/consultas-pagina";
import { carregarUsuarioFresco } from "@/server/_shared/sessao";
import { configPadrao } from "@/server/aria/config-schema";

let c: Awaited<ReturnType<typeof cenario>>;
async function cenario() {
  const admin = await criarUsuario([Papel.ADMINISTRADOR]);
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000446", setores: ["COMERCIAL"], finalidade: "AGENDA" });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao: "CONECTADO" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50680000446" } });
  const at = await prisma.$transaction(tx => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
  const msg = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: at.conversaId, atendimentoId: at.id, direcao: "ENTRADA", driver: "MOTOR", corpo: "Fixture fictícia446" } });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: msg.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "SUGERIU" } });
  await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config: configPadrao(), criadaPorId: admin.id, publicadaPorId: admin.id, publicadaEm: new Date() } });
  await prisma.agenteIA.create({ data: { id: "aria", estado: "ATIVA" } });
  return { admin, numero, contato, at, turno };
}
beforeEach(async () => {
  await truncarBanco();
  vi.clearAllMocks();
  authMock.mockReset();
  c = await cenario();
  authMock.mockResolvedValue({ user: { id: c.admin.id } });
});
async function preparar(estado: "ia" | "aprovacao" | "handoff") {
  if (estado === "aprovacao") await prisma.acaoAgenteIA.create({ data: { atendimentoId: c.at.id, turnoId: c.turno.id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: "SUGERIDA", confianca: 90, reversivel: false, payload: { texto: "Sugestão fictícia446" } } });
  if (estado === "handoff") await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "HANDOFF" } });
}
const tipos = ["ENQUETE", "LOCALIZACAO", "CONTATO", "FIGURINHA", "GIF"] as const;
function entrada(tipo: typeof tipos[number]): { atendimentoId: string; conteudo: ConteudoEspecial; midiaUrl?: string } {
  const base = { atendimentoId: c.at.id };
  if (tipo === "ENQUETE") return { ...base, conteudo: { tipo, nome: "Pergunta fictícia", opcoes: ["Opção A", "Opção B"], maxEscolhas: 1 } };
  if (tipo === "LOCALIZACAO") return { ...base, conteudo: { tipo, latitude: 0, longitude: 0, nome: "Local fictício" } };
  if (tipo === "CONTATO") return { ...base, conteudo: { tipo, contatoJid: "50680000446@s.whatsapp.net" } };
  return { ...base, conteudo: { tipo }, midiaUrl: `/api/files/whatsapp-out/${c.admin.id}/fixture446.${tipo === "FIGURINHA" ? "webp" : "mp4"}` };
}
function semDriver() {
  for (const fn of Object.values(driver)) expect(fn).not.toHaveBeenCalled();
}

it.each((["ia", "aprovacao", "handoff"] as const).flatMap(estado => tipos.map(tipo => ({ estado, tipo }))))(
  "446C1 recusa $estado/$tipo antes da intenção e do driver",
  async ({ estado, tipo }) => {
    await preparar(estado);
    const u = (await carregarUsuarioFresco(c.admin.id))!;
    expect((await obterItemListaInbox(u, c.at.id))?.estadoAria).toBe(estado);
    expect(await enviarConteudoInbox(entrada(tipo))).toEqual({ ok: false, erro: "Assuma a conversa para responder." });
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.at.id, origem: "HUMANO" } })).toBe(0);
    semDriver();
  },
);
it.each(tipos)("446C1 Assumir real permite %s e conserva o conteúdo", async tipo => {
  await preparar("handoff");
  expect((await assumirConversaDaAria(c.at.id)).ok).toBe(true);
  const dados = entrada(tipo);
  expect((await enviarConteudoInbox(dados)).ok).toBe(true);
  const intents = await prisma.intencaoMensagem.findMany({ where: { atendimentoId: c.at.id, origem: "HUMANO" } });
  expect(intents).toHaveLength(1);
  expect(intents[0]).toMatchObject({ conteudo: dados.conteudo, tipo: tipo === "GIF" ? "VIDEO" : tipo, midiaPath: dados.midiaUrl ?? null, autorId: c.admin.id });
  semDriver();
});
it.each(["encerrado", "inativo", "optout", "desconectado", "mime", "posse"] as const)("446C1 preserva a recusa legada %s", async caso => {
  await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
  if (caso === "encerrado") await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { status: "ENCERRADO", encerradoEm: new Date() } });
  if (caso === "inativo") await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: false } });
  if (caso === "optout") await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { optOutEm: new Date() } });
  if (caso === "desconectado") await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { sessao: "DESCONECTADO" } });
  const dados = entrada(caso === "mime" || caso === "posse" ? "FIGURINHA" : "ENQUETE");
  if (caso === "mime") dados.midiaUrl = `/api/files/whatsapp-out/${c.admin.id}/fixture446.mp4`;
  if (caso === "posse") dados.midiaUrl = "/api/files/whatsapp-out/outro/fixture446.webp";
  expect((await enviarConteudoInbox(dados)).ok).toBe(false);
  expect(await prisma.intencaoMensagem.count()).toBe(0);
  semDriver();
});

function sinal() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function esperarBloqueio(pid: number) {
  const ate = Date.now() + 2500;
  while (Date.now() < ate) {
    const [r] = await prisma.$queryRaw<{ espera: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))) AS espera`;
    if (r.espera) return;
    await new Promise<void>(r => setImmediate(r));
  }
  throw new Error("A action não aguardou o lock real do atendimento.");
}
async function duranteEspera(alterar: () => Promise<unknown>) {
  const preso = sinal(), soltar = sinal();
  let pid = 0;
  const holder = prisma.$transaction(async tx => {
    pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
    await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.at.id} FOR NO KEY UPDATE`;
    preso.resolve();
    await soltar.promise;
  }, { timeout: 12000 });
  await preso.promise;
  const chamada = enviarConteudoInbox(entrada("ENQUETE"));
  try {
    await esperarBloqueio(pid);
    await alterar();
  } finally {
    soltar.resolve();
    const finais = await Promise.allSettled([holder, chamada]);
    for (const final of finais) if (final.status === "rejected") throw final.reason;
  }
  return chamada;
}
it.each(["reativada", "config-removida", "ator", "papel-portal", "numero", "optout", "sessao", "canal"] as const)(
  "446C1 relê %s depois de aguardar o lock real",
  async caso => {
    await prisma.configIA.create({ data: { id: "ia", orcamentoMensalUsd: 100 } });
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
    if (caso === "papel-portal") await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.at.id, usuarioId: c.admin.id, concedenteId: c.admin.id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 3600000), podeEnviar: true, motivo: "Convite fictício446" } });
    const resultado = await duranteEspera(() => {
      if (caso === "reativada") return prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "ATIVA" } });
      if (caso === "config-removida") return prisma.configIA.delete({ where: { id: "ia" } });
      if (caso === "ator") return prisma.usuario.update({ where: { id: c.admin.id }, data: { ativo: false } });
      if (caso === "papel-portal") return prisma.usuario.update({ where: { id: c.admin.id }, data: { papeis: [Papel.ALUNO] } });
      if (caso === "optout") return prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { optOutEm: new Date() } });
      return prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: caso === "sessao" ? { sessao: "DESCONECTADO" } : caso === "canal" ? { driver: DriverWhatsApp.BAILEYS } : { ativo: false } });
    });
    expect(resultado.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    if (caso === "config-removida") expect(await prisma.configIA.count()).toBe(0);
    semDriver();
  },
);
it.each(["ENQUETE", "FIGURINHA"] as const)("446C1 pool1 enfileira %s sem pedir conexão global na TX", async tipo => {
  await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "2");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const { enfileirarSaidaInbox } = await import("./enfileirar-inbox");
  const dados = entrada(tipo);
  try {
    const r = await enfileirarSaidaInbox(db, c.admin.id, c.at.id, { tipo: "especial", conteudo: dados.conteudo, midiaUrl: dados.midiaUrl });
    expect(r.id).toBeTypeOf("string");
    expect(await prisma.intencaoMensagem.count({ where: { tipo } })).toBe(1);
    expect(await prisma.configIA.count()).toBe(1);
    semDriver();
  } finally {
    await db.$disconnect();
  }
});
