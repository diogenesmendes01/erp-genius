"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { atendimentoVisivel } from "../atendimentos";
import { despacharFila, despacharMensagemGrupo } from "../despachante";
import { escopoGrupos, grupoNovoNoEscopo } from "../escopo";
import { randomUUID } from "node:crypto";
import { contentTypePorExtensao } from "@/lib/uploads";
import { midiaSaidaDoAutor } from "../midia";
import type { ConteudoEspecial } from "../canal";
import type { EnvioInboxResultado } from "../acoes";
import { executarAcaoMotor } from "./acoes";
import { ErroMotor, MENSAGEM_LIMITE_RITMO, type CodigoErroMotor } from "./cliente";
import { podeExecutar } from "@/server/inbox/permissoes";
import { exigirMotorConectado } from "./capacidades";

const JANELA_EDICAO_MS = 15 * 60_000;

const EditarSchema = z.object({ mensagemId: z.string().min(1), texto: z.string().trim().min(1, "Escreva o texto.").max(4096, "O texto pode ter no máximo 4096 caracteres.") });
const ApagarSchema = z.object({ mensagemId: z.string().min(1) });

/** Carrega a mensagem própria, de saída pelo motor, dentro do escopo de envio; qualquer falha é ErroRegra sem tocar o motor. */
async function mensagemPropria(mensagemId: string, verbo: "editar" | "apagar") {
  const u = await exigirSessao();
  const m = await prisma.mensagemWhatsApp.findUnique({
    where: { id: mensagemId },
    include: { numero: { select: { id: true, driver: true, providerRef: true, ativo: true, sessao: true } } },
  });
  if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, true))) throw new ErroRegra("Mensagem fora do seu escopo de envio.");
  if (m.direcao !== "SAIDA" || m.autorId !== u.id) throw new ErroRegra(`Só é possível ${verbo} as próprias mensagens.`);
  if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra(`Esta mensagem não pode ser ${verbo === "editar" ? "editada" : "apagada"} neste canal.`);
  if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
  exigirMotorConectado(m.numero);
  return { u, m, numeroRef: m.numero.providerRef ?? m.numero.id, mensagemIdMotor: m.mensagemIdMotor };
}

/** A mensagem própria, no escopo de envio, já foi apagada por este autor pelo ERP? (#166) */
async function apagadaPeloAutor(mensagemId: string): Promise<boolean> {
  const u = await exigirSessao();
  const m = await prisma.mensagemWhatsApp.findUnique({ where: { id: mensagemId }, select: { atendimentoId: true, apagadaEm: true, autorId: true, direcao: true } });
  if (!m?.apagadaEm || !m.atendimentoId || m.direcao !== "SAIDA" || m.autorId !== u.id) return false;
  if (!(await atendimentoVisivel(u, m.atendimentoId, true))) return false;
  return eventoDeApagarDoAutor(prisma, m.atendimentoId, mensagemId, u.id);
}

async function eventoDeApagarDoAutor(db: Prisma.TransactionClient, atendimentoId: string, mensagemId: string, autorId: string): Promise<boolean> {
  const evento = await db.evento.findFirst({
    where: { tipo: "MensagemWhatsAppApagada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId, payload: { path: ["mensagemId"], equals: mensagemId } },
    select: { id: true },
  });
  return !!evento;
}

/** Respostas em que o motor afirma que NÃO executou: só elas autorizam dizer "tente de novo". */
const MOTOR_NAO_EXECUTOU = new Set<CodigoErroMotor>(["SEM_CONFIG", "NAO_ENVIADO", "LIMITE_RITMO", "NAO_AUTORIZADO", "NUMERO_INEXISTENTE", "ACAO_NAO_DISPONIVEL"]);
const MSG_ACAO_NAO_CONFIRMADA = "O WhatsApp não confirmou a ação, e ela pode já ter sido feita. Confira a conversa antes de repetir.";

/**
 * Erro do motor para a tela. Só a recusa explícita (o motor não executou) diz "tente de novo"; timeout, rede,
 * `RESULTADO_INCERTO` e respostas não reconhecidas dizem que a ação pode já ter acontecido (B2 da R2 do #291).
 */
function traduzir(e: unknown): never {
  if (e instanceof ErroMotor) {
    if (e.codigo === "LIMITE_RITMO") throw new ErroRegra(MENSAGEM_LIMITE_RITMO);
    if (MOTOR_NAO_EXECUTOU.has(e.codigo)) throw new ErroRegra("O motor do WhatsApp não executou a ação. Tente de novo em instantes.");
    throw new ErroRegra(MSG_ACAO_NAO_CONFIRMADA);
  }
  throw e;
}

/** A última edição desta mensagem é de `autorId` e deixou exatamente `texto`? (#166) */
async function ultimaEdicaoIgual(db: Prisma.TransactionClient, mensagemId: string, atendimentoId: string, autorId: string, texto: string): Promise<boolean> {
  const ultima = await db.evento.findFirst({
    where: { tipo: "MensagemWhatsAppEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, payload: { path: ["mensagemId"], equals: mensagemId } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { autorId: true, payload: true },
  });
  return ultima?.autorId === autorId && (ultima.payload as { depois?: unknown }).depois === texto;
}

// Tentativa de editar ou apagar (B3 da R2 do #291): a TX1 trava a mensagem e o verbo, reconhece o que já foi feito e
// grava `MensagemWhatsAppAcaoIniciada` antes do motor; a TX2 grava o desfecho. Um pedido que encontra a tentativa
// sem desfecho (o primeiro ainda no motor, ou caiu entre o motor e a TX2) é recusado sem chamar o motor.
const TIPO_ACAO_INICIADA = "MensagemWhatsAppAcaoIniciada";
const TIPO_ACAO_INCERTA = "MensagemWhatsAppAcaoIncerta";
const TIPO_ACAO_NAO_EXECUTADA = "MensagemWhatsAppAcaoNaoExecutada";
const MSG_ACAO_PENDENTE = "Esta ação ainda não foi confirmada pelo WhatsApp. Confira a conversa antes de repetir.";
type VerboMensagem = "editar" | "apagar";

async function abrirTentativaAcao(
  tx: Prisma.TransactionClient,
  alvo: { mensagemId: string; atendimentoId: string; autorId: string; verbo: VerboMensagem; tipoFeito: string; payload?: Record<string, string> },
): Promise<string> {
  const { mensagemId, atendimentoId, autorId, verbo } = alvo;
  const ultima = await tx.evento.findFirst({
    where: { tipo: TIPO_ACAO_INICIADA, agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, AND: [
      { payload: { path: ["mensagemId"], equals: mensagemId } }, { payload: { path: ["verbo"], equals: verbo } }] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true },
  });
  if (ultima) {
    // Edição e apagamento não duplicam nada para o contato: depois de um desfecho (feito, incerto ou recusado),
    // um pedido novo pode chamar o motor de novo. Sem desfecho, não.
    const desfecho = await tx.evento.findFirst({
      where: { tipo: { in: [alvo.tipoFeito, TIPO_ACAO_INCERTA, TIPO_ACAO_NAO_EXECUTADA] }, agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId,
        payload: { path: ["tentativaId"], equals: ultima.id } },
      select: { id: true },
    });
    if (!desfecho) throw new ErroRegra(MSG_ACAO_PENDENTE);
  }
  const tentativa = await registrarEvento(tx, {
    tipo: TIPO_ACAO_INICIADA, agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId,
    payload: { mensagemId, verbo, ...alvo.payload },
  });
  return tentativa.id;
}

async function travarAcaoMensagem(tx: Prisma.TransactionClient, mensagemId: string, verbo: VerboMensagem) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`msg-acao:${mensagemId}:${verbo}`}, 0))`;
  return tx.mensagemWhatsApp.findUniqueOrThrow({ where: { id: mensagemId }, select: { corpo: true, editadaEm: true, apagadaEm: true } });
}

/** Falha do motor depois da tentativa gravada: registra o desfecho e devolve a mensagem certa à tela. */
async function fecharTentativaComFalha(alvo: { mensagemId: string; atendimentoId: string; autorId: string; tentativaId: string }, e: unknown): Promise<never> {
  const naoExecutou = e instanceof ErroMotor && MOTOR_NAO_EXECUTOU.has(e.codigo);
  await prisma.$transaction((tx) => registrarEvento(tx, {
    tipo: naoExecutou ? TIPO_ACAO_NAO_EXECUTADA : TIPO_ACAO_INCERTA, agregadoTipo: "AtendimentoWhatsApp", agregadoId: alvo.atendimentoId, autorId: alvo.autorId,
    payload: { mensagemId: alvo.mensagemId, tentativaId: alvo.tentativaId, codigo: e instanceof ErroMotor ? e.codigo : "ERRO" },
  }));
  return traduzir(e instanceof ErroMotor ? e : new ErroMotor("RESULTADO_INCERTO", 0));
}

/**
 * Edita a própria mensagem de texto até 15 min depois do envio (message.edit no motor).
 * Idempotente por natureza (#166): se a última edição já deixou o mesmo texto, devolve ok sem chamar o motor nem
 * gravar outro Evento (antes das checagens de tipo e de janela, para o reenvio tardio também). Dois pedidos
 * simultâneos geram uma chamada ao motor: a tentativa é gravada antes dela, sob a trava da mensagem.
 */
export async function editarMensagemWhatsApp(input: { mensagemId: string; texto: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = EditarSchema.parse(input);
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "editar");
    const atendimentoId = m.atendimentoId!;
    const aberto = await prisma.$transaction(async (tx) => {
      const atual = await travarAcaoMensagem(tx, m.id, "editar");
      if (atual.editadaEm && atual.corpo === dados.texto && await ultimaEdicaoIgual(tx, m.id, atendimentoId, u.id, dados.texto)) return null;
      if (atual.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
      if (m.tipo !== "TEXTO") throw new ErroRegra("Só é possível editar mensagens de texto.");
      if (Date.now() - m.criadoEm.getTime() > JANELA_EDICAO_MS) throw new ErroRegra("Só é possível editar até 15 minutos após o envio.");
      const tentativaId = await abrirTentativaAcao(tx, { mensagemId: m.id, atendimentoId, autorId: u.id, verbo: "editar", tipoFeito: "MensagemWhatsAppEditada", payload: { texto: dados.texto } });
      return { tentativaId, antes: atual.corpo };
    });
    if (!aberto) return undefined;
    try {
      await executarAcaoMotor(numeroRef, "message.edit", { messageId: mensagemIdMotor, text: dados.texto }, { origem: "HUMANO" });
    } catch (e) { await fecharTentativaComFalha({ mensagemId: m.id, atendimentoId, autorId: u.id, tentativaId: aberto.tentativaId }, e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { corpo: dados.texto, editadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId: u.id,
        payload: { mensagemId: m.id, antes: aberto.antes, depois: dados.texto, tentativaId: aberto.tentativaId },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

/**
 * Apaga para todos a própria mensagem (message.delete no motor); o corpo fica guardado, só `apagadaEm` marca.
 * Idempotente por natureza (#166): se quem repete já a apagou pelo ERP, devolve ok sem chamar o motor nem gravar
 * outro Evento. Apagada fora do ERP (pelo celular), segue "já foi apagada". Dois pedidos simultâneos geram uma
 * chamada ao motor: a tentativa é gravada antes dela, sob a trava da mensagem.
 */
export async function apagarMensagemWhatsApp(input: { mensagemId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ApagarSchema.parse(input);
    if (await apagadaPeloAutor(dados.mensagemId)) return undefined;
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "apagar");
    const atendimentoId = m.atendimentoId!;
    const tentativaId = await prisma.$transaction(async (tx) => {
      const atual = await travarAcaoMensagem(tx, m.id, "apagar");
      if (atual.apagadaEm) {
        if (await eventoDeApagarDoAutor(tx, atendimentoId, m.id, u.id)) return null;
        throw new ErroRegra("Esta mensagem já foi apagada.");
      }
      return abrirTentativaAcao(tx, { mensagemId: m.id, atendimentoId, autorId: u.id, verbo: "apagar", tipoFeito: "MensagemWhatsAppApagada" });
    });
    if (!tentativaId) return undefined;
    try {
      await executarAcaoMotor(numeroRef, "message.delete", { messageId: mensagemIdMotor, forEveryone: true }, { origem: "HUMANO" });
    } catch (e) { await fecharTentativaComFalha({ mensagemId: m.id, atendimentoId, autorId: u.id, tentativaId }, e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppApagada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId: u.id,
        payload: { mensagemId: m.id, mensagemIdMotor, tentativaId },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

const ReagirSchema = z.object({ mensagemId: z.string().min(1), emoji: z.string().max(32, "A reação pode ter no máximo 32 caracteres.") });
const EncaminharSchema = z.object({ mensagemId: z.string().min(1), atendimentoDestinoId: z.string().min(1), chaveIdempotencia: ChaveIdempotenciaSchema.optional() });

/** Reação do atendente: `autorJid` provisório até o eco do motor (que reaproveita a linha `deMim`). `""` remove. */
export async function reagirMensagemWhatsApp(input: { mensagemId: string; emoji: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ReagirSchema.parse(input);
    const u = await exigirSessao();
    const m = await prisma.mensagemWhatsApp.findUnique({
      where: { id: dados.mensagemId },
      include: { numero: { select: { id: true, driver: true, providerRef: true, ativo: true, sessao: true } } },
    });
    if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, true))) throw new ErroRegra("Mensagem fora do seu escopo de envio.");
    if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra("Esta mensagem não pode receber reação neste canal.");
    if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
    exigirMotorConectado(m.numero);
    try {
      await executarAcaoMotor(m.numero.providerRef ?? m.numero.id, "message.react", { messageId: m.mensagemIdMotor, emoji: dados.emoji }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    const minha = await prisma.reacaoMensagemWhatsApp.findFirst({ where: { mensagemId: m.id, deMim: true } });
    if (!dados.emoji) {
      await prisma.reacaoMensagemWhatsApp.deleteMany({ where: { mensagemId: m.id, deMim: true } });
    } else if (minha) {
      await prisma.reacaoMensagemWhatsApp.update({ where: { id: minha.id }, data: { emoji: dados.emoji, usuarioId: u.id } });
    } else {
      await prisma.reacaoMensagemWhatsApp.create({ data: { mensagemId: m.id, autorJid: `erp:${m.numero.id}`, deMim: true, emoji: dados.emoji, usuarioId: u.id } });
    }
    revalidatePath("/inbox");
    return undefined;
  });
}

const AGREGADO_ATENDIMENTO = "AtendimentoWhatsApp" as const;
const TIPO_TENTATIVA_ENCAMINHAR = "MensagemWhatsAppEncaminhamentoIniciado";
const TIPO_ENCAMINHADA = "MensagemWhatsAppEncaminhada";
const TIPO_ENCAMINHAMENTO_INCERTO = "MensagemWhatsAppEncaminhamentoIncerto";
const TIPO_ENCAMINHAMENTO_NAO_ENVIADO = "MensagemWhatsAppEncaminhamentoNaoEnviado";
const MSG_ENCAMINHAMENTO_EM_ANDAMENTO = "O resultado deste encaminhamento ainda não foi confirmado. Confira a conversa de destino antes de repetir: a mensagem pode já ter chegado.";
const MSG_ENCAMINHAMENTO_INCERTO = "O WhatsApp não confirmou o encaminhamento, e a mensagem pode já ter chegado. Confira a conversa de destino; para encaminhar de novo, feche e abra o encaminhamento.";

type Sessao = Awaited<ReturnType<typeof exigirSessao>>;

/** Origem própria e visível, destino no escopo de envio, mesmo número e motor conectado; lê tudo em `db`. */
async function conferirEncaminhamento(u: Sessao, dados: { mensagemId: string; atendimentoDestinoId: string }, db: Prisma.TransactionClient) {
  const m = await db.mensagemWhatsApp.findUnique({
    where: { id: dados.mensagemId },
    include: { numero: { select: { id: true, driver: true, providerRef: true, ativo: true, sessao: true } } },
  });
  if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, false, db))) throw new ErroRegra("Mensagem de origem fora do seu escopo.");
  if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra("Esta mensagem não pode ser encaminhada neste canal.");
  if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
  const d = await atendimentoVisivel(u, dados.atendimentoDestinoId, true, db);
  if (!d || d.encerradoEm) throw new ErroRegra("Destino fora do seu escopo.");
  if (!d.numero.ativo) throw new ErroRegra("O destino está em número inativo.");
  if (d.contato.optOutEm) throw new ErroRegra("O destino pediu para não receber mensagens (opt-out).");
  if (d.numeroId !== m.numeroId) throw new ErroRegra("Encaminhe só entre conversas do mesmo número.");
  exigirMotorConectado(m.numero);
  const digitos = (d.contato.waId ?? d.contato.telefoneE164).replace(/\D/g, "");
  return { m: { ...m, atendimentoId: m.atendimentoId, mensagemIdMotor: m.mensagemIdMotor }, d, chatId: `${digitos}@s.whatsapp.net`, numeroRef: m.numero.providerRef ?? m.numero.id };
}
type Encaminhamento = Awaited<ReturnType<typeof conferirEncaminhamento>>;
type RespostaEncaminhar = { key?: { id?: string; remoteJid?: string } } | undefined;

function chamarMotorEncaminhar(c: Encaminhamento): Promise<RespostaEncaminhar> {
  return executarAcaoMotor(c.numeroRef, "message.forward", { messageId: c.m.mensagemIdMotor, chatId: c.chatId }, { origem: "HUMANO" });
}

/** Grava a mensagem no destino (o eco do celular pode ter chegado antes: o upsert não duplica) e o Evento. */
async function gravarEncaminhada(tx: Prisma.TransactionClient, u: Sessao, c: Encaminhamento, resp: RespostaEncaminhar, tentativaId: string | null) {
  const { m, d, chatId } = c;
  const providerMessageId = resp?.key?.id ?? null;
  const mensagemIdMotor = providerMessageId ? `${resp?.key?.remoteJid ?? chatId}:${providerMessageId}` : null;
  let destinoMensagemId: string | null = null;
  if (providerMessageId) {
    const agora = new Date();
    const gravada = await tx.mensagemWhatsApp.upsert({
      where: { numeroId_providerMessageId: { numeroId: m.numeroId, providerMessageId } },
      create: {
        conversaId: d.transporteId, numeroId: m.numeroId, atendimentoId: d.id, direcao: "SAIDA", tipo: m.tipo, corpo: m.corpo, midiaPath: m.midiaPath,
        status: "ENVIADA", statusEm: agora, enviadaEm: agora, driver: "MOTOR", origem: "HUMANO", providerMessageId, mensagemIdMotor, autorId: u.id, criadoEm: agora,
      },
      update: { origem: "HUMANO", autorId: u.id, atendimentoId: d.id, conversaId: d.transporteId, ...(mensagemIdMotor ? { mensagemIdMotor } : {}) },
    });
    destinoMensagemId = gravada.id;
    await tx.conversaWhatsApp.updateMany({ where: { id: d.transporteId, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: gravada.criadoEm } }] }, data: { ultimaMensagemEm: gravada.criadoEm } });
  }
  await registrarEvento(tx, {
    tipo: TIPO_ENCAMINHADA, agregadoTipo: AGREGADO_ATENDIMENTO, agregadoId: m.atendimentoId, autorId: u.id,
    payload: { mensagemId: m.id, atendimentoDestinoId: d.id, destinoMensagemId, providerMessageId, ...(tentativaId ? { tentativaId } : {}) },
  });
}

/**
 * Desfecho da última tentativa desta chave (#166): `null` libera nova tentativa (o motor afirmou que não executou);
 * "ok" é o encaminhamento já feito; os demais casos são recusados sem chamar o motor.
 */
async function desfechoDaChave(tx: Prisma.TransactionClient, primeira: { agregadoId: string }, autorId: string, chave: string): Promise<"ok" | null> {
  const ultima = await tx.evento.findFirst({
    where: { tipo: TIPO_TENTATIVA_ENCAMINHAR, agregadoTipo: AGREGADO_ATENDIMENTO, agregadoId: primeira.agregadoId, autorId, payload: { path: ["chaveIdempotencia"], equals: chave } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true },
  });
  const desfecho = ultima && await tx.evento.findFirst({
    where: { tipo: { in: [TIPO_ENCAMINHADA, TIPO_ENCAMINHAMENTO_INCERTO, TIPO_ENCAMINHAMENTO_NAO_ENVIADO] }, agregadoTipo: AGREGADO_ATENDIMENTO, agregadoId: primeira.agregadoId, payload: { path: ["tentativaId"], equals: ultima.id } },
    select: { tipo: true },
  });
  if (!desfecho) throw new ErroRegra(MSG_ENCAMINHAMENTO_EM_ANDAMENTO);
  if (desfecho.tipo === TIPO_ENCAMINHADA) return "ok";
  if (desfecho.tipo === TIPO_ENCAMINHAMENTO_INCERTO) throw new ErroRegra(MSG_ENCAMINHAMENTO_INCERTO);
  return null;
}

/**
 * Encaminha pelo motor (message.forward) para outra conversa do MESMO número e registra a mensagem como HUMANO.
 * Com `chaveIdempotencia` (#166), no padrão do envio de assinatura (#288): a TX1 confere tudo e grava a tentativa
 * (`MensagemWhatsAppEncaminhamentoIniciado`, com a marca) sob a trava da chave; o motor é chamado FORA de transação; a
 * TX2 grava o resultado. Falha de rede, timeout ou resposta ambígua do motor viram `...EncaminhamentoIncerto`; a
 * recusa explícita do motor (não executou), `...EncaminhamentoNaoEnviado`. O reenvio da mesma chave devolve ok se já
 * encaminhou, recusa com "em andamento" ou "incerto" sem chamar o motor, e só tenta de novo depois de "não enviado".
 * A busca roda antes das validações: o reenvio tardio, com a origem já apagada, também recebe ok.
 */
export async function encaminharMensagemWhatsApp(input: { mensagemId: string; atendimentoDestinoId: string; chaveIdempotencia?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const { chaveIdempotencia, ...dados } = EncaminharSchema.parse(input);
    const u = await exigirSessao();
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    if (!marca) {
      const c = await conferirEncaminhamento(u, dados, prisma);
      let resp: RespostaEncaminhar;
      try { resp = await chamarMotorEncaminhar(c); } catch (e) { traduzir(e); }
      await prisma.$transaction((tx) => gravarEncaminhada(tx, u, c, resp, null));
      revalidatePath("/inbox");
      return undefined;
    }
    const aberto = await prisma.$transaction(async (tx) => {
      const primeira = await repeticaoIdempotente(tx, {
        tipo: TIPO_TENTATIVA_ENCAMINHAR, agregadoTipo: AGREGADO_ATENDIMENTO, autorId: u.id, marca,
        mensagemConflito: "Esta tentativa já foi usada com outro destino. Confira a conversa de destino antes de repetir.",
      });
      if (primeira && await desfechoDaChave(tx, primeira, u.id, marca.chaveIdempotencia) === "ok") return null;
      const c = await conferirEncaminhamento(u, dados, tx);
      const tentativa = await registrarEvento(tx, {
        tipo: TIPO_TENTATIVA_ENCAMINHAR, agregadoTipo: AGREGADO_ATENDIMENTO, agregadoId: c.m.atendimentoId, autorId: u.id,
        payload: { mensagemId: c.m.id, atendimentoDestinoId: c.d.id, ...marca },
      });
      return { c, tentativaId: tentativa.id };
    });
    if (!aberto) return undefined;
    const { c, tentativaId } = aberto;
    let resp: RespostaEncaminhar;
    try {
      resp = await chamarMotorEncaminhar(c);
    } catch (e) {
      const naoExecutou = e instanceof ErroMotor && MOTOR_NAO_EXECUTOU.has(e.codigo);
      await prisma.$transaction((tx) => registrarEvento(tx, {
        tipo: naoExecutou ? TIPO_ENCAMINHAMENTO_NAO_ENVIADO : TIPO_ENCAMINHAMENTO_INCERTO, agregadoTipo: AGREGADO_ATENDIMENTO, agregadoId: c.m.atendimentoId, autorId: u.id,
        payload: { mensagemId: c.m.id, atendimentoDestinoId: c.d.id, tentativaId, codigo: e instanceof ErroMotor ? e.codigo : "ERRO" },
      }));
      revalidatePath("/inbox");
      if (naoExecutou) traduzir(e);
      throw new ErroRegra(MSG_ENCAMINHAMENTO_INCERTO);
    }
    await prisma.$transaction((tx) => gravarEncaminhada(tx, u, c, resp, tentativaId));
    revalidatePath("/inbox");
    return undefined;
  });
}

const ConteudoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("FIGURINHA") }),
  z.object({ tipo: z.literal("GIF") }),
  z.object({
    tipo: z.literal("ENQUETE"),
    nome: z.string().trim().min(1, "Informe a pergunta da enquete.").max(255, "A pergunta pode ter no máximo 255 caracteres."),
    opcoes: z.array(z.string().trim().min(1, "Opção vazia.").max(100, "Cada opção pode ter no máximo 100 caracteres.")).min(2, "A enquete precisa de ao menos 2 opções.").max(12, "A enquete pode ter no máximo 12 opções."),
    maxEscolhas: z.number().int().min(1, "Escolhas por pessoa: no mínimo 1."),
  }),
  z.object({
    tipo: z.literal("LOCALIZACAO"),
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    nome: z.string().trim().min(1).max(255).optional(),
  }),
  z.object({ tipo: z.literal("CONTATO"), contatoJid: z.string().regex(/^\d{8,20}@s\.whatsapp\.net$/, "Contato inválido.") }),
]);
const EnviarConteudoSchema = z.object({ atendimentoId: z.string().min(1), conteudo: ConteudoSchema, midiaUrl: z.string().min(1).optional() });

const TIPO_INTENCAO = { FIGURINHA: "FIGURINHA", GIF: "VIDEO", ENQUETE: "ENQUETE", LOCALIZACAO: "LOCALIZACAO", CONTATO: "CONTATO" } as const;

function resumo(c: ConteudoEspecial): string {
  if (c.tipo === "ENQUETE") return c.nome;
  if (c.tipo === "LOCALIZACAO") return `📍 ${c.nome ?? "Localização"}`;
  return "";
}

/**
 * Enquete, figurinha, GIF, localização ou contato pela inbox. Vira intenção HUMANO e passa pelo despachante
 * (opt-out, kill switch, claim). Figurinha exige webp e GIF exige mp4, ambos subidos pelo próprio autor.
 */
export async function enviarConteudoInbox(input: { atendimentoId: string; conteudo: ConteudoEspecial; midiaUrl?: string }): Promise<Resultado<EnvioInboxResultado>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const dados = EnviarConteudoSchema.parse(input);
    const c = dados.conteudo as ConteudoEspecial;
    if (c.tipo === "ENQUETE" && c.maxEscolhas > c.opcoes.length) throw new ErroRegra("Escolhas por pessoa não pode passar do número de opções.");
    const a = await atendimentoVisivel(u, dados.atendimentoId, true);
    if (!a || a.encerradoEm) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (!a.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (a.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não envia esse tipo de conteúdo.");
    if (a.contato.optOutEm) throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");
    exigirMotorConectado(a.numero);

    let midiaPath: string | null = null;
    if (c.tipo === "FIGURINHA" || c.tipo === "GIF") {
      const esperado = c.tipo === "FIGURINHA" ? "image/webp" : "video/mp4";
      if (!dados.midiaUrl || !midiaSaidaDoAutor(dados.midiaUrl, u.id)) throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
      if (contentTypePorExtensao(dados.midiaUrl) !== esperado) {
        throw new ErroRegra(c.tipo === "FIGURINHA" ? "A figurinha precisa ser uma imagem WebP." : "O GIF precisa ser um vídeo MP4.");
      }
      midiaPath = dados.midiaUrl;
    }

    const intencao = await prisma.intencaoMensagem.create({
      data: {
        numeroId: a.numeroId, atendimentoId: a.id, contatoId: a.contatoId, origem: "HUMANO", tipo: TIPO_INTENCAO[c.tipo],
        conteudo: c as unknown as object, midiaPath, corpoRenderizado: resumo(c), autorId: u.id,
      },
    });
    await despacharFila(new Date(), { intencaoId: intencao.id });
    const final = await prisma.intencaoMensagem.findUnique({ where: { id: intencao.id }, select: { status: true, motivoFalha: true } });
    revalidatePath("/inbox");
    return { status: final?.status ?? "PENDENTE", motivo: final?.motivoFalha ?? null };
  });
}

const INTERVALO_DIGITANDO_MS = 10_000;
const digitandoEm = new Map<string, number>();

/** "Digitando…" no WhatsApp: no máximo uma vez a cada 10 s por usuário e atendimento. Tabela operacional, sem Evento. */
export async function avisarDigitando(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const a = await atendimentoVisivel(u, atendimentoId, true);
    if (!a) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (a.numero.driver !== "MOTOR") return undefined;
    exigirMotorConectado(a.numero);
    const chave = `${u.id}:${atendimentoId}`;
    const agora = Date.now();
    const ultimo = digitandoEm.get(chave);
    if (ultimo !== undefined && agora - ultimo < INTERVALO_DIGITANDO_MS) return undefined;
    digitandoEm.set(chave, agora);
    if (digitandoEm.size > 5000) for (const [k, t] of digitandoEm) if (agora - t >= INTERVALO_DIGITANDO_MS) digitandoEm.delete(k);
    const digitos = (a.contato.waId ?? a.contato.telefoneE164).replace(/\D/g, "");
    try {
      await executarAcaoMotor(a.numero.providerRef ?? a.numero.id, "presence", { chatId: `${digitos}@s.whatsapp.net`, state: "composing" }, { origem: "HUMANO" });
    } catch (e) { digitandoEm.delete(chave); traduzir(e); }
    return undefined;
  });
}

const EnviarGrupoSchema = z.object({ conversaId: z.string().min(1), texto: z.string().trim().min(1, "Escreva o texto.").max(4096, "O texto pode ter no máximo 4096 caracteres.") });

/**
 * Texto humano para um grupo do WhatsApp (E3.5), dentro do `escopoGrupos` da Fase 3. Grupo não tem atendimento nem
 * automação: cria a `MensagemWhatsApp` SAIDA `NA_FILA` (origem HUMANO, `clientMessageId` novo) e o despachante envia.
 */
export async function enviarMensagemGrupo(input: { conversaId: string; texto: string }): Promise<Resultado<{ status: string }>> {
  return executarAcao(async () => {
    const dados = EnviarGrupoSchema.parse(input);
    const u = await exigirSessao();
    const conversa = await prisma.conversaWhatsApp.findFirst({
      where: { id: dados.conversaId, grupoId: { not: null }, grupo: { is: await escopoGrupos(u) } },
      include: { numero: true, grupo: true },
    });
    if (!conversa?.grupo) throw new ErroRegra("Grupo fora do seu escopo de envio.");
    if (!conversa.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (conversa.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não envia para grupos.");
    exigirMotorConectado(conversa.numero);

    const mensagem = await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id, numeroId: conversa.numeroId, direcao: "SAIDA", tipo: "TEXTO", corpo: dados.texto, status: "NA_FILA",
        driver: "MOTOR", origem: "HUMANO", autorId: u.id, clientMessageId: randomUUID(),
      },
    });
    const status = await despacharMensagemGrupo(mensagem.id);
    await prisma.conversaWhatsApp.updateMany({
      where: { id: conversa.id, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: mensagem.criadoEm } }] },
      data: { ultimaMensagemEm: mensagem.criadoEm },
    });
    revalidatePath("/inbox");
    return { status };
  });
}

const jidDe = (e164: string) => `${e164.replace(/\D/g, "")}@s.whatsapp.net`;
const ParticipantesSchema = z.array(z.string().regex(/^\+\d{8,15}$/, "Telefone de participante inválido.")).min(1, "Informe ao menos um participante.").max(256, "O grupo aceita no máximo 256 participantes por vez.");
const BloquearSchema = z.object({
  atendimentoId: z.string().min(1),
  motivo: z.string().trim().min(10, "Informe o motivo do bloqueio (mínimo 10 caracteres)."),
  desbloquear: z.boolean().optional(),
});

/** Bloqueia (ou desbloqueia) o contato no WhatsApp (contact.block). Só ADMINISTRADOR e gerentes; o motivo vai no Evento. */
export async function bloquearContatoWhatsApp(input: { atendimentoId: string; motivo: string; desbloquear?: boolean }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (!podeExecutar(u, "bloquear", { setor: "COMERCIAL", responsavelId: null })) throw new ErroRegra("Sem permissão para bloquear contatos.");
    const dados = BloquearSchema.parse(input);
    const a = await atendimentoVisivel(u, dados.atendimentoId);
    if (!a) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (a.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não permite bloquear contatos.");
    exigirMotorConectado(a.numero);
    const desbloquear = dados.desbloquear === true;
    try {
      await executarAcaoMotor(a.numero.providerRef ?? a.numero.id, "contact.block", { contactId: jidDe(a.contato.waId ?? a.contato.telefoneE164), value: !desbloquear });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: desbloquear ? "ContatoWhatsAppDesbloqueado" : "ContatoWhatsAppBloqueado", agregadoTipo: "ContatoWhatsApp", agregadoId: a.contatoId, autorId: u.id,
        payload: { motivo: dados.motivo, atendimentoId: a.id, numeroId: a.numeroId },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

const CriarGrupoSchema = z.object({
  numeroId: z.string().min(1),
  nome: z.string().trim().min(3, "O nome do grupo precisa de ao menos 3 caracteres.").max(100, "O nome do grupo pode ter no máximo 100 caracteres."),
  participantesE164: ParticipantesSchema,
  turmaId: z.string().min(1).optional(),
});
const MSG_SEM_GRUPO = "Sem permissão para gerir grupos.";

/** Cria um grupo no WhatsApp (group.create) e grava `GrupoWhatsApp`, opcionalmente ligado à turma. */
export async function criarGrupoWhatsApp(input: { numeroId: string; nome: string; participantesE164: string[]; turmaId?: string }): Promise<Resultado<{ grupoId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (!podeExecutar(u, "grupoGerir", { setor: "SECRETARIA", responsavelId: null })) throw new ErroRegra(MSG_SEM_GRUPO);
    const dados = CriarGrupoSchema.parse(input);
    const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: dados.numeroId }, select: { id: true, ativo: true, driver: true, sessao: true, providerRef: true } });
    if (!numero || !numero.ativo) throw new ErroRegra("Número não encontrado ou inativo.");
    if (numero.driver !== "MOTOR") throw new ErroRegra("Este canal não cria grupos.");
    exigirMotorConectado(numero);
    if (dados.turmaId && !(await prisma.turma.findUnique({ where: { id: dados.turmaId }, select: { id: true } }))) throw new ErroRegra("Turma não encontrada.");
    // Mesmo critério do escopoGrupos (o de alterarParticipantesGrupo): o grupo criado tem de ficar no escopo de quem cria.
    if (!(await grupoNovoNoEscopo(u, { numeroId: numero.id, turmaId: dados.turmaId ?? null }))) throw new ErroRegra("Número ou turma fora do seu escopo.");
    let criado: { id?: string; subject?: string } | undefined;
    try {
      criado = await executarAcaoMotor(numero.providerRef ?? numero.id, "group.create", { subject: dados.nome, participants: dados.participantesE164.map(jidDe) });
    } catch (e) { traduzir(e); }
    if (!criado?.id) throw new ErroRegra("O motor não confirmou a criação do grupo.");
    const grupoJid = criado.id;
    const grupo = await prisma.$transaction(async (tx) => {
      // O evento de grupo do motor pode ter criado a linha antes desta resposta: o upsert não duplica.
      const g = await tx.grupoWhatsApp.upsert({
        where: { numeroId_grupoJid: { numeroId: numero.id, grupoJid } },
        create: { numeroId: numero.id, grupoJid, nome: dados.nome, turmaId: dados.turmaId ?? null },
        update: { nome: dados.nome, ...(dados.turmaId ? { turmaId: dados.turmaId } : {}) },
      });
      await registrarEvento(tx, {
        tipo: "GrupoWhatsAppCriado", agregadoTipo: "GrupoWhatsApp", agregadoId: g.id, autorId: u.id,
        payload: { numeroId: numero.id, grupoJid, nome: dados.nome, turmaId: dados.turmaId ?? null, participantesE164: dados.participantesE164 },
      });
      return g;
    });
    revalidatePath("/inbox");
    return { grupoId: grupo.id };
  });
}

const OPERACAO_GRUPO = { adicionar: "add", remover: "remove", promover: "promote", rebaixar: "demote" } as const;
const AlterarParticipantesSchema = z.object({
  grupoId: z.string().min(1),
  acao: z.enum(["adicionar", "remover", "promover", "rebaixar"]),
  participantesE164: ParticipantesSchema,
});

/** Adiciona, remove, promove ou rebaixa participantes (group.participants), dentro do `escopoGrupos`. */
export async function alterarParticipantesGrupo(input: { grupoId: string; acao: "adicionar" | "remover" | "promover" | "rebaixar"; participantesE164: string[] }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (!podeExecutar(u, "grupoGerir", { setor: "SECRETARIA", responsavelId: null })) throw new ErroRegra(MSG_SEM_GRUPO);
    const dados = AlterarParticipantesSchema.parse(input);
    const grupo = await prisma.grupoWhatsApp.findFirst({ where: { id: dados.grupoId, ...(await escopoGrupos(u)) }, include: { numero: { select: { id: true, ativo: true, driver: true, sessao: true, providerRef: true } } } });
    if (!grupo) throw new ErroRegra("Grupo fora do seu escopo.");
    if (!grupo.numero.ativo || grupo.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não gerencia grupos.");
    exigirMotorConectado(grupo.numero);
    try {
      await executarAcaoMotor(grupo.numero.providerRef ?? grupo.numero.id, "group.participants", {
        id: grupo.grupoJid, participants: dados.participantesE164.map(jidDe), operation: OPERACAO_GRUPO[dados.acao],
      });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "ParticipantesGrupoAlterados", agregadoTipo: "GrupoWhatsApp", agregadoId: grupo.id, autorId: u.id,
        payload: { acao: dados.acao, participantesE164: dados.participantesE164 },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}
