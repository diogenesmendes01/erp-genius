import { prisma } from "@/lib/prisma";
import type { FinalidadeAtendimentoWhatsApp, Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos, type Db } from "./escopo";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";
import { chaveDeReabertura } from "./status-atendimento";
import { atendimentoComercialDaLinha, atendimentoDaLinhaParaInbound } from "./linha-comercial";
import { comContatoIndividual } from "./grupos";
import { setoresDoNumero } from "./numero-setor";
import { registrarEvento } from "@/server/_shared";
import { atribuirAutomaticamente } from "@/server/crm-config/distribuicao";
import { comSavepoint, resumoDoErro } from "./savepoint";
import { MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_DE_OUTRO_ALUNO, MSG_MATRICULA_EXIGE_ALUNO } from "./erro-regra-atendimento";

export async function garantirAtendimento(tx: Prisma.TransactionClient, dados: {
  numeroId: string; contatoId: string; finalidade: FinalidadeAtendimentoWhatsApp;
  leadId?: string | null; alunoId?: string | null; matriculaId?: string | null; turmaId?: string | null; responsavelId?: string | null;
  autorizacaoComunicacaoAcademicaId?: string | null;
  reabrir?: boolean;
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
    update: {},
  });
}

export async function atendimentoVisivel(usuario: UsuarioSessao, atendimentoId: string, enviar = false, db: Db = prisma) {
  const a = await db.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario, { enviar, db })] },
    include: { conversa: { include: { numero: true, contato: true } } },
  });
  if (!a) return null;
  const i = comContatoIndividual(a);
  if (enviar && !await destinatarioAtualDoAtendimento(i, db)) return null;
  return { ...i, transporteId: i.conversaId, numeroId: i.conversa.numeroId, contatoId: i.conversa.contato.id,
    numero: i.conversa.numero, contato: i.conversa.contato };
}

export async function atendimentoDoInbound(
  tx: Prisma.TransactionClient, conversaId: string, opcoes: { atribuir: boolean },
): Promise<string | null> {
  const id = await resolverAtendimentoDoInbound(tx, conversaId);
  if (id && opcoes.atribuir) {
    await comSavepoint(tx, "atribuir_setor", () => atribuirAutomaticamente(tx, id), (e) => {
      console.error("[distribuicao] atribuição automática no inbound falhou; atendimento fica na fila do setor:", { atendimentoId: id, erro: resumoDoErro(e) });
      return null;
    });
  }
  return id;
}

async function resolverAtendimentoDoInbound(tx: Prisma.TransactionClient, conversaId: string): Promise<string | null> {
  const abertos = await tx.atendimentoWhatsApp.findMany({ where: { conversaId, encerradoEm: null }, include: { conversa: { include: { contato: true } } }, take: 2 });
  if (abertos.every((a) => a.finalidade === "COMERCIAL")) {
    const daLinha = await atendimentoDaLinhaParaInbound(tx, conversaId);
    if (daLinha !== undefined) return daLinha;
  }
  if (abertos.length === 1) {
    const aberto = abertos[0];
    if ((aberto.finalidade === "FINANCEIRO" && !aberto.matriculaId)
      || !await destinatarioAtualDoAtendimento(comContatoIndividual(aberto), tx)) return null;
    return aberto.id;
  }
  if (abertos.length > 1) return null;
  const c = await tx.conversaWhatsApp.findUnique({ where: { id: conversaId }, include: { numero: true, contato: { include: { lead: true } } } });
  if (!c?.numero.ativo || !c.contato || !c.contatoId) return null;
  const setores = await setoresDoNumero(tx, c.numeroId);
  if (setores.length !== 1) return null;
  const atendimento = await abrirAtendimentoDoSetor(tx, { numeroId: c.numeroId, contatoId: c.contatoId, contato: c.contato }, setores[0], { atribuir: false });
  return atendimento && !atendimento.encerradoEm ? atendimento.id : null;
}

export async function abrirAtendimentoDoSetor(
  tx: Prisma.TransactionClient,
  c: { numeroId: string; contatoId: string; contato: { leadId: string | null; alunoId: string | null } },
  setor: FinalidadeAtendimentoWhatsApp,
  opcoes: { atribuir: boolean } = { atribuir: true },
) {
  const atendimento = await abrirSemAtribuir(tx, c, setor);
  if (atendimento && !atendimento.encerradoEm && opcoes.atribuir) {
    const responsavelId = await comSavepoint(tx, "atribuir_setor", () => atribuirAutomaticamente(tx, atendimento.id), (e) => {
      console.error("[distribuicao] atribuição automática falhou; atendimento fica na fila do setor:", e);
      return null;
    });
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
      const matriculas = await tx.matricula.findMany({ where: { alunoId: c.contato.alunoId }, select: { id: true }, take: 2 });
      if (matriculas.length !== 1) return null;
      return garantirAtendimento(tx, { ...base, finalidade: "FINANCEIRO", alunoId: c.contato.alunoId, matriculaId: matriculas[0].id });
    }
    default:
      return null;
  }
}

export async function encerrarAtendimentoNaTransacao(tx: Prisma.TransactionClient, atendimentoId: string, autorId: string, payload: Prisma.InputJsonValue = {}) {
  await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
  await tx.intencaoMensagem.updateMany({ where: { atendimentoId, status: { in: ["PENDENTE", "ADIADA"] } }, data: { status: "CANCELADA", motivoFalha: "atendimento_encerrado" } });
  await registrarEvento(tx, { tipo: "AtendimentoEncerrado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId, payload });
}
