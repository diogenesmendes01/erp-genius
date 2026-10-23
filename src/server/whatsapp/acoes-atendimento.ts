"use server";

import { revalidatePath } from "next/cache";
import { Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { CANAL_INBOX, type AvisoInbox } from "@/server/inbox/barramento";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel, encerrarAtendimentoNaTransacao, garantirAtendimento } from "./atendimentos";
import { escopoAtendimentos } from "./escopo";
import { SETORES, ehGerenteDoSetor, papeisDoSetor, type Setor } from "./setor";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "./participantes";
import { setoresDoNumero } from "./numero-setor";
import { comoErroRegra } from "./erro-regra-atendimento";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
import { ehLinhaComercial } from "./linha-comercial";
import { proximoStatus } from "./status-atendimento";

const MSG_JA_ASSUMIDO = "Outro atendente já assumiu este atendimento.";
const MSG_FORA_DO_ESCOPO = "Atendimento fora do seu escopo.";
const MSG_SEM_ALCADA = "Sua função não autoriza esta ação neste atendimento.";
const MOTIVO_CANCELAMENTO = "Responsável do atendimento mudou; revisar antes de enviar.";
const MOTIVO_CANCELAMENTO_REVOGADO = "Convite de participante revogado; revisar antes de enviar.";
const MSG_RESPONSAVEL_SEM_ACESSO_LINHA =
  "Nesta linha de vendas o atendimento fica com o dono da linha; ele não pode ser assumido por quem não atende a linha.";
const MSG_RESPONSAVEL_SEM_ACESSO =
  "Esta pessoa não teria acesso a este atendimento depois da mudança; escolha quem atende o setor e a conversa.";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Depois de gravar o novo responsável (mesma transação): ele precisa continuar enxergando o atendimento. Numa linha
 * de VENDAS o responsável gravado não dá acesso ao COMERCIAL (LC-D02, escopo.ts); sem esta conferência o atendimento
 * sairia da fila e ficaria invisível para quem o assumiu.
 */
async function exigirResponsavelEnxerga(tx: Tx, id: string, alvo: { id: string; papeis: Papel[] }) {
  const n = await tx.atendimentoWhatsApp.count({ where: { AND: [{ id }, await escopoAtendimentos(alvo, { db: tx })] } });
  if (n === 1) return;
  // O texto segue o motivo: só a linha de vendas tem a regra do dono da linha.
  const a = await tx.atendimentoWhatsApp.findUnique({ where: { id }, select: { finalidade: true, conversa: { select: { numero: { select: { finalidade: true } } } } } });
  const linha = a?.finalidade === "COMERCIAL" && !!a.conversa.numero && ehLinhaComercial(a.conversa.numero);
  throw new ErroRegra(linha ? MSG_RESPONSAVEL_SEM_ACESSO_LINHA : MSG_RESPONSAVEL_SEM_ACESSO);
}

const IdSchema = z.string().min(1);
const AtribuirSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1) });

/** Tira o atendimento de quem o tinha: intenções humanas ainda não enviadas deixam de valer (como comercial/acoes.ts, atribuirDono). */
async function cancelarIntencoesDoResponsavel(tx: Tx, atendimentoId: string, responsavelId: string | null) {
  if (!responsavelId) return;
  await tx.intencaoMensagem.updateMany({
    where: { atendimentoId, origem: "HUMANO", autorId: responsavelId, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELAMENTO },
  });
}

/** Eventos que mudam o responsável do atendimento: o último deles diz quem deixou o estado atual. */
const TIPOS_RESPONSAVEL = ["AtendimentoAssumido", "AtendimentoDevolvido", "AtendimentoAtribuido"];

/**
 * #166: o estado-alvo já foi alcançado por quem repete? Confere o último Evento do agregado entre `tipos`: ele
 * precisa ser `tipo` e deste autor. Se o estado veio de outra pessoa (ou de fora do ERP), a ação segue recusada.
 */
async function ultimoEventoEhDoAutor(tx: Tx, alvo: { agregadoId: string; tipos: string[]; tipo: string; autorId: string; payload?: Record<string, string | null> }): Promise<boolean> {
  const ultimo = await tx.evento.findFirst({
    where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: alvo.agregadoId, tipo: { in: alvo.tipos } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { tipo: true, autorId: true, payload: true },
  });
  if (!ultimo || ultimo.tipo !== alvo.tipo || ultimo.autorId !== alvo.autorId) return false;
  const payload = (ultimo.payload ?? {}) as Record<string, unknown>;
  return Object.entries(alvo.payload ?? {}).every(([k, v]) => payload[k] === v);
}

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
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id, false, tx);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(u, "atribuir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const alvo = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, ativo: true, papeis: true } });
      const doSetor = papeisDoSetor(a.finalidade);
      if (!alvo || !alvo.ativo || !alvo.papeis.some((p) => doSetor.includes(p))) throw new ErroRegra("A pessoa escolhida não atende este setor.");
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      if (anterior === usuarioId) return;
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: usuarioId, status: proximoStatus(atual.status, "ASSUMIDO", true) } });
      await exigirResponsavelEnxerga(tx, id, alvo);
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
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

/**
 * A chave do destino é a de `listarOpcoesAtendimento`, mas resolvida contra o banco e não contra o que o usuário
 * enxerga (quem transfere não precisa ter alçada no setor de destino). FINANCEIRO:<matrícula>;
 * PEDAGOGICO:<aluno>:<turma>:<matrícula>:(ALUNO|AUT:<autorização>).
 */
async function resolverDestino(tx: Tx, destino: Setor, chave: string | null, telefoneContato: string) {
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
    // Mesmo critério da lista de opções: aluno, turma e matrícula precisam formar uma alocação ativa
    // (o escopo do professor usa { alunoId, turmaId }; os triggers só olham matrícula × aluno).
    const alocacao = await tx.alocacaoTurma.count({ where: { ativa: true, alunoId: p[1], turmaId: p[2], matriculaId: p[3] } });
    if (alocacao === 0) throw new ErroRegra("A turma escolhida não corresponde a uma alocação ativa desta matrícula.");
    return { alunoId: p[1], matriculaId: p[3], turmaId: p[2], autorizacaoComunicacaoAcademicaId: autorizacao };
  }
  return null;
}

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
    const novoId = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "AtendimentoTransferido", agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra transferência. Confira os atendimentos da conversa antes de repetir.",
        });
        if (repetido) return String((repetido.payload as { novoId?: unknown }).novoId);
      }
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${dados.atendimentoId} FOR UPDATE`;
      const a = await atendimentoVisivel(u, dados.atendimentoId, false, tx);
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
      const payload = { de: a.finalidade, para: dados.destino, origemId: a.id, novoId: novo.id, contexto: dados.contexto, ...marca };
      for (const agregadoId of [a.id, novo.id]) {
        await registrarEvento(tx, { tipo: "AtendimentoTransferido", agregadoTipo: "AtendimentoWhatsApp", agregadoId, autorId: u.id, payload });
      }
      // O contexto também vira nota interna do novo atendimento (mesmo mecanismo de registrarNotaAtendimento), autor = quem transferiu.
      await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: novo.id, autorId: u.id, payload: { nota: dados.contexto } });
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
  await tx.$executeRaw`UPDATE "AtendimentoWhatsApp" SET "id" = "id" WHERE "id" = ${atendimentoId}`;
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
