import { prisma } from "@/lib/prisma";
import type { FinalidadeAtendimentoWhatsApp, Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos } from "./escopo";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";
import { chaveDeReabertura } from "./status-atendimento";
import { atendimentoComercialDaLinha, atendimentoDaLinhaParaInbound } from "./linha-comercial";
import { comContatoIndividual } from "./grupos";
import { setoresDoNumero } from "./numero-setor";
import { registrarEvento } from "@/server/_shared";
import { atribuirAutomaticamente } from "@/server/crm-config/distribuicao";
import { MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_DE_OUTRO_ALUNO, MSG_MATRICULA_EXIGE_ALUNO } from "./erro-regra-atendimento";

export async function garantirAtendimento(tx: Prisma.TransactionClient, dados: {
  numeroId: string; contatoId: string; finalidade: FinalidadeAtendimentoWhatsApp;
  leadId?: string | null; alunoId?: string | null; matriculaId?: string | null; turmaId?: string | null; responsavelId?: string | null;
  autorizacaoComunicacaoAcademicaId?: string | null;
  /** Contexto encerrado vira atendimento NOVO (`base#n`) em vez de devolver o encerrado.
   *  COMERCIAL em linha VENDAS já se comporta assim sempre (atendimentoComercialDaLinha só considera abertos e
   *  cria `COMERCIAL:LINHA:<n>`), portanto `reabrir` é redundante ali. */
  reabrir?: boolean;
  /** Transferência entre setores (E3.3): o atendimento novo aponta para o encerrado. */
  atendimentoOrigemId?: string | null;
}) {
  if (dados.finalidade === "FINANCEIRO") {
    if (!dados.matriculaId || !dados.alunoId) throw new Error(MSG_FINANCEIRO_EXIGE_MATRICULA);
  }
  if (dados.matriculaId) {
    if (!dados.alunoId) throw new Error(MSG_MATRICULA_EXIGE_ALUNO);
    const matricula = await tx.matricula.findFirst({ where: { id: dados.matriculaId, alunoId: dados.alunoId }, select: { id: true } });
    if (!matricula) throw new Error(MSG_MATRICULA_DE_OUTRO_ALUNO);
  }
  const conversa = await tx.conversaWhatsApp.upsert({
    where: { numeroId_contatoId: { numeroId: dados.numeroId, contatoId: dados.contatoId } },
    create: { numeroId: dados.numeroId, contatoId: dados.contatoId }, update: {},
  });
  // Linha comercial (SPEC-ERP-005): assunto comercial num número de VENDAS usa o atendimento único
  // da conversa — fila comercial, abertura manual e vínculo de lead não partem mais o histórico.
  if (dados.finalidade === "COMERCIAL") {
    const daLinha = await atendimentoComercialDaLinha(tx, conversa.id, { leadId: dados.leadId, responsavelId: dados.responsavelId });
    if (daLinha) return daLinha;
  }
  const contextoChave = [dados.finalidade, dados.leadId ?? "", dados.alunoId ?? "", dados.turmaId ?? "",
    ...(dados.matriculaId ? [dados.matriculaId] : []),
    ...(dados.finalidade === "PEDAGOGICO" && dados.alunoId ? [dados.autorizacaoComunicacaoAcademicaId ?? "ALUNO"] : [])].join(":");
  const criar = {
    finalidade: dados.finalidade,
    leadId: dados.leadId, alunoId: dados.alunoId, matriculaId: dados.matriculaId, turmaId: dados.turmaId, responsavelId: dados.responsavelId,
    autorizacaoComunicacaoAcademicaId: dados.autorizacaoComunicacaoAcademicaId,
    ...(dados.atendimentoOrigemId ? { atendimentoOrigemId: dados.atendimentoOrigemId } : {}),
    ...(dados.responsavelId ? { status: "EM_ATENDIMENTO" as const } : {}),
  };
  if (dados.reabrir) {
    // Serializa reaberturas do mesmo contexto: sem isso, duas transações contariam o mesmo `n`.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${conversa.id}), hashtext(${contextoChave}))`;
    const doContexto = await tx.atendimentoWhatsApp.findMany({
      where: { conversaId: conversa.id, OR: [{ contextoChave }, { contextoChave: { startsWith: `${contextoChave}#` } }] },
      orderBy: { criadoEm: "asc" },
    });
    const aberto = doContexto.find((a) => !a.encerradoEm);
    if (aberto) return aberto;
    if (doContexto.length) {
      const chave = chaveDeReabertura(contextoChave, doContexto.length);
      return tx.atendimentoWhatsApp.upsert({
        where: { conversaId_contextoChave: { conversaId: conversa.id, contextoChave: chave } },
        create: { conversaId: conversa.id, contextoChave: chave, ...criar }, update: {},
      });
    }
  }
  return tx.atendimentoWhatsApp.upsert({
    where: { conversaId_contextoChave: { conversaId: conversa.id, contextoChave } },
    create: { conversaId: conversa.id, contextoChave, ...criar },
    update: {}, // nunca reabre vínculo encerrado nem muda o proprietário por visita/telefone
  });
}

export async function atendimentoVisivel(usuario: UsuarioSessao, atendimentoId: string, enviar = false) {
  const a = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario, { enviar })] },
    include: { conversa: { include: { numero: true, contato: true } } },
  });
  if (!a) return null;
  const i = comContatoIndividual(a);
  if (enviar && !await destinatarioAtualDoAtendimento(i)) return null;
  return { ...i, transporteId: i.conversaId, numeroId: i.conversa.numeroId, contatoId: i.conversa.contato.id,
    numero: i.conversa.numero, contato: i.conversa.contato };
}

/**
 * Linha comercial: toda mensagem vai para o atendimento único da conversa (SPEC-ERP-005 §5.2).
 * Canal institucional: não adivinha o assunto quando há mais de um atendimento aberto — fica na triagem.
 */
export async function atendimentoDoInbound(
  tx: Prisma.TransactionClient, conversaId: string, opcoes: { atribuir: boolean },
): Promise<string | null> {
  const id = await resolverAtendimentoDoInbound(tx, conversaId);
  // Abertura sem responsável: a distribuição do setor (Fase 5F) atribui só no 1º inbound DO CONTATO.
  // Mensagem `fromMe` (celular da escola) e chamada recebida passam `atribuir: false` para não
  // consumir a vez do rodízio nem dar o atendimento a outra pessoa; sem regra, fica na fila.
  if (id && opcoes.atribuir) await atribuirAutomaticamente(tx, id);
  return id;
}

async function resolverAtendimentoDoInbound(tx: Prisma.TransactionClient, conversaId: string): Promise<string | null> {
  const abertos = await tx.atendimentoWhatsApp.findMany({ where: { conversaId, encerradoEm: null }, include: { conversa: { include: { contato: true } } }, take: 2 });
  // Assunto institucional aberto: o roteamento institucional vale mesmo num número de VENDAS (LC-I01).
  if (abertos.every((a) => a.finalidade === "COMERCIAL")) {
    const daLinha = await atendimentoDaLinhaParaInbound(tx, conversaId);
    if (daLinha !== undefined) return daLinha;
  }
  if (abertos.length === 1) {
    const aberto = abertos[0];
    // Atendimento financeiro legado continua consultável, mas não recebe inbound automático sem contrato explícito.
    if ((aberto.finalidade === "FINANCEIRO" && !aberto.matriculaId)
      || !await destinatarioAtualDoAtendimento(comContatoIndividual(aberto), tx)) return null;
    return aberto.id;
  }
  if (abertos.length > 1) return null;
  const c = await tx.conversaWhatsApp.findUnique({ where: { id: conversaId }, include: { numero: true, contato: { include: { lead: true } } } });
  if (!c?.numero.ativo || !c.contato || !c.contatoId) return null;
  // VENDAS sem atendimento aberto é linha comercial e já foi roteado acima.
  // Roteamento por setor do número: zero ou vários setores → triagem. A classificação pela Aria é da Fase 5.
  const setores = await setoresDoNumero(tx, c.numeroId);
  if (setores.length !== 1) return null;
  // Sem atribuir aqui: atendimentoDoInbound decide (mensagem fromMe e chamada não atribuem).
  const atendimento = await abrirAtendimentoDoSetor(tx, { numeroId: c.numeroId, contatoId: c.contatoId, contato: c.contato }, setores[0], { atribuir: false });
  return atendimento && !atendimento.encerradoEm ? atendimento.id : null;
}

/**
 * Abre (ou reaproveita) o atendimento do setor para o contato, com a regra de contexto da Fase 3:
 * FINANCEIRO só com uma única matrícula possível; PEDAGOGICO exige matrícula e autorização explícitas
 * (nunca abre automaticamente). Devolve null quando o contexto não permite abrir.
 *
 * Ponto comum de abertura por setor (inbound e triagem da Aria, Fase 5C): por padrão aplica a
 * distribuição do setor (Fase 5F) ao atendimento aberto sem responsável, para quem abre por aqui
 * sem passar por atendimentoDoInbound também entrar no rodízio.
 */
export async function abrirAtendimentoDoSetor(
  tx: Prisma.TransactionClient,
  c: { numeroId: string; contatoId: string; contato: { leadId: string | null; alunoId: string | null } },
  setor: FinalidadeAtendimentoWhatsApp,
  opcoes: { atribuir: boolean } = { atribuir: true },
) {
  const atendimento = await abrirSemAtribuir(tx, c, setor);
  if (atendimento && !atendimento.encerradoEm && opcoes.atribuir) {
    const responsavelId = await atribuirAutomaticamente(tx, atendimento.id);
    if (responsavelId) return { ...atendimento, responsavelId, status: "EM_ATENDIMENTO" as const };
  }
  return atendimento;
}

async function abrirSemAtribuir(
  tx: Prisma.TransactionClient,
  c: { numeroId: string; contatoId: string; contato: { leadId: string | null; alunoId: string | null } },
  setor: FinalidadeAtendimentoWhatsApp,
) {
  const base = { numeroId: c.numeroId, contatoId: c.contatoId, reabrir: true as const };
  switch (setor) {
    case "COMERCIAL":
      return garantirAtendimento(tx, { ...base, finalidade: "COMERCIAL", leadId: c.contato.leadId });
    case "SECRETARIA":
      return garantirAtendimento(tx, { ...base, finalidade: "SECRETARIA", alunoId: c.contato.alunoId });
    case "FINANCEIRO": {
      if (!c.contato.alunoId) return null;
      // A identidade não escolhe contrato: só roteia quando existe uma única matrícula possível.
      const matriculas = await tx.matricula.findMany({ where: { alunoId: c.contato.alunoId }, select: { id: true }, take: 2 });
      if (matriculas.length !== 1) return null;
      return garantirAtendimento(tx, { ...base, finalidade: "FINANCEIRO", alunoId: c.contato.alunoId, matriculaId: matriculas[0].id });
    }
    default:
      // PEDAGOGICO: a abertura exige matrícula e autorização explícitas.
      return null;
  }
}

/**
 * Encerra o atendimento (ENCERRADO + cancela intenções pendentes/adiadas + Evento) na transação do chamador.
 * Ponto único usado por `encerrarAtendimentoWhatsApp` e pela transferência entre setores.
 */
export async function encerrarAtendimentoNaTransacao(tx: Prisma.TransactionClient, atendimentoId: string, autorId: string, payload: Prisma.InputJsonValue = {}) {
  await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
  await tx.intencaoMensagem.updateMany({ where: { atendimentoId, status: { in: ["PENDENTE", "ADIADA"] } }, data: { status: "CANCELADA", motivoFalha: "atendimento_encerrado" } });
  await registrarEvento(tx, { tipo: "AtendimentoEncerrado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId, payload });
}
