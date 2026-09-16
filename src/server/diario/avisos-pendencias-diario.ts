"use server";

import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";

const LIMITE = 20;
const minutos = z.number().int().positive().max(2147483647);
const ConfiguracaoSchema = z.object({
  prazoRegularizacaoDiarioMinutos: minutos,
  intervaloLembreteDiarioMinutos: minutos,
}).strict();
const ConsultaSchema = z.object({ cursor: z.string().min(1).max(500).optional() }).strict();

type Cursor = { fim: Date; id: string };
export type ItemAvisoDiario = {
  id: string;
  encontroId: string;
  turma: string;
  professor: string;
  inicio: string;
  fim: string;
  fusoOrigem: string;
  pendencias: string[];
  vencimento: string | null;
  atrasada: boolean;
  ultimoLembreteEm: string | null;
  proximoLembreteEm: string | null;
  quantidadeLembretes: number;
  podeRegularizar: boolean;
};
export type ConsultaAvisosDiario = {
  configurada: boolean;
  configuracao: { prazoRegularizacaoDiarioMinutos: number | null; intervaloLembreteDiarioMinutos: number | null };
  gestao: boolean;
  itens: ItemAvisoDiario[];
  proximoCursor: string | null;
};

function lerCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  try {
    const bruto = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const dado = z.object({ fim: z.string().datetime({ offset: true }), id: z.string().min(1).max(100) }).strict().parse(bruto);
    return { fim: new Date(dado.fim), id: dado.id };
  } catch {
    throw new ErroRegra("Cursor de avisos inválido.");
  }
}
function cursorDe(cursor: Cursor | null) {
  return cursor ? Buffer.from(JSON.stringify({ fim: cursor.fim.toISOString(), id: cursor.id })).toString("base64url") : null;
}
function somarMinutos(instante: Date, quantidade: number) {
  return new Date(instante.getTime() + quantidade * 60_000);
}
function eGestao(papeis: Papel[]) {
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.GERENTE_PEDAGOGICO);
}
function escopoResponsavel(usuarioId: string, papeis: Papel[], agora: Date): Prisma.EncontroAgendaWhereInput {
  const alternativas: Prisma.EncontroAgendaWhereInput[] = [
    { designacoesRegularizacaoAula: { some: { responsavelId: usuarioId, revogacao: { is: null } } } },
  ];
  if (papeis.includes(Papel.PROFESSOR)) alternativas.unshift({ professorId: usuarioId, OR: [
    { turmaId: null },
    { turma: { vinculosDocentes: { some: { professorId: usuarioId, inicio: { lte: agora }, OR: [{ fim: null }, { fim: { gt: agora } }] } } } },
    { propostasSubstituicao: { some: { proposta: { substitutoId: usuarioId, decisao: { is: { aprovada: true } } } } } },
  ] });
  return { OR: alternativas };
}
async function temAtribuicaoVigenteTx(
  tx: Prisma.TransactionClient,
  entrada: { usuarioId: string; papeis: Papel[]; encontro: { id: string; professorId: string | null; turmaId: string | null }; agora: Date },
) {
  if (!entrada.papeis.includes(Papel.PROFESSOR) || entrada.encontro.professorId !== entrada.usuarioId) return false;
  if (!entrada.encontro.turmaId) return true;
  const [vinculo, substituicao] = await Promise.all([
    tx.vinculoDocente.findFirst({ where: { turmaId: entrada.encontro.turmaId, professorId: entrada.usuarioId, inicio: { lte: entrada.agora },
      OR: [{ fim: null }, { fim: { gt: entrada.agora } }] }, select: { id: true } }),
    tx.itemSubstituicaoDocente.findFirst({ where: { encontroId: entrada.encontro.id, proposta: { substitutoId: entrada.usuarioId,
      decisao: { is: { aprovada: true } } } }, select: { id: true } }),
  ]);
  return !!vinculo || !!substituicao;
}

/** Fecha, de forma limitada e somente para o usuário atual, ciclos que deixaram
 * de ter fonte válida. Não altera encontro, diário nem qualquer cobrança. */
async function encerrarCiclosObsoletosTx(
  tx: Prisma.TransactionClient,
  entrada: { usuarioId: string; papeis: Papel[]; gestao: boolean; agora: Date },
) {
  const fontePendente: Prisma.EncontroAgendaWhereInput = {
    finalidade: "AULA", status: "PREVISTO", fim: { lte: entrada.agora },
  };
  const responsavel = escopoResponsavel(entrada.usuarioId, entrada.papeis, entrada.agora);
  const ciclosValidos: Prisma.AvisoPendenciaDiarioWhereInput[] = [
    { tipo: "DOCENTE", encontro: { is: { ...fontePendente, AND: [responsavel] } } },
    ...(entrada.gestao ? [{ tipo: "GESTAO" as const, encontro: { is: { ...fontePendente, NOT: responsavel } } }] : []),
  ];
  // Filtrar fontes inválidas ANTES do limite evita que vinte pendências ainda
  // válidas impeçam para sempre o encerramento dos ciclos mais antigos.
  const obsoletos = await tx.avisoPendenciaDiario.findMany({
    where: { destinatarioId: entrada.usuarioId, encerradoEm: null, NOT: { OR: ciclosValidos } },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }], take: LIMITE,
    select: { id: true, encontroId: true },
  });
  for (const aviso of obsoletos) {
    await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${aviso.encontroId} FOR UPDATE`;
    if (await tx.avisoPendenciaDiario.count({ where: { id: aviso.id, OR: ciclosValidos } })) continue;
    const encontro = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: aviso.encontroId }, select: { status: true } });
    const encerramento = encontro.status === "MINISTRADO" ? "RESOLVIDO" : "CANCELADO";
    await tx.avisoPendenciaDiario.update({ where: { id: aviso.id }, data: {
      encerramento, encerradoEm: entrada.agora, proximoLembreteEm: null,
    } });
    await registrarEvento(tx, { tipo: "AvisoPendenciaDiarioEncerrado", agregadoTipo: "EncontroAgenda", agregadoId: aviso.encontroId,
      autorId: entrada.usuarioId, payload: { avisoId: aviso.id, encontroId: aviso.encontroId, encerramento, encerradoEm: entrada.agora.toISOString() } });
  }
}

async function atualizarCicloTx(
  tx: Prisma.TransactionClient,
  entrada: { encontroId: string; destinatarioId: string; tipo: "DOCENTE" | "GESTAO"; fim: Date; agora: Date; prazo: number; intervalo: number },
) {
  const vencimento = somarMinutos(entrada.fim, entrada.prazo);
  const primeiroLembrete = entrada.tipo === "DOCENTE" ? entrada.fim : vencimento;
  const existente = await tx.avisoPendenciaDiario.findUnique({ where: {
    encontroId_destinatarioId_tipo: { encontroId: entrada.encontroId, destinatarioId: entrada.destinatarioId, tipo: entrada.tipo },
  } });
  if (!existente) {
    const emitir = primeiroLembrete <= entrada.agora;
    return tx.avisoPendenciaDiario.create({ data: {
      encontroId: entrada.encontroId, destinatarioId: entrada.destinatarioId, tipo: entrada.tipo, vencimento,
      ultimoLembreteEm: emitir ? entrada.agora : null,
      proximoLembreteEm: emitir ? somarMinutos(entrada.agora, entrada.intervalo) : primeiroLembrete,
      quantidadeLembretes: emitir ? 1 : 0, indiceLembrete: emitir ? 1 : 0,
    } });
  }
  // A política atual recalcula a cadência desde o último aviso efetivamente
  // registrado. Não reutilizar um próximo horário calculado com intervalo antigo.
  const proximo = new Date(Math.max(primeiroLembrete.getTime(),
    existente.ultimoLembreteEm ? somarMinutos(existente.ultimoLembreteEm, entrada.intervalo).getTime() : primeiroLembrete.getTime()));
  if (existente.encerradoEm) {
    await registrarEvento(tx, { tipo: "AvisoPendenciaDiarioReaberto", agregadoTipo: "EncontroAgenda", agregadoId: entrada.encontroId,
      autorId: entrada.destinatarioId, payload: { avisoId: existente.id, encontroId: entrada.encontroId, encerramentoAnterior: existente.encerramento,
        encerradoEmAnterior: existente.encerradoEm.toISOString(), reabertoEm: entrada.agora.toISOString() } });
  }
  const emitir = proximo <= entrada.agora;
  return tx.avisoPendenciaDiario.update({ where: { id: existente.id }, data: {
    vencimento, encerramento: null, encerradoEm: null,
    ...(emitir ? {
      ultimoLembreteEm: entrada.agora,
      proximoLembreteEm: somarMinutos(entrada.agora, entrada.intervalo),
      quantidadeLembretes: { increment: 1 }, indiceLembrete: { increment: 1 },
    } : { proximoLembreteEm: proximo }),
  } });
}

/** Q22: refresh por acesso ao painel. É pull interno; não há job, e-mail ou
 * retroenvio. Cada chamada toca no máximo a página atual e até 20 ciclos
 * abertos do próprio usuário para encerrar fontes revogadas. */
export async function consultarAvisosDiario(input: { cursor?: string } = {}): Promise<Resultado<ConsultaAvisosDiario>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const dados = ConsultaSchema.parse(input);
    const cursor = lerCursor(dados.cursor);
    return prisma.$transaction(async (tx) => {
      // Q24 cria/revoga designações sob a mesma trava; obtê-la antes de usuário,
      // configuração e encontros mantém a ordem de bloqueio do diário.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${sessao.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || (!usuario.papeis.includes(Papel.PROFESSOR) && !eGestao(usuario.papeis))) throw new ErroPermissao();
      const agora = new Date();
      const gestao = eGestao(usuario.papeis);
      await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
      const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: {
        prazoRegularizacaoDiarioMinutos: true, intervaloLembreteDiarioMinutos: true,
      } });
      const politicaCompleta = !!configuracao && configuracao.prazoRegularizacaoDiarioMinutos !== null && configuracao.intervaloLembreteDiarioMinutos !== null;

      await encerrarCiclosObsoletosTx(tx, { usuarioId: sessao.id, papeis: usuario.papeis, gestao, agora });
      const depoisDoCursor = cursor ? { OR: [{ fim: { lt: cursor.fim } }, { fim: cursor.fim, id: { lt: cursor.id } }] } : {};
      const escopoDocente = gestao ? {} : escopoResponsavel(sessao.id, usuario.papeis, agora);
      const encontros = await tx.encontroAgenda.findMany({ where: {
        finalidade: "AULA", status: "PREVISTO", fim: { lte: agora },
        AND: [escopoDocente, depoisDoCursor],
      }, orderBy: [{ fim: "desc" }, { id: "desc" }], take: LIMITE + 1, select: {
          id: true, professorId: true, inicio: true, fim: true, fusoOrigem: true,
          turma: { select: { codigo: true, nome: true } }, professor: { select: { nome: true } },
          diario: { select: { conteudo: true, registros: { select: { presente: true } } } },
          publicacaoGravacao: { select: { id: true } },
          excecoesGravacao: { where: { decisao: { aprovada: true } }, select: { id: true } },
          designacoesRegularizacaoAula: { where: { responsavelId: sessao.id, revogacao: { is: null } }, select: { id: true } },
      } });
      const pagina = encontros.slice(0, LIMITE);
      const itens: ItemAvisoDiario[] = [];
      for (const encontroPagina of pagina) {
        await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${encontroPagina.id} FOR UPDATE`;
        const encontro = await tx.encontroAgenda.findUnique({ where: { id: encontroPagina.id }, select: {
          id: true, turmaId: true, finalidade: true, status: true, professorId: true, inicio: true, fim: true, fusoOrigem: true,
          turma: { select: { codigo: true, nome: true } }, professor: { select: { nome: true } },
          diario: { select: { conteudo: true, registros: { select: { presente: true } } } },
          publicacaoGravacao: { select: { id: true } },
          excecoesGravacao: { where: { decisao: { aprovada: true } }, select: { id: true } },
          designacoesRegularizacaoAula: { where: { responsavelId: sessao.id, revogacao: { is: null } }, select: { id: true } },
        } });
        if (!encontro || encontro.finalidade !== "AULA" || encontro.status !== "PREVISTO" || encontro.fim > agora) continue;
        const responsavel = await temAtribuicaoVigenteTx(tx, { usuarioId: sessao.id, papeis: usuario.papeis, encontro, agora })
          || encontro.designacoesRegularizacaoAula.length > 0;
        if (!gestao && !responsavel) continue;
        const tipo = responsavel ? "DOCENTE" : "GESTAO";
        const aviso = politicaCompleta
          ? await atualizarCicloTx(tx, { encontroId: encontro.id, destinatarioId: sessao.id, tipo, fim: encontro.fim, agora,
            prazo: configuracao!.prazoRegularizacaoDiarioMinutos!, intervalo: configuracao!.intervaloLembreteDiarioMinutos! })
          : await tx.avisoPendenciaDiario.findUnique({ where: { encontroId_destinatarioId_tipo: { encontroId: encontro.id, destinatarioId: sessao.id, tipo } } });
        const vencimento = politicaCompleta ? somarMinutos(encontro.fim, configuracao!.prazoRegularizacaoDiarioMinutos!) : null;
        itens.push({
          id: aviso?.id ?? encontro.id, encontroId: encontro.id,
          turma: [encontro.turma?.codigo, encontro.turma?.nome].filter(Boolean).join(" · ") || "Aula particular",
          professor: encontro.professor?.nome ?? "Professor não atribuído",
          inicio: encontro.inicio.toISOString(), fim: encontro.fim.toISOString(), fusoOrigem: encontro.fusoOrigem,
          pendencias: [
            "A aula aguarda conferência e conclusão do diário.",
            ...(!encontro.diario ? ["Registre o diário da aula."] : []),
            ...(!encontro.diario?.conteudo.trim() ? ["Preencha o conteúdo da aula."] : []),
            ...(!encontro.diario?.registros.length || encontro.diario.registros.some((registro) => registro.presente === null)
              ? ["Complete as presenças da chamada."] : []),
            ...(!encontro.publicacaoGravacao && !encontro.excecoesGravacao.length
              ? ["Registre a gravação oficial ou solicite exceção."] : []),
          ],
          vencimento: vencimento?.toISOString() ?? null,
          atrasada: !!vencimento && vencimento <= agora,
          ultimoLembreteEm: aviso?.ultimoLembreteEm?.toISOString() ?? null,
          proximoLembreteEm: aviso?.proximoLembreteEm?.toISOString() ?? null,
          quantidadeLembretes: aviso?.quantidadeLembretes ?? 0,
          podeRegularizar: responsavel,
        });
      }
      const ultimo = pagina.at(-1);
      return {
        configurada: politicaCompleta,
        configuracao: { prazoRegularizacaoDiarioMinutos: configuracao?.prazoRegularizacaoDiarioMinutos ?? null,
          intervaloLembreteDiarioMinutos: configuracao?.intervaloLembreteDiarioMinutos ?? null },
        gestao, itens, proximoCursor: encontros.length > LIMITE && ultimo ? cursorDe({ fim: ultimo.fim, id: ultimo.id }) : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}

export async function salvarConfiguracaoAvisosDiario(input: { prazoRegularizacaoDiarioMinutos: number; intervaloLembreteDiarioMinutos: number }): Promise<Resultado<void>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = ConfiguracaoSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(739204)`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: {
        prazoRegularizacaoDiarioMinutos: true, intervaloLembreteDiarioMinutos: true,
      } });
      await tx.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", ...dados, alteradaPorId: autor.id },
        update: { ...dados, alteradaPorId: autor.id } });
      await registrarEvento(tx, { tipo: "AvisosPendenciasDiarioConfigurados", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { de: anterior, para: dados } });
    });
    revalidatePath("/diario");
    revalidatePath("/diario/pendencias");
    revalidatePath("/configuracao/operacao/avisos-diario");
  });
}

/** A configuração é consultada sem gerar aviso para o administrador. */
export async function consultarConfiguracaoAvisosDiario() {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${sessao.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: {
        prazoRegularizacaoDiarioMinutos: true, intervaloLembreteDiarioMinutos: true,
      } });
      return { prazoRegularizacaoDiarioMinutos: config?.prazoRegularizacaoDiarioMinutos ?? null,
        intervaloLembreteDiarioMinutos: config?.intervaloLembreteDiarioMinutos ?? null };
    });
  });
}
