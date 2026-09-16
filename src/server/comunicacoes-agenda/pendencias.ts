import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { MotivoPendenciaAvisoAgenda, Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import { validarFonteReplanejamentoConjuntoTx } from "./fonte-replanejamento";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";

export const motivosPendenciaAvisoAgenda = [
  MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO,
  MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL,
  MotivoPendenciaAvisoAgenda.CONTATO_SEM_OPT_IN,
  MotivoPendenciaAvisoAgenda.CONTATO_INDISPONIVEL,
] as const;

type EntradaPendencia = { eventoId: string; matriculaId: string; motivo: MotivoPendenciaAvisoAgenda };
const hashContato = (valor: string) => createHash("sha256").update(valor).digest("hex");
const ReconferirSchema = z.object({ pendenciaId: z.string().trim().min(1), motivo: z.string().trim().min(5).max(2_000) }).strict();

/** Registra uma falha operacional visível sem criar intenção, tentativa ou transporte. */
export async function registrarPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: EntradaPendencia) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${entrada.eventoId}:${entrada.matriculaId}:${entrada.motivo}`}, 0))`;
  const existente = await tx.pendenciaAvisoAgenda.findFirst({
    where: { eventoId: entrada.eventoId, matriculaId: entrada.matriculaId, motivo: entrada.motivo, situacao: "PENDENTE" },
    select: { id: true },
  });
  if (existente) return { id: existente.id, criada: false };
  const criada = await tx.pendenciaAvisoAgenda.create({ data: { id: randomUUID(), ...entrada }, select: { id: true } });
  return { id: criada.id, criada: true };
}

/** Só o fluxo que confirmou a condição corrigida deve encerrar a pendência; não reabre transporte. */
export async function resolverPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: { id: string; resolvidaPorId: string; observacaoResolucao: string }) {
  const autor = await tx.usuario.findFirst({ where: { id: entrada.resolvidaPorId, ativo: true, papeis: { hasSome: ["ADMINISTRADOR", "SECRETARIA_ACADEMICA"] } }, select: { id: true } });
  if (!autor) throw new Error("Resolutor sem papel atual.");
  const observacao = entrada.observacaoResolucao.trim();
  if (observacao.length < 5 || observacao.length > 2_000) throw new Error("Observação de resolução inválida.");
  const atual = await tx.pendenciaAvisoAgenda.findUnique({ where: { id: entrada.id }, select: { situacao: true, resolvidaPorId: true, observacaoResolucao: true } });
  if (!atual) return false;
  if (atual.situacao === "RESOLVIDA") return atual.resolvidaPorId === entrada.resolvidaPorId && atual.observacaoResolucao === observacao;
  await tx.pendenciaAvisoAgenda.update({ where: { id: entrada.id }, data: { situacao: "RESOLVIDA", resolvidaEm: new Date(), resolvidaPorId: entrada.resolvidaPorId, observacaoResolucao: observacao } });
  return true;
}

function encontrosDoEvento(payload: unknown) {
  const p = payload as { encontrosIds?: unknown; encontroOriginalId?: unknown; encontroNovoId?: unknown };
  if (Array.isArray(p.encontrosIds) && p.encontrosIds.every((id) => typeof id === "string" && id)) return [...new Set(p.encontrosIds)];
  const ids = [p.encontroOriginalId, p.encontroNovoId].filter((id): id is string => typeof id === "string" && !!id);
  return [...new Set(ids)];
}

/**
 * Confere a fonte aplicada sem criar avisos. O conjunto devolvido é sempre o
 * subconjunto histórico da matrícula; por isso uma pendência nunca revela
 * encontros de outra turma ao ser reconferida.
 */
async function encontrosElegiveisDaFonteTx(tx: Prisma.TransactionClient, entrada: { eventoId: string; matriculaId: string; evento: { tipo: string; agregadoTipo: string; agregadoId: string; payload: unknown } }) {
  const payload = entrada.evento.payload as { aprovada?: unknown; encontrosIds?: unknown; horarios?: unknown };
  const idsDaFonte = encontrosDoEvento(payload);
  if (!idsDaFonte.length || payload.aprovada !== true) return null;
  const remarcacao = entrada.evento.agregadoTipo === "Matricula" && entrada.evento.agregadoId === entrada.matriculaId && ["RemarcacaoParticularDecidida", "RemarcacaoAgendaReposicaoDecidida"].includes(entrada.evento.tipo);
  const substituicao = entrada.evento.agregadoTipo === "ConfiguracaoOperacional" && entrada.evento.agregadoId === "escola" && entrada.evento.tipo === "SubstituicaoDocenteDecidida";
  const replanejamento = entrada.evento.agregadoTipo === "ConfiguracaoOperacional" && entrada.evento.agregadoId === "escola" && entrada.evento.tipo === "ReplanejamentoConjuntoAplicado";
  if (!remarcacao && !substituicao && !replanejamento) return null;
  const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: idsDaFonte } }, select: { id: true, matriculaId: true, turmaId: true, inicio: true } });
  if (encontros.length !== idsDaFonte.length) return null;

  if (remarcacao) return encontros.every((encontro) => encontro.matriculaId === entrada.matriculaId) ? idsDaFonte : null;

  if (replanejamento) {
    const horarios = Array.isArray(payload.horarios) ? payload.horarios as { encontroId?: unknown; inicioAnterior?: unknown; inicioProposto?: unknown }[] : [];
    const turmasIds = encontros.flatMap((encontro) => encontro.turmaId ? [encontro.turmaId] : []);
    const alocacoes = await tx.alocacaoTurma.findMany({ where: { matriculaId: entrada.matriculaId, turmaId: { in: turmasIds } }, select: { turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } });
    const elegiveis = encontros.filter((encontro) => {
      const horario = horarios.find((h) => h.encontroId === encontro.id);
      if (!encontro.turmaId || typeof horario?.inicioAnterior !== "string" || typeof horario.inicioProposto !== "string") return false;
      const instantes = [horario.inicioAnterior, horario.inicioProposto] as string[];
      return alocacoes.some((a) => a.turmaId === encontro.turmaId && instantes.some((instante) => alocacaoCobreAula(a, new Date(instante))));
    }).map((encontro) => encontro.id);
    if (!elegiveis.length) return null;
    return (await validarFonteReplanejamentoConjuntoTx(tx, { eventoId: entrada.eventoId, matriculaId: entrada.matriculaId, encontrosIds: elegiveis })) ? elegiveis : null;
  }

  const turmasIds = encontros.flatMap((encontro) => encontro.turmaId ? [encontro.turmaId] : []);
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { matriculaId: entrada.matriculaId, turmaId: { in: turmasIds } }, select: { turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } });
  return encontros.filter((encontro) => encontro.matriculaId === entrada.matriculaId || (!!encontro.turmaId && alocacoes.some((a) => a.turmaId === encontro.turmaId && alocacaoCobreAula(a, encontro.inicio)))).map((encontro) => encontro.id);
}

/** Reconferência explícita: prepara apenas a intenção válida e nunca toca no driver. */
export async function reconferirPendenciaAvisoAgendaInterna(input: unknown): Promise<Resultado<{ resolvida: boolean; explicacao: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const entrada = ReconferirSchema.parse(input);
    return prisma.$transaction(confirmarTransacao(async (tx) => {
      const usuario = await tx.usuario.findFirst({ where: { id: autor.id, ativo: true, papeis: { hasSome: [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR] } }, select: { id: true } });
      if (!usuario) return { resolvida: false, explicacao: "Seu papel atual não permite reconferir esta pendência." };
      await tx.$executeRaw`SELECT id FROM "PendenciaAvisoAgenda" WHERE id = ${entrada.pendenciaId} FOR UPDATE`;
      const pendencia = await tx.pendenciaAvisoAgenda.findUnique({ where: { id: entrada.pendenciaId }, include: { evento: true } });
      if (!pendencia) return { resolvida: false, explicacao: "Pendência não encontrada." };
      if (pendencia.situacao === "RESOLVIDA") return pendencia.resolvidaPorId === autor.id && pendencia.observacaoResolucao === entrada.motivo ? { resolvida: true, explicacao: "Pendência já encerrada por esta reconferência." } : { resolvida: false, explicacao: "Pendência já foi encerrada com outra evidência." };
      const matricula = await tx.matricula.findUnique({ where: { id: pendencia.matriculaId }, select: { status: true } });
      if (matricula?.status !== "ATIVA") return { resolvida: false, explicacao: "A matrícula não está ativa para reconferir o aviso." };
      const encontrosDaMatricula = await encontrosElegiveisDaFonteTx(tx, { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId, evento: pendencia.evento });
      if (!encontrosDaMatricula?.length) return { resolvida: false, explicacao: "A origem aplicada não possui encontros reconferíveis." };
      const encontrosIds = encontrosDaMatricula;
      await tx.$executeRaw`SELECT id FROM "AvisoAlteracaoAgenda" WHERE "eventoId" = ${pendencia.eventoId} AND "matriculaId" = ${pendencia.matriculaId} FOR UPDATE`;
      const existentes = await tx.avisoAlteracaoAgenda.findMany({ where: { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId }, include: { aluno: { include: { pais: { select: { idioma: true } } } }, itens: true } });
      if (existentes.some((aviso) => aviso.situacao === "INCERTO")) return { resolvida: false, explicacao: "Existe aviso com resultado incerto; a reconferência não o reemite." };
      if (existentes.some((aviso) => !aviso.itens.length || aviso.itens.some((item) => !encontrosIds.includes(item.encontroId)))) return { resolvida: false, explicacao: "Os itens congelados do aviso não pertencem mais à fonte válida da matrícula." };
      if (!existentes.length) {
        const { criarAvisosAlteracaoAgendaTx } = await import("./avisos");
        await criarAvisosAlteracaoAgendaTx(tx, { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId, encontrosIds });
      }
      const avisos = await tx.avisoAlteracaoAgenda.findMany({ where: { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId }, include: { aluno: { include: { pais: { select: { idioma: true } } } }, itens: true } });
      if (!avisos.length) return { resolvida: false, explicacao: "A matrícula ainda não possui destinatário acadêmico elegível." };
      const destinosAtuais = (await Promise.all(avisos.map(async (aviso) => {
        if (!aviso.aluno.aceitaComunicacoes) return false;
        if (aviso.canal === "EMAIL") return !!aviso.aluno.email && hashContato(aviso.aluno.email.trim().toLowerCase()) === aviso.contatoHash;
        if (aviso.destinatarioAlunoId === aviso.alunoId) return aviso.aluno.whatsapp && !!aviso.aluno.telefoneE164 && hashContato(aviso.aluno.telefoneE164) === aviso.contatoHash;
        if (!aviso.destinatarioResponsavelId || !aviso.autorizacaoComunicacaoAcademicaId) return false;
        const autorizacao = await tx.autorizacaoComunicacaoAcademica.findFirst({ where: { id: aviso.autorizacaoComunicacaoAcademicaId, matriculaId: pendencia.matriculaId, responsavelId: aviso.destinatarioResponsavelId, vigenteEm: { lte: new Date() }, revogadaEm: null }, include: { responsavel: { select: { telefoneE164: true, alunos: { where: { alunoId: aviso.alunoId, papel: "PEDAGOGICO" }, select: { id: true } } } } } });
        return !!autorizacao?.responsavel.telefoneE164 && !!autorizacao.responsavel.alunos.length && hashContato(autorizacao.responsavel.telefoneE164) === aviso.contatoHash;
      }))).every(Boolean);
      if (!destinosAtuais) return { resolvida: false, explicacao: "Há destinatário congelado sem consentimento ou contato atual; nenhuma intenção foi reemitida." };
      if (pendencia.motivo === MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL && avisos.some((aviso) => aviso.canal === "WHATSAPP")) {
        const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, include: { numeroAvisosAgenda: true, templateAvisosAgenda: true } });
        const { motivoConfiguracaoAgendaInvalida } = await import("./whatsapp");
        if (avisos.some((aviso) => aviso.canal === "WHATSAPP" && motivoConfiguracaoAgendaInvalida(configuracao, aviso.aluno.pais?.idioma ?? "es"))) return { resolvida: false, explicacao: "A configuração institucional de WhatsApp continua indisponível." };
      }
      const resolvida = await resolverPendenciaAvisoAgendaTx(tx, { id: pendencia.id, resolvidaPorId: autor.id, observacaoResolucao: entrada.motivo });
      return resolvida ? { resolvida: true, explicacao: "Condição reconferida; a pendência foi encerrada sem envio." } : { resolvida: false, explicacao: "Não foi possível encerrar a pendência." };
    }));
  });
}
