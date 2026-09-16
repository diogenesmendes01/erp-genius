"use server";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarAgendaParticularContratual } from "@/server/contratos/agenda-particular";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
const Entrada = z.object({ reservaId: z.string().min(1), versaoAnterior: z.number().int().nonnegative(), tipo: z.enum(["PRORROGAR", "LIBERAR"]),
  novoPrazo: z.string().datetime({ offset: true }).optional(), motivo: z.string().trim().min(5).max(2000), tratamentoContratacao: z.string().trim().min(10).max(4000), chaveIdempotencia: z.string().min(8).max(100) }).strict()
  .refine((d) => (d.tipo === "PRORROGAR") === !!d.novoPrazo, "Informe novo prazo somente para prorrogação.");
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function bloquear(tx: Prisma.TransactionClient, reservaId: string, autorId: string, decisao: boolean) {
  const r = await tx.reservaAgendaParticular.findUnique({ where: { id: reservaId }, select: { matriculaId: true } });
  if (!r) throw new ErroRegra("Reserva não encontrada.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [r.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ReservaAgendaParticular" WHERE id = ${reservaId} FOR UPDATE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || (!decisao && p === "SECRETARIA_ACADEMICA"))) throw new ErroPermissao();
}
async function contexto(tx: Prisma.TransactionClient, reservaId: string, tipo: string) {
  const reserva = await tx.reservaAgendaParticular.findUniqueOrThrow({ where: { id: reservaId }, include: { horarios: { orderBy: { id: "asc" } } } });
  if (reserva.status !== "MANTIDA_PENDENCIA") throw new ErroRegra("A resolução exige reserva mantida por pendência.");
  const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: reserva.matriculaId }, select: { status: true, contratoOk: true, contratoDocumentoId: true, confirmacaoContratoEm: true,
    cobrancas: { orderBy: { id: "asc" }, select: { id: true, versao: true, status: true, valorRecebido: true,
      informes: { orderBy: { id: "asc" }, select: { id: true, status: true, versao: true } }, recebimentos: { orderBy: { id: "asc" }, select: { id: true } } } } } });
  const processos = await tx.processoAssinaturaContratual.findMany({ where: { matriculaId: reserva.matriculaId }, orderBy: { id: "asc" }, select: { id: true, estado: true, referenciaExterna: true } });
  const documentos = await tx.documento.findMany({ where: { matriculaId: reserva.matriculaId, categoria: "CONTRATO" }, orderBy: { id: "asc" }, select: { id: true, arquivado: true, url: true } });
  const agenda = tipo === "PRORROGAR" ? (await carregarAgendaParticularContratual(tx, reserva.matriculaId, reservaId)).snapshot : null;
  return { reserva, matricula, processos, documentos, agenda };
}
function conferirPrazo(novoPrazo: Date | null, tipo: string, c: Awaited<ReturnType<typeof contexto>>) {
  if (tipo !== "PRORROGAR") return;
  if (!novoPrazo || novoPrazo <= new Date() || novoPrazo <= c.reserva.expiraEm) throw new ErroRegra("O novo prazo deve ser futuro e posterior ao prazo anterior.");
  if (!["RASCUNHO", "AGUARDANDO"].includes(c.matricula.status)) throw new ErroRegra("Confira a situação da contratação antes de prorrogar.");
}
export async function prepararResolucaoParticular(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Entrada.parse(input), entradaHash = hash(d);
    return prisma.$transaction(async (tx) => {
      await bloquear(tx, d.reservaId, autor.id, false);
      const repetida = await tx.propostaResolucaoParticular.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra resolução."); return { id: repetida.id, versao: repetida.versao }; }
      const ultima = await tx.propostaResolucaoParticular.findFirst({ where: { reservaId: d.reservaId }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Existe outra versão; confira a resolução atual.");
      const c = await contexto(tx, d.reservaId, d.tipo), novoPrazo = d.novoPrazo ? new Date(d.novoPrazo) : null;
      conferirPrazo(novoPrazo, d.tipo, c);
      const r = await tx.propostaResolucaoParticular.create({ data: { reservaId: d.reservaId, preparadorId: autor.id, versao: d.versaoAnterior + 1, tipo: d.tipo, novoPrazo,
        motivo: d.motivo, tratamentoContratacao: d.tratamentoContratacao, estadoHash: hash(c), snapshot: JSON.parse(JSON.stringify(c)) as Prisma.InputJsonValue, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "ResolucaoParticularPreparada", agregadoTipo: "Matricula", agregadoId: c.reserva.matriculaId, autorId: autor.id, payload: { propostaId: r.id, reservaId: d.reservaId, tipo: d.tipo } });
      return { id: r.id, versao: r.versao };
    }, { timeout: 20000 });
  });
}
export async function decidirResolucaoParticular(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const p = await tx.propostaResolucaoParticular.findUnique({ where: { id: d.propostaId } });
      if (!p) throw new ErroRegra("Proposta não encontrada.");
      await bloquear(tx, p.reservaId, autor.id, true);
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa da Administração deve decidir.");
      const repetida = await tx.decisaoResolucaoParticular.findUnique({ where: { propostaId: p.id } });
      if (repetida) { if (repetida.decisorId === autor.id && repetida.aprovada === d.aprovar && repetida.motivo === d.motivo) return { id: repetida.id, aprovada: repetida.aprovada }; throw new ErroRegra("Proposta já decidida."); }
      const reserva = await tx.reservaAgendaParticular.findUniqueOrThrow({ where: { id: p.reservaId } });
      if (d.aprovar) {
        if (await tx.propostaResolucaoParticular.count({ where: { reservaId: p.reservaId, versao: { gt: p.versao } } })) throw new ErroRegra("Confira a proposta mais recente.");
        const c = await contexto(tx, p.reservaId, p.tipo);
        if (hash(c) !== p.estadoHash) throw new ErroRegra("A contratação ou reserva mudou; prepare nova resolução.");
        conferirPrazo(p.novoPrazo, p.tipo, c);
        await tx.reservaAgendaParticular.update({ where: { id: p.reservaId }, data: p.tipo === "PRORROGAR" ? { expiraEm: p.novoPrazo!, status: "ATIVA" } : { status: "LIBERADA" } });
      }
      const r = await tx.decisaoResolucaoParticular.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "ResolucaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: reserva.matriculaId, autorId: autor.id,
        payload: { propostaId: p.id, reservaId: p.reservaId, aprovada: d.aprovar, tipo: p.tipo, novoPrazo: p.novoPrazo?.toISOString() ?? null } });
      return { id: r.id, aprovada: r.aprovada };
    }, { timeout: 20000 });
  });
}

export async function consultarResolucoesParticulares(input: { reservaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ reservaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || p === "SECRETARIA_ACADEMICA")) throw new ErroPermissao();
      const reserva = await tx.reservaAgendaParticular.findUnique({ where: { id: d.reservaId }, select: { id: true, status: true, expiraEm: true, matriculaId: true,
        horarios: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, fusoOrigem: true, professor: { select: { nome: true } } } } } });
      if (!reserva) throw new ErroRegra("Reserva particular não encontrada.");
      const ultima = await tx.propostaResolucaoParticular.findFirst({ where: { reservaId: d.reservaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const atual = reserva.status === "MANTIDA_PENDENCIA" ? await contexto(tx, reserva.id, "LIBERAR") : null;
      let prorrogacao: Awaited<ReturnType<typeof contexto>> | null = null, pendenciaProrrogacao: string | null = null;
      if (atual) {
        try { prorrogacao = await contexto(tx, reserva.id, "PRORROGAR"); }
        catch (e) { if (!(e instanceof ErroRegra)) throw e; pendenciaProrrogacao = e.message; }
      }
      const registros = await tx.propostaResolucaoParticular.findMany({ where: { reservaId: d.reservaId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, versao: true, tipo: true, novoPrazo: true, motivo: true, tratamentoContratacao: true, criadaEm: true, preparadorId: true, estadoHash: true,
          preparador: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } });
      return { reserva, versaoAtual: ultima?.versao ?? 0, podePreparar: !!atual, pendenciaProrrogacao, pagina: d.pagina, possuiMais: registros.length > 30,
        registros: registros.slice(0, 30).map(({ preparadorId, estadoHash, ...p }) => {
          const c = p.tipo === "PRORROGAR" ? prorrogacao : atual;
          let prazoValido = !!c;
          if (c) { try { conferirPrazo(p.novoPrazo, p.tipo, c); } catch { prazoValido = false; } }
          return { ...p, podeDecidir: !p.decisao && preparadorId !== autor.id && u.papeis.includes("ADMINISTRADOR"),
            podeAprovar: !!c && p.versao === ultima?.versao && hash(c) === estadoHash && prazoValido };
        }) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

