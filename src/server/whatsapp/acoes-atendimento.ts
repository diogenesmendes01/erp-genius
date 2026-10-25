"use server";

import { revalidatePath } from "next/cache";
import { Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { CANAL_INBOX, type AvisoInbox } from "@/server/inbox/barramento";
import { podeExecutar } from "@/server/inbox/permissoes";
import { avisarAtendimento } from "@/server/inbox/aviso";
import { atendimentoVisivel } from "./atendimentos";
import { escopoAtendimentos } from "./escopo";
import { SETORES, ehGerenteDoSetor, type Setor } from "./setor";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "./participantes";

import { comoErroRegra } from "./erro-regra-atendimento";

import { proximoStatus } from "./status-atendimento";
import { assumirAriaNoBanco } from "./assumir-aria";
import { atribuirAtendimentoTx, transferirAtendimentoTx, exigirResponsavelEnxerga, cancelarIntencoesDoResponsavel, ultimoEventoEhDoAutor } from "./transferencia-nucleo";

const MSG_JA_ASSUMIDO = "Outro atendente já assumiu este atendimento.";
const MSG_FORA_DO_ESCOPO = "Atendimento fora do seu escopo.";
const MSG_SEM_ALCADA = "Sua função não autoriza esta ação neste atendimento.";

const MOTIVO_CANCELAMENTO_REVOGADO = "Convite de participante revogado; revisar antes de enviar.";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const IdSchema = z.string().min(1);
const AtribuirSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1) });

/** Eventos que mudam o responsável do atendimento: o último deles diz quem deixou o estado atual. */
const TIPOS_RESPONSAVEL = ["AtendimentoAssumido", "AtendimentoDevolvido", "AtendimentoAtribuido"];

/** Assume da fila: só vence quem encontra o atendimento aberto e sem responsável (UPDATE condicional). */
/** O atendimento já é de `u` porque `u` o assumiu por último (#166): o reenvio não grava outro Evento. */
async function jaAssumidoPor(tx: Tx, id: string, u: { id: string }): Promise<boolean> {
  const atual = await tx.atendimentoWhatsApp.findUnique({ where: { id }, select: { responsavelId: true, encerradoEm: true } });
  if (atual?.responsavelId !== u.id || atual.encerradoEm) return false;
  return ultimoEventoEhDoAutor(tx, { agregadoId: id, tipos: TIPOS_RESPONSAVEL, tipo: "AtendimentoAssumido", autorId: u.id, payload: { para: u.id } });
}

/**
 * Assume da fila: só vence quem encontra o atendimento aberto e sem responsável (UPDATE condicional).
 * Idempotente por natureza (#166): o reenvio de quem já o assumiu devolve ok sem outro Evento. Se o atendimento
 * chegou a quem repete por atribuição de outra pessoa, ou está com outro, segue "já assumiu".
 */
export async function assumirConversaDaAria(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    if (await assumirAriaNoBanco(prisma, u.id, id)) revalidatePath("/inbox");
  });
}

export async function assumirAtendimento(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    const a = await atendimentoVisivel(u, id);
    if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
    if (a.responsavelId === u.id && !a.encerradoEm && await prisma.$transaction((tx) => jaAssumidoPor(tx, id, u))) return;
    if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
    if (a.responsavelId !== null) throw new ErroRegra(MSG_JA_ASSUMIDO);
    if (!podeExecutar(u, "assumir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
    const repetido = await prisma.$transaction(async (tx) => {
      const status = proximoStatus(a.status, "ASSUMIDO", true);
      const r = await tx.atendimentoWhatsApp.updateMany({ where: { id, responsavelId: null, encerradoEm: null }, data: { responsavelId: u.id, status } });
      // Clique duplo: o UPDATE do segundo espera o primeiro confirmar e não acha mais a fila.
      if (r.count !== 1) {
        if (await jaAssumidoPor(tx, id, u)) return true;
        throw new ErroRegra(MSG_JA_ASSUMIDO);
      }
      await exigirResponsavelEnxerga(tx, id, u);
      await registrarEvento(tx, { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: null, para: u.id } });
      return false;
    });
    if (!repetido) revalidatePath("/inbox");
  });
}

/**
 * Devolve à fila: zera o responsável, volta a ABERTO_SEM_RESPONSAVEL e cancela as intenções humanas pendentes dele.
 * Idempotente por natureza (#166): se quem repete foi quem devolveu por último, devolve ok sem outro Evento.
 */
export async function devolverParaFila(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id, false, tx);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (a.responsavelId === null) {
        if (await ultimoEventoEhDoAutor(tx, { agregadoId: id, tipos: TIPOS_RESPONSAVEL, tipo: "AtendimentoDevolvido", autorId: u.id })) return;
        throw new ErroRegra("Este atendimento já está na fila.");
      }
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
    await prisma.$transaction((tx) => atribuirAtendimentoTx(tx, u, id, usuarioId));
    revalidatePath("/inbox");
  });
}

const TransferirSchema = z.object({
  atendimentoId: z.string().min(1),
  destino: z.enum(SETORES as [Setor, ...Setor[]]),
  destinoChave: z.string().min(1).nullable(),
  contexto: z.string().trim().min(12, "Descreva o contexto da transferência (mínimo de 12 caracteres).").max(1000),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

/**
 * Transferir = encerrar a origem e abrir outro atendimento no setor de destino (E3.3); o contexto da origem nunca muda.
 * Com `chaveIdempotencia` (#166), o reenvio da mesma tentativa devolve o atendimento novo já aberto. A busca roda
 * antes das validações de estado: com a origem já encerrada, o reenvio tardio recebe o mesmo atendimento.
 */
export async function transferirAtendimento(input: { atendimentoId: string; destino: Setor; destinoChave: string | null; contexto: string; chaveIdempotencia?: string }): Promise<Resultado<{ novoAtendimentoId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { chaveIdempotencia, ...dados } = TransferirSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const novoId = await prisma.$transaction((tx) => transferirAtendimentoTx(tx, u, dados, marca)).catch(comoErroRegra);
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
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

/**
 * Convida alguém (de qualquer setor) a ver o atendimento, por prazo de até 30 dias (E3.4). Início = agora; concedente = quem convida.
 * Com `chaveIdempotencia` (#166), o reenvio da mesma tentativa devolve o convite já criado em vez de "já participa".
 */
export async function convidarParticipante(input: { atendimentoId: string; usuarioId: string; podeEnviar: boolean; fim: string; motivo: string; chaveIdempotencia?: string }): Promise<Resultado<{ participanteId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { chaveIdempotencia, ...dados } = ConvidarSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const agora = new Date();
    const fim = new Date(dados.fim);
    const participanteId = await prisma.$transaction(async (tx) => {
      if (marca) {
        // Antes das validações de prazo: o reenvio de um convite já criado devolve o mesmo, mesmo perto do fim.
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "ParticipanteConvidado", agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outro convite. Confira os participantes do atendimento antes de repetir.",
        });
        if (repetido) return String((repetido.payload as { participanteId?: unknown }).participanteId);
      }
      if (fim <= agora) throw new ErroRegra("O fim do convite precisa ser no futuro.");
      if (fim.getTime() > agora.getTime() + PRAZO_MAXIMO_CONVITE_DIAS * 86_400_000) throw new ErroRegra(`O convite pode durar no máximo ${PRAZO_MAXIMO_CONVITE_DIAS} dias.`);
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${dados.atendimentoId} FOR UPDATE`;
      const a = await atendimentoVisivel(u, dados.atendimentoId, false, tx);
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
      await avisarMudancaDeEscopo(tx, a.id);
      await registrarEvento(tx, { tipo: "ParticipanteConvidado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id, payload: { participanteId: p.id, usuarioId: dados.usuarioId, podeEnviar: dados.podeEnviar, fim: fim.toISOString(), motivo: dados.motivo, ...marca } });
      return p.id;
    });
    revalidatePath("/inbox");
    return { participanteId };
  });
}

/**
 * Convite e revogação só gravam em ParticipanteAtendimentoWhatsApp, que não tem o trigger `notificar_inbox`. Um
 * UPDATE sem mudança no AtendimentoWhatsApp, na mesma transação, dispara o `atendimento.atualizado` (o trigger é
 * FOR EACH ROW sem WHEN; o NOTIFY só sai no commit): o convidado vê o compositor liberar (ou travar) sem reabrir.
 */
async function avisarMudancaDeEscopo(tx: Prisma.TransactionClient, atendimentoId: string): Promise<void> {
  await avisarAtendimento(tx, atendimentoId);
}

/**
 * Depois da revogação o ex-convidado está fora do escopo, e o filtro do SSE descartaria o `atendimento.atualizado`
 * comum: este aviso direcionado (só ids, nenhum conteúdo da conversa) passa só para ele, o painel recarrega com 404
 * e o compositor trava sem reabrir (C1 da revisão do #223). O NOTIFY, como o do trigger, só sai no commit.
 */
async function avisarRevogado(tx: Prisma.TransactionClient, atendimento: { id: string; conversaId: string }, usuarioId: string): Promise<void> {
  const aviso: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: atendimento.id, mensagemId: null, conversaId: atendimento.conversaId, paraUsuarioId: usuarioId };
  await tx.$executeRaw`SELECT pg_notify(${CANAL_INBOX}, ${JSON.stringify(aviso)})`;
}

/**
 * Revoga na hora (revogadoEm = agora, sem delete). Quem revoga: o concedente, o gerente do setor ou o administrador.
 * Idempotente por natureza (#166): o reenvio de quem revogou devolve ok sem outro Evento; revogado por outra pessoa,
 * segue recusado.
 */
export async function revogarParticipante(participanteId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(participanteId);
    await prisma.$transaction(async (tx) => {
      const p = await tx.participanteAtendimentoWhatsApp.findUnique({ where: { id }, include: { atendimento: { select: { id: true, finalidade: true, conversaId: true } }, usuario: { select: { id: true, papeis: true } } } });
      if (!p) throw new ErroRegra("Participante não encontrado.");
      const permitido = p.concedenteId === u.id || u.papeis.includes(Papel.ADMINISTRADOR) || ehGerenteDoSetor(u.papeis, p.atendimento.finalidade);
      if (!permitido) throw new ErroRegra(MSG_SEM_ALCADA);
      const agora = new Date();
      const r = await tx.participanteAtendimentoWhatsApp.updateMany({ where: { id, revogadoEm: null }, data: { revogadoEm: agora } });
      if (r.count !== 1) {
        // #166: o reenvio de quem revogou devolve ok sem outro Evento (o UPDATE do clique duplo espera o primeiro).
        const revogacao = await tx.evento.findFirst({
          where: { tipo: "ParticipanteRevogado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: p.atendimento.id, payload: { path: ["participanteId"], equals: id } },
          select: { autorId: true },
        });
        if (revogacao?.autorId === u.id) return;
        throw new ErroRegra("Este convite já foi revogado.");
      }
      await avisarMudancaDeEscopo(tx, p.atendimento.id);
      await avisarRevogado(tx, p.atendimento, p.usuarioId);
      // Como devolver/atribuir: o que o revogado deixou pendente ou agendado fica CANCELADA, a menos que ele
      // ainda possa enviar neste atendimento por outro vínculo (responsável, gerente, outro convite).
      const aindaEnvia = await tx.atendimentoWhatsApp.count({ where: { AND: [{ id: p.atendimento.id }, await escopoAtendimentos(p.usuario, { enviar: true, agora, db: tx })] } });
      if (aindaEnvia === 0) {
        await tx.intencaoMensagem.updateMany({
          where: { atendimentoId: p.atendimento.id, origem: "HUMANO", autorId: p.usuarioId, status: { in: ["PENDENTE", "ADIADA"] } },
          data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELAMENTO_REVOGADO },
        });
      }
      await registrarEvento(tx, { tipo: "ParticipanteRevogado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: p.atendimento.id, autorId: u.id, payload: { participanteId: id, usuarioId: p.usuarioId } });
    });
    revalidatePath("/inbox");
  });
}
