"use server";

import { revalidatePath } from "next/cache";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel, encerrarAtendimentoNaTransacao, garantirAtendimento } from "./atendimentos";
import { SETORES, ehGerenteDoSetor, papeisDoSetor, type Setor } from "./setor";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "./participantes";
import { setoresDoNumero } from "./numero-setor";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
import { proximoStatus } from "./status-atendimento";

const MSG_JA_ASSUMIDO = "Outro atendente já assumiu este atendimento.";
const MSG_FORA_DO_ESCOPO = "Atendimento fora do seu escopo.";
const MSG_SEM_ALCADA = "Sua função não autoriza esta ação neste atendimento.";
const MOTIVO_CANCELAMENTO = "Responsável do atendimento mudou; revisar antes de enviar.";

const IdSchema = z.string().min(1);
const AtribuirSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1) });

/** Tira o atendimento de quem o tinha: intenções humanas ainda não enviadas deixam de valer (como comercial/acoes.ts, atribuirDono). */
async function cancelarIntencoesDoResponsavel(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], atendimentoId: string, responsavelId: string | null) {
  if (!responsavelId) return;
  await tx.intencaoMensagem.updateMany({
    where: { atendimentoId, origem: "HUMANO", autorId: responsavelId, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELAMENTO },
  });
}

/** Assume da fila: só vence quem encontra o atendimento aberto e sem responsável (UPDATE condicional). */
export async function assumirAtendimento(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    const a = await atendimentoVisivel(u, id);
    if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
    if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
    if (a.responsavelId !== null) throw new ErroRegra(MSG_JA_ASSUMIDO);
    if (!podeExecutar(u, "assumir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
    await prisma.$transaction(async (tx) => {
      const status = proximoStatus(a.status, "ASSUMIDO", true);
      const r = await tx.atendimentoWhatsApp.updateMany({ where: { id, responsavelId: null, encerradoEm: null }, data: { responsavelId: u.id, status } });
      if (r.count !== 1) throw new ErroRegra(MSG_JA_ASSUMIDO);
      await registrarEvento(tx, { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: null, para: u.id } });
    });
    revalidatePath("/inbox");
  });
}

/** Devolve à fila: zera o responsável, volta a ABERTO_SEM_RESPONSAVEL e cancela as intenções humanas pendentes dele. */
export async function devolverParaFila(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (a.responsavelId === null) throw new ErroRegra("Este atendimento já está na fila.");
      if (!podeExecutar(u, "devolver", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: null, status: proximoStatus(atual.status, "DEVOLVIDO", false) } });
      await cancelarIntencoesDoResponsavel(tx, id, anterior);
      await registrarEvento(tx, { tipo: "AtendimentoDevolvido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: anterior, para: null } });
    });
    revalidatePath("/inbox");
  });
}

/** Gerente do setor entrega o atendimento a alguém que atende o setor. */
export async function atribuirAtendimento(input: { atendimentoId: string; usuarioId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { atendimentoId: id, usuarioId } = AtribuirSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(u, "atribuir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const alvo = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
      const doSetor = papeisDoSetor(a.finalidade);
      if (!alvo || !alvo.ativo || !alvo.papeis.some((p) => doSetor.includes(p))) throw new ErroRegra("A pessoa escolhida não atende este setor.");
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      if (anterior === usuarioId) return;
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: usuarioId, status: proximoStatus(atual.status, "ASSUMIDO", true) } });
      await cancelarIntencoesDoResponsavel(tx, id, anterior);
      await registrarEvento(tx, { tipo: "AtendimentoAtribuido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: anterior, para: usuarioId } });
    });
    revalidatePath("/inbox");
  });
}

const TransferirSchema = z.object({
  atendimentoId: z.string().min(1),
  destino: z.enum(SETORES as [Setor, ...Setor[]]),
  destinoChave: z.string().min(1).nullable(),
  contexto: z.string().trim().min(12, "Descreva o contexto da transferência (mínimo de 12 caracteres).").max(1000),
});

/**
 * A chave do destino é a de `listarOpcoesAtendimento`, mas resolvida contra o banco e não contra o que o usuário
 * enxerga (quem transfere não precisa ter alçada no setor de destino). FINANCEIRO:<matrícula>;
 * PEDAGOGICO:<aluno>:<turma>:<matrícula>:(ALUNO|AUT:<autorização>).
 */
async function resolverDestino(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], destino: Setor, chave: string | null, telefoneContato: string) {
  if (destino === "FINANCEIRO") {
    const p = chave?.split(":") ?? [];
    if (p[0] !== "FINANCEIRO" || !p[1]) throw new ErroRegra("Escolha a matrícula do atendimento financeiro.");
    const m = await tx.matricula.findUnique({ where: { id: p[1] }, include: INCLUDE_MATRICULA_DESTINO });
    if (!m) throw new ErroRegra("Matrícula do atendimento financeiro não encontrada.");
    // Mesmo critério de abrirAtendimentoInstitucional: o destinatário de cobrança da matrícula é único; o contato
    // da conversa tem de ser esse destinatário, senão as cobranças iriam para a pessoa errada.
    const fin = resolverDestinoFinanceiroDaMatricula(m);
    if (!fin) throw new ErroRegra("A matrícula selecionada não possui destinatário válido para cobrança. Confira o pagador e o telefone deste contrato.");
    if (fin.telefoneE164 !== telefoneContato) throw new ErroRegra("O contato desta conversa não é o destinatário de cobrança da matrícula escolhida.");
    return { alunoId: fin.alunoId, matriculaId: fin.matriculaId, turmaId: null, autorizacaoComunicacaoAcademicaId: null };
  }
  if (destino === "PEDAGOGICO") {
    const p = chave?.split(":") ?? [];
    if (p[0] !== "PEDAGOGICO" || p.length < 5 || !p[1] || !p[2] || !p[3]) throw new ErroRegra("Escolha o aluno, a turma e a matrícula do atendimento pedagógico.");
    const autorizacao = p[4] === "AUT" ? p[5] : null;
    if (p[4] === "AUT" && !autorizacao) throw new ErroRegra("Escolha a autorização do atendimento pedagógico.");
    const m = await tx.matricula.findFirst({ where: { id: p[3], alunoId: p[1] }, select: { id: true } });
    if (!m) throw new ErroRegra("Matrícula pedagógica não corresponde ao aluno selecionado.");
    return { alunoId: p[1], matriculaId: p[3], turmaId: p[2], autorizacaoComunicacaoAcademicaId: autorizacao };
  }
  return null;
}

/** Erro de trigger/regra do banco (264/265 etc.) vira ErroRegra com a mensagem do banco. */
function comoErroRegra(e: unknown): never {
  if (e instanceof ErroRegra) throw e;
  const msg = e instanceof Error ? e.message : String(e);
  // Trigger com RAISE EXCEPTION (SQLSTATE P0001): o Prisma embute a mensagem do banco no texto do erro.
  const doBanco = /code: "P0001", message: "((?:[^"\\]|\\.)*)"/.exec(msg)?.[1];
  if (doBanco) throw new ErroRegra(doBanco);
  // Erro simples de domínio lançado por garantirAtendimento (Error comum, não do Prisma).
  if (e instanceof Error && !e.constructor.name.startsWith("PrismaClient")) throw new ErroRegra(msg);
  throw e;
}

/** Transferir = encerrar a origem e abrir outro atendimento no setor de destino (E3.3); o contexto da origem nunca muda. */
export async function transferirAtendimento(input: { atendimentoId: string; destino: Setor; destinoChave: string | null; contexto: string }): Promise<Resultado<{ novoAtendimentoId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const dados = TransferirSchema.parse(input);
    const novoId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${dados.atendimentoId} FOR UPDATE`;
      const a = await atendimentoVisivel(u, dados.atendimentoId);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(u, "transferir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      if (dados.destino === a.finalidade && !["FINANCEIRO", "PEDAGOGICO"].includes(dados.destino)) throw new ErroRegra("O atendimento já pertence a este setor.");
      const ctx = await resolverDestino(tx, dados.destino, dados.destinoChave, a.contato.telefoneE164);
      if (!(await setoresDoNumero(tx, a.numeroId)).includes(dados.destino)) throw new ErroRegra("O número deste atendimento não atende o setor escolhido.");
      await encerrarAtendimentoNaTransacao(tx, a.id, u.id);
      const conversaId = a.conversaId;
      const antes = new Set((await tx.atendimentoWhatsApp.findMany({ where: { conversaId, encerradoEm: null }, select: { id: true } })).map((x) => x.id));
      let novo;
      try {
        novo = await garantirAtendimento(tx, {
          numeroId: a.numeroId, contatoId: a.contatoId, finalidade: dados.destino, reabrir: true, atendimentoOrigemId: a.id,
          leadId: dados.destino === "COMERCIAL" ? a.leadId ?? a.contato.leadId : null,
          alunoId: ctx?.alunoId ?? (dados.destino === "SECRETARIA" ? a.alunoId ?? a.contato.alunoId : null),
          matriculaId: ctx?.matriculaId ?? null, turmaId: ctx?.turmaId ?? null,
          autorizacaoComunicacaoAcademicaId: ctx?.autorizacaoComunicacaoAcademicaId ?? null, responsavelId: null,
        });
      } catch (e) { comoErroRegra(e); }
      if (antes.has(novo.id)) throw new ErroRegra("Já existe um atendimento aberto neste setor e contexto para esta conversa.");
      if (!novo.atendimentoOrigemId) novo = await tx.atendimentoWhatsApp.update({ where: { id: novo.id }, data: { atendimentoOrigemId: a.id } });
      const payload = { de: a.finalidade, para: dados.destino, origemId: a.id, novoId: novo.id, contexto: dados.contexto };
      for (const agregadoId of [a.id, novo.id]) {
        await registrarEvento(tx, { tipo: "AtendimentoTransferido", agregadoTipo: "AtendimentoWhatsApp", agregadoId, autorId: u.id, payload });
      }
      return novo.id;
    }).catch(comoErroRegra);
    revalidatePath("/inbox");
    return { novoAtendimentoId: novoId };
  });
}

const ConvidarSchema = z.object({
  atendimentoId: z.string().min(1),
  usuarioId: z.string().min(1),
  podeEnviar: z.boolean(),
  fim: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Informe uma data de término válida."),
  motivo: z.string().trim().min(10, "Descreva o motivo do convite (mínimo de 10 caracteres).").max(500),
});

/** Convida alguém (de qualquer setor) a ver o atendimento, por prazo de até 30 dias (E3.4). Início = agora; concedente = quem convida. */
export async function convidarParticipante(input: { atendimentoId: string; usuarioId: string; podeEnviar: boolean; fim: string; motivo: string }): Promise<Resultado<{ participanteId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const dados = ConvidarSchema.parse(input);
    const agora = new Date();
    const fim = new Date(dados.fim);
    if (fim <= agora) throw new ErroRegra("O fim do convite precisa ser no futuro.");
    if (fim.getTime() > agora.getTime() + PRAZO_MAXIMO_CONVITE_DIAS * 86_400_000) throw new ErroRegra(`O convite pode durar no máximo ${PRAZO_MAXIMO_CONVITE_DIAS} dias.`);
    const participanteId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${dados.atendimentoId} FOR UPDATE`;
      const a = await atendimentoVisivel(u, dados.atendimentoId);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(u, "convidar", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      if (dados.usuarioId === u.id) throw new ErroRegra("Você não pode convidar a si mesmo.");
      const alvo = await tx.usuario.findUnique({ where: { id: dados.usuarioId }, select: { ativo: true } });
      if (!alvo?.ativo) throw new ErroRegra("A pessoa escolhida não está ativa.");
      const ja = await tx.participanteAtendimentoWhatsApp.count({ where: { atendimentoId: a.id, usuarioId: dados.usuarioId, revogadoEm: null, fim: { gt: agora } } });
      if (ja > 0) throw new ErroRegra("Esta pessoa já participa do atendimento.");
      const p = await tx.participanteAtendimentoWhatsApp.create({
        data: { atendimentoId: a.id, usuarioId: dados.usuarioId, concedenteId: u.id, inicio: agora, fim, podeEnviar: dados.podeEnviar, motivo: dados.motivo },
      });
      await registrarEvento(tx, { tipo: "ParticipanteConvidado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id, payload: { participanteId: p.id, usuarioId: dados.usuarioId, podeEnviar: dados.podeEnviar, fim: fim.toISOString(), motivo: dados.motivo } });
      return p.id;
    });
    revalidatePath("/inbox");
    return { participanteId };
  });
}

/** Revoga na hora (revogadoEm = agora, sem delete). Quem revoga: o concedente, o gerente do setor ou o administrador. */
export async function revogarParticipante(participanteId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(participanteId);
    await prisma.$transaction(async (tx) => {
      const p = await tx.participanteAtendimentoWhatsApp.findUnique({ where: { id }, include: { atendimento: { select: { id: true, finalidade: true } } } });
      if (!p) throw new ErroRegra("Participante não encontrado.");
      const permitido = p.concedenteId === u.id || u.papeis.includes(Papel.ADMINISTRADOR) || ehGerenteDoSetor(u.papeis, p.atendimento.finalidade);
      if (!permitido) throw new ErroRegra(MSG_SEM_ALCADA);
      const agora = new Date();
      const r = await tx.participanteAtendimentoWhatsApp.updateMany({ where: { id, revogadoEm: null }, data: { revogadoEm: agora } });
      if (r.count !== 1) throw new ErroRegra("Este convite já foi revogado.");
      await registrarEvento(tx, { tipo: "ParticipanteRevogado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: p.atendimento.id, autorId: u.id, payload: { participanteId: id, usuarioId: p.usuarioId } });
    });
    revalidatePath("/inbox");
  });
}
