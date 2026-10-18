import { EtapaLead, Papel, Prisma, type AcaoAgenteIA } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado, type UsuarioSessao } from "../_shared";
import { escopoComercialAtual } from "../_shared/escopo-comercial";
import { transicaoManualPermitida } from "../_shared/regras";
import { capacidadesAria } from "./permissoes-tela";
import { aplicarAcao, efetivarRespostaSugerida } from "./turno/executor";

// Histórico da Aria (Task 24): aprovar, rejeitar e desfazer. O servidor revalida tudo na hora da
// decisão (FOR UPDATE na ação e no alvo) e nunca sobrescreve o que uma pessoa fez depois.

type Tx = Prisma.TransactionClient;
type Json = Prisma.InputJsonValue;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload gravado pelo próprio executor
type Dados = Record<string, any>;

const MSG_JA_DECIDIDA = "Esta sugestão já foi decidida.";
const MSG_CAMPO_HUMANO = "O campo foi alterado por uma pessoa depois da Aria. Nada foi desfeito.";

async function exigirDecisor(): Promise<UsuarioSessao> {
  const u = await exigirSessao();
  if (!capacidadesAria(u).has("decidirHistorico")) throw new ErroPermissao("Sem permissão para decidir ações da Aria.");
  return u;
}

async function travarAcao(tx: Tx, id: string): Promise<AcaoAgenteIA> {
  await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id = ${id} FOR UPDATE`;
  const acao = await tx.acaoAgenteIA.findUnique({ where: { id } });
  if (!acao) throw new ErroRegra("Ação da Aria não encontrada.");
  return acao;
}

/** Gerente só decide sobre oportunidades da própria equipe; ação sem oportunidade é só do Administrador. */
async function exigirEscopo(tx: Tx, u: UsuarioSessao, acao: AcaoAgenteIA): Promise<void> {
  let leadId = acao.oportunidadeId;
  if (!leadId && acao.atendimentoId) {
    leadId = (await tx.atendimentoWhatsApp.findUnique({ where: { id: acao.atendimentoId }, select: { leadId: true } }))?.leadId ?? null;
  }
  if (leadId) {
    const visivel = await tx.oportunidade.findFirst({ where: { AND: [{ id: leadId }, await escopoComercialAtual(u, tx)] }, select: { id: true } });
    if (visivel) return;
  } else if (u.papeis.includes(Papel.ADMINISTRADOR)) return;
  throw new ErroRegra("Esta ação está fora do seu escopo.");
}

const travarLead = (tx: Tx, id: string) => tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
const mesmo = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const eventoAcao = (tx: Tx, tipo: string, acao: AcaoAgenteIA, autorId: string, extra: Record<string, Json | null> = {}) =>
  registrarEvento(tx, { tipo, agregadoTipo: "AcaoAgenteIA", agregadoId: acao.id, autorId, payload: { acaoAgenteIAId: acao.id, acao: acao.acao, ...extra } });

export async function aprovarAcaoAria(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirDecisor();
    await prisma.$transaction(async (tx) => {
      const acao = await travarAcao(tx, id);
      await exigirEscopo(tx, u, acao);
      if (acao.status !== "SUGERIDA") throw new ErroRegra(MSG_JA_DECIDIDA);
      if (acao.expiraEm && acao.expiraEm.getTime() <= Date.now()) throw new ErroRegra("Esta sugestão expirou.");
      const r = acao.acao === "RESPONDER" || acao.acao === "ENVIAR_DOCUMENTO" ? await efetivarRespostaSugerida(tx, acao) : await aplicarAcao(tx, acao);
      await tx.acaoAgenteIA.update({ where: { id }, data: { status: "APROVADA", decididaPorId: u.id, decididaEm: new Date(), eventoId: r.eventoId } });
      await eventoAcao(tx, "AcaoAriaAprovada", acao, u.id, { efeitoEventoId: r.eventoId });
    });
  });
}

export async function rejeitarAcaoAria(id: string, motivo?: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirDecisor();
    const m = motivo?.trim() ? motivo.trim().slice(0, 500) : null;
    await prisma.$transaction(async (tx) => {
      const acao = await travarAcao(tx, id);
      await exigirEscopo(tx, u, acao);
      if (acao.status !== "SUGERIDA") throw new ErroRegra(MSG_JA_DECIDIDA);
      const payload = { ...((acao.payload ?? {}) as Dados), ...(m ? { motivoRejeicao: m } : {}) } as Prisma.InputJsonObject;
      await tx.acaoAgenteIA.update({ where: { id }, data: { status: "REJEITADA", decididaPorId: u.id, decididaEm: new Date(), payload } });
      await eventoAcao(tx, "AcaoAriaRejeitada", acao, u.id, { motivo: m });
    });
  });
}

/** Houve mudança humana no campo depois da ação? Evento do mesmo agregado e campo, sem ator ARIA. */
async function campoMudouPorHumano(tx: Tx, acao: AcaoAgenteIA, p: Dados, atual: unknown): Promise<boolean> {
  if (!mesmo(atual, p.para)) return true;
  const eventos = await tx.evento.findMany({
    where: { agregadoTipo: "Pessoa", agregadoId: p.pessoaId, tipo: "CampoPersonalizadoAlterado", criadoEm: { gt: acao.criadoEm } },
    select: { payload: true },
  });
  return eventos.some((e) => {
    const pl = (e.payload ?? {}) as Dados;
    return pl.campoId === p.campoId && pl.ator !== "ARIA";
  });
}

async function reverter(tx: Tx, u: UsuarioSessao, acao: AcaoAgenteIA): Promise<void> {
  const p = (acao.payload ?? {}) as Dados;
  const opId = acao.oportunidadeId;
  const base = { acaoAgenteIAId: acao.id, origem: "desfazer_aria" };

  switch (acao.acao) {
    case "MOVER_ETAPA": {
      if (!opId) throw new ErroRegra("Oportunidade não encontrada.");
      await travarLead(tx, opId);
      const lead = await tx.oportunidade.findUnique({ where: { id: opId }, select: { etapa: true } });
      if (!lead) throw new ErroRegra("Oportunidade não encontrada.");
      if (lead.etapa !== p.para) throw new ErroRegra("A etapa foi alterada depois da Aria. Nada foi desfeito.");
      if (!transicaoManualPermitida(lead.etapa, p.de as EtapaLead)) throw new ErroRegra("A transição de volta não é mais permitida. Nada foi desfeito.");
      await tx.oportunidade.update({ where: { id: opId }, data: { etapa: p.de } });
      await registrarEvento(tx, { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: opId, autorId: u.id, payload: { ...base, de: lead.etapa, para: p.de } });
      return;
    }
    case "MARCAR_PERDIDO": {
      if (!opId) throw new ErroRegra("Oportunidade não encontrada.");
      await travarLead(tx, opId);
      const lead = await tx.oportunidade.findUnique({ where: { id: opId }, select: { etapa: true, motivoPerda: true } });
      if (!lead) throw new ErroRegra("Oportunidade não encontrada.");
      if (lead.etapa !== EtapaLead.PERDIDO || lead.motivoPerda !== p.motivoPerda) throw new ErroRegra("A oportunidade foi alterada depois da Aria. Nada foi desfeito.");
      await tx.oportunidade.update({ where: { id: opId }, data: { etapa: p.de, motivoPerda: p.motivoPerdaAnterior ?? null } });
      await registrarEvento(tx, { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: opId, autorId: u.id, payload: { ...base, de: EtapaLead.PERDIDO, para: p.de } });
      return;
    }
    case "TAG": {
      const chave = { pessoaId_tagId: { pessoaId: p.pessoaId, tagId: p.tagId } };
      if (!(await tx.pessoaTag.findUnique({ where: chave }))) throw new ErroRegra("A tag já foi removida. Nada foi desfeito.");
      await tx.pessoaTag.delete({ where: chave });
      await registrarEvento(tx, { tipo: "TagRemovida", agregadoTipo: "Pessoa", agregadoId: p.pessoaId, autorId: u.id, payload: { ...base, tagId: p.tagId, nome: p.nome ?? null } });
      return;
    }
    case "ATUALIZAR_CAMPO": {
      const valor = await tx.valorCampoPersonalizado.findFirst({ where: { campoId: p.campoId, pessoaId: p.pessoaId } });
      if (await campoMudouPorHumano(tx, acao, p, valor?.valor ?? null)) throw new ErroRegra(MSG_CAMPO_HUMANO);
      const de = (p.de ?? null) as Json | null;
      if (valor) await tx.valorCampoPersonalizado.update({ where: { id: valor.id }, data: { valor: de === null ? Prisma.JsonNull : de } });
      await registrarEvento(tx, { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: p.pessoaId, autorId: u.id, payload: { ...base, campoId: p.campoId, nome: p.nomeCampo ?? null, de: p.para ?? null, para: de } });
      return;
    }
    case "CRIAR_TAREFA": {
      const t = p.tarefaId ? await tx.tarefa.findUnique({ where: { id: p.tarefaId } }) : null;
      if (!t) throw new ErroRegra("Tarefa não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id = ${t.id} FOR UPDATE`;
      const r = await tx.tarefa.updateMany({
        where: { id: t.id, status: "ABERTA" },
        data: { status: "CANCELADA", canceladaEm: new Date(), motivoCancelamento: "Desfeita: ação da Aria desfeita por uma pessoa.", lembrarEm: null, versao: { increment: 1 } },
      });
      if (r.count === 0) throw new ErroRegra("A tarefa já foi tratada por uma pessoa. Nada foi desfeito.");
      await registrarEvento(tx, { tipo: "TarefaCancelada", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: u.id, payload: { ...base, motivo: "Ação da Aria desfeita" } });
      return;
    }
    case "NOTA_INTERNA": {
      if (!acao.eventoId || !acao.atendimentoId) throw new ErroRegra("Nota não encontrada.");
      await registrarEvento(tx, { tipo: "NotaInternaArquivada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: acao.atendimentoId, autorId: u.id, payload: { ...base, eventoId: acao.eventoId } });
      return;
    }
    case "AGENDAR_MENSAGEM": {
      const intencaoId = acao.intencaoId;
      if (!intencaoId) throw new ErroRegra("Mensagem agendada não encontrada.");
      await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id = ${intencaoId} FOR UPDATE`;
      const r = await tx.intencaoMensagem.updateMany({
        where: { id: intencaoId, status: { in: ["PENDENTE", "ADIADA"] } },
        data: { status: "CANCELADA", motivoFalha: "desfeita_pela_gestao" },
      });
      if (r.count === 0) throw new ErroRegra("A mensagem já foi despachada ou cancelada. Nada foi desfeito.");
      await registrarEvento(tx, { tipo: "MensagemAgendadaCancelada", agregadoTipo: "IntencaoMensagem", agregadoId: intencaoId, autorId: u.id, payload: base });
      return;
    }
    default:
      throw new ErroRegra("Esta ação não pode ser desfeita.");
  }
}

export async function desfazerAcaoAria(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirDecisor();
    await prisma.$transaction(async (tx) => {
      const acao = await travarAcao(tx, id);
      await exigirEscopo(tx, u, acao);
      if (acao.status === "DESFEITA") throw new ErroRegra("Esta ação já foi desfeita.");
      if (acao.status !== "EXECUTADA" && acao.status !== "APROVADA") throw new ErroRegra("Só ações executadas ou aprovadas podem ser desfeitas.");
      if (!acao.reversivel) throw new ErroRegra(acao.motivoIrreversivel ?? "Esta ação não pode ser desfeita.");
      await reverter(tx, u, acao);
      await tx.acaoAgenteIA.update({ where: { id }, data: { status: "DESFEITA", desfeitaPorId: u.id, desfeitaEm: new Date() } });
      await eventoAcao(tx, "AcaoAriaDesfeita", acao, u.id);
    });
  });
}
