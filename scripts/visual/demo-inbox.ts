import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { resolverBancoTeste } from "../test-profile.mjs";

export type IdsDemo = Record<"mariana" | "ventura" | "beatriz" | "lucas" | "thiago" | "semNome" | "fernanda", string>;

const BANCOS_DESCARTAVEIS = new Set([
  "erp_genius_test", "erp_genius_test_dev_email", "erp_genius_test_dev_gravacoes", "erp_genius_test_tester", "erp_genius_test_ciint",
]);
const NUMERO = "+5500000000300";
// Somente para reconhecer e reparar a versão antiga desta fixture local.
const NUMERO_LEGADO = "+551140028922";
const ID_NUMERO = "inbox-demo-numero-307";
const IDS: IdsDemo = {
  mariana: "inbox-demo-mariana-307", ventura: "inbox-demo-ventura-307", beatriz: "inbox-demo-beatriz-307",
  lucas: "inbox-demo-lucas-307", thiago: "inbox-demo-thiago-307", semNome: "inbox-demo-sem-nome-307", fernanda: "inbox-demo-fernanda-307",
};

/** Recusa qualquer banco fora dos perfis fechados, inclusive nomes com prefixo semelhante. */
export function exigirBancoDescartavel(url: string): void {
  try {
    const alvo = new URL(url);
    if (["postgres:", "postgresql:"].includes(alvo.protocol) && ["localhost", "127.0.0.1"].includes(alvo.hostname)
      && alvo.port === "54329" && BANCOS_DESCARTAVEIS.has(decodeURIComponent(alvo.pathname.slice(1)))
      && !alvo.search && !alvo.hash) return;
  } catch { /* forma inválida */ }
  throw new Error("A demo do Inbox só roda no banco descartável dos perfis locais em localhost:54329.");
}

type Caso = { chave: keyof IdsDemo; nome: string | null; telefone: string; legado: string; texto: string; dono: "admin" | "joao"; status?: "ABERTO_SEM_RESPONSAVEL" | "EM_ATENDIMENTO" };
const CASOS: Caso[] = [
  { chave: "mariana", nome: "Mariana Costa", telefone: "+5500000000301", legado: "+5511984213307", texto: "Quero saber o valor do Inglês Intensivo B1.", dono: "admin", status: "EM_ATENDIMENTO" },
  { chave: "ventura", nome: "Grupo Ventura", telefone: "+5500000000302", legado: "+5511986213308", texto: "Podemos conversar sobre aulas para a equipe?", dono: "joao" },
  { chave: "beatriz", nome: "Beatriz Lima", telefone: "+5500000000303", legado: "+5511973334521", texto: "Quero matricular meu filho Pedro.", dono: "admin", status: "EM_ATENDIMENTO" },
  { chave: "lucas", nome: "Lucas Andrade", telefone: "+5500000000304", legado: "+5511962224522", texto: "Preciso de ajuda com a matrícula.", dono: "admin" },
  { chave: "thiago", nome: "Thiago Moreira", telefone: "+5500000000305", legado: "+5511951114523", texto: "Podem me chamar amanhã?", dono: "admin" },
  { chave: "semNome", nome: null, telefone: "+5500000000306", legado: "+5511940004524", texto: "Olá", dono: "admin" },
  { chave: "fernanda", nome: "Fernanda Rocha", telefone: "+5500000000307", legado: "+5511939994525", texto: "Gostei da aula experimental.", dono: "joao" },
];

/** Dados locais de demonstração, sem sessão de envio ou integração externa. */
export async function criarDemoInbox(prisma: PrismaClient): Promise<IdsDemo> {
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: "admin@genius.com" } });
  const joao = await prisma.usuario.findUniqueOrThrow({ where: { email: "joao@genius.com" } });
  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    const existente = await tx.numeroWhatsApp.findUnique({ where: { id: ID_NUMERO } });
    const colisao = await tx.numeroWhatsApp.findUnique({ where: { telefoneE164: NUMERO } });
    if ((colisao && colisao.id !== ID_NUMERO) || (existente &&
      (existente.driver !== "BAILEYS" || existente.sessao !== "DESCONECTADO" || ![NUMERO, NUMERO_LEGADO].includes(existente.telefoneE164)))) {
      throw new Error("Número da demo já existe com configuração inesperada.");
    }
    if (existente && existente.telefoneE164 === NUMERO_LEGADO) {
      await tx.numeroWhatsApp.update({ where: { id: ID_NUMERO }, data: { telefoneE164: NUMERO } });
    }
    if (!existente) await tx.numeroWhatsApp.create({ data: {
      id: ID_NUMERO, telefoneE164: NUMERO, rotulo: "Demo Inbox · desconectado", driver: "BAILEYS",
      finalidade: "VENDAS", sessao: "DESCONECTADO", ativo: true, donoId: joao.id,
      setores: { create: [{ finalidade: "COMERCIAL" }, { finalidade: "SECRETARIA" }] },
    } });

    for (const [indice, caso] of CASOS.entries()) {
      const contatoId = `inbox-demo-contato-${caso.chave}-307`;
      const conversaId = `inbox-demo-conversa-${caso.chave}-307`;
      const em = new Date(agora.getTime() - indice * 30 * 60_000);
      const leadId = `inbox-demo-lead-${caso.chave}-307`;
      const contato = await tx.contatoWhatsApp.findUnique({ where: { id: contatoId } });
      const lead = await tx.oportunidade.findUnique({ where: { id: leadId } });
      const conversa = await tx.conversaWhatsApp.findUnique({ where: { id: conversaId } });
      const colisaoContato = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: caso.telefone } });
      if ((contato && (contato.leadId !== leadId || ![caso.telefone, caso.legado].includes(contato.telefoneE164))) ||
        (lead && ![caso.telefone, caso.legado].includes(lead.telefoneE164 ?? "")) ||
        (conversa && (conversa.numeroId !== ID_NUMERO || conversa.contatoId !== contatoId)) ||
        (colisaoContato && colisaoContato.id !== contatoId)) {
        throw new Error("Registro da demo já existe com configuração inesperada.");
      }
      let pessoaId: string | null = null;
      if (caso.chave === "mariana") {
        pessoaId = "inbox-demo-pessoa-mariana-307";
        await tx.pessoa.upsert({ where: { id: pessoaId }, create: { id: pessoaId, nome: caso.nome!, email: "mariana.costa@example.test", origemCanal: "INSTAGRAM" }, update: {} });
      }
      await tx.oportunidade.upsert({ where: { id: leadId }, create: { id: leadId, nome: caso.nome ?? "Contato sem nome", telefoneE164: caso.telefone, vendedorDonoId: caso.dono === "joao" ? joao.id : admin.id, pessoaId }, update: { telefoneE164: caso.telefone } });
      await tx.contatoWhatsApp.upsert({ where: { id: contatoId }, create: { id: contatoId, telefoneE164: caso.telefone, nomeExibicao: caso.nome, leadId, pessoaId }, update: { telefoneE164: caso.telefone } });
      await tx.conversaWhatsApp.upsert({ where: { id: conversaId }, create: { id: conversaId, numeroId: ID_NUMERO, contatoId, ultimaMensagemEm: em, naoLidas: 1 }, update: {} });
      await tx.atendimentoWhatsApp.upsert({ where: { id: IDS[caso.chave] }, create: {
        id: IDS[caso.chave], conversaId, contextoChave: "COMERCIAL:LINHA", finalidade: "COMERCIAL", leadId,
        responsavelId: caso.status === "EM_ATENDIMENTO" ? admin.id : null,
        status: caso.status ?? "ABERTO_SEM_RESPONSAVEL", ultimaMensagemEm: em, ultimoInboundEm: em,
        primeiroInboundEm: em, prazoRespostaEm: new Date(em.getTime() + 15 * 60_000), naoLidas: 1,
      }, update: {} });
      await tx.mensagemWhatsApp.upsert({ where: { id: `inbox-demo-msg-${caso.chave}-307` }, create: {
        id: `inbox-demo-msg-${caso.chave}-307`, conversaId, atendimentoId: IDS[caso.chave], numeroId: ID_NUMERO,
        direcao: "ENTRADA", corpo: caso.texto, driver: "BAILEYS", status: "ENTREGUE", criadoEm: em,
      }, update: {} });
    }

    const beatriz = CASOS.find((c) => c.chave === "beatriz")!;
    const ontem = new Date(agora.getTime() - 26 * 60 * 60_000);
    await tx.mensagemWhatsApp.upsert({ where: { id: "inbox-demo-msg-beatriz-ontem-307" }, create: {
      id: "inbox-demo-msg-beatriz-ontem-307", conversaId: "inbox-demo-conversa-beatriz-307", atendimentoId: IDS.beatriz,
      numeroId: ID_NUMERO, direcao: "ENTRADA", corpo: `Ontem: ${beatriz.texto}`, driver: "BAILEYS", status: "ENTREGUE", criadoEm: ontem,
    }, update: {} });
    await tx.mensagemWhatsApp.upsert({ where: { id: "inbox-demo-msg-beatriz-falhou-307" }, create: {
      id: "inbox-demo-msg-beatriz-falhou-307", conversaId: "inbox-demo-conversa-beatriz-307", atendimentoId: IDS.beatriz,
      numeroId: ID_NUMERO, direcao: "SAIDA", corpo: "Retorno para a família", driver: "BAILEYS", origem: "HUMANO",
      autorId: admin.id, status: "FALHOU", criadoEm: new Date(agora.getTime() - 20 * 60_000),
    }, update: {} });
    await tx.evento.upsert({ where: { id: "inbox-demo-nota-beatriz-307" }, create: { id: "inbox-demo-nota-beatriz-307", tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp",
      agregadoId: IDS.beatriz, autorId: admin.id, payload: { nota: "Família pediu atendimento no período da tarde." }, criadoEm: ontem }, update: {} });

    const pessoaId = "inbox-demo-pessoa-mariana-307";
    for (const [nome, criadoPorId] of [["Inglês", admin.id], ["Adulto", admin.id], ["Noite", null]] as const) {
      const tag = await tx.tag.upsert({ where: { nome }, create: { nome, cor: "INFO" }, update: {} });
      await tx.pessoaTag.upsert({ where: { pessoaId_tagId: { pessoaId, tagId: tag.id } }, create: { pessoaId, tagId: tag.id, criadoPorId }, update: {} });
    }
    await tx.preferenciaConversaUsuario.upsert({ where: { usuarioId_conversaId: { usuarioId: admin.id, conversaId: "inbox-demo-conversa-mariana-307" } }, create: { usuarioId: admin.id, conversaId: "inbox-demo-conversa-mariana-307", fixadaEm: agora }, update: {} });
    await tx.preferenciaConversaUsuario.upsert({ where: { usuarioId_conversaId: { usuarioId: admin.id, conversaId: "inbox-demo-conversa-thiago-307" } }, create: { usuarioId: admin.id, conversaId: "inbox-demo-conversa-thiago-307", silenciadaAte: new Date(agora.getTime() + 8 * 60 * 60_000) }, update: {} });

    const origemId = "inbox-demo-lucas-origem-307";
    await tx.atendimentoWhatsApp.upsert({ where: { id: origemId }, create: { id: origemId, conversaId: "inbox-demo-conversa-lucas-307", contextoChave: "SECRETARIA:TRANSFERIDO",
      finalidade: "SECRETARIA", status: "ENCERRADO", encerradoEm: ontem, ultimaMensagemEm: ontem }, update: {} });
    await tx.atendimentoWhatsApp.updateMany({ where: { id: IDS.lucas, atendimentoOrigemId: null }, data: { atendimentoOrigemId: origemId } });
  });
  return IDS;
}

export function lerOpcoesDemo(args: string[]): { entrada: keyof IdsDemo | null } {
  if (!args.length) return { entrada: null };
  if (args.length !== 2 || args[0] !== "--entrada" || !Object.hasOwn(IDS, args[1]!)) throw new Error("Uso: demo-inbox.ts [--entrada <chave fictícia da demo>]");
  return { entrada: args[1] as keyof IdsDemo };
}
/** Insere somente ENTRADA local; o trigger existente publica mensagem.nova após o commit. */
export async function inserirEntradaDemoInbox(prisma: PrismaClient, chave: string) {
  if (!Object.hasOwn(IDS, chave)) throw new Error("Chave fictícia da demo inválida.");
  const id = IDS[chave as keyof IdsDemo];
  return prisma.$transaction(async (tx) => {
    const a = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, include: { conversa: { include: { numero: true } } } });
    if (a.conversa.numeroId !== ID_NUMERO || a.conversa.contatoId !== "inbox-demo-contato-" + chave + "-307"
      || a.conversa.numero.driver !== "BAILEYS" || a.conversa.numero.sessao !== "DESCONECTADO") throw new Error("Fixture local da demo inválida.");
    const agora = new Date();
    const mensagem = await tx.mensagemWhatsApp.create({ data: {
      id: "inbox-demo-entrada-311-" + randomUUID(), atendimentoId: id, conversaId: a.conversaId, numeroId: ID_NUMERO,
      direcao: "ENTRADA", corpo: "Entrada fictícia #311 para " + chave + ".", driver: "BAILEYS", status: "ENTREGUE", criadoEm: agora,
    } });
    await tx.atendimentoWhatsApp.update({ where: { id }, data: { naoLidas: { increment: 1 }, ultimaMensagemEm: agora, ultimoInboundEm: agora } });
    await tx.conversaWhatsApp.update({ where: { id: a.conversaId }, data: { naoLidas: { increment: 1 }, ultimaMensagemEm: agora } });
    return mensagem;
  });
}

async function main() {
  const opcoes = lerOpcoesDemo(process.argv.slice(2));
  const { url, perfil } = resolverBancoTeste();
  exigirBancoDescartavel(url);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    if (opcoes.entrada) {
      const m = await inserirEntradaDemoInbox(prisma, opcoes.entrada);
      process.stdout.write("Entrada fictícia inserida no perfil " + perfil + ": " + m.id + "\n");
      return;
    }
    const ids = await criarDemoInbox(prisma);
    const destino = path.resolve("tmp/visual/demo-ids.json");
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, JSON.stringify({ perfil, ids }, null, 2) + "\n");
    process.stdout.write(`Demo Inbox preparada no perfil ${perfil}: ${destino}\n`);
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((erro: unknown) => { console.error(erro); process.exitCode = 1; });
}
