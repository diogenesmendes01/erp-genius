"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { carregarContinuidadeReserva, exigirCasoExcecao } from "./excecao-admissao-estado";

async function conferirAutor(tx: Prisma.TransactionClient, id: string, decidir = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || p === "GERENTE_PEDAGOGICO" || (!decidir && p === "SECRETARIA_ACADEMICA"))) throw new ErroPermissao();
}
async function bloquearReserva(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const r = await tx.reservaVagaMatricula.findUnique({ where: { id }, select: { matriculaId: true } });
  if (!r) throw new ErroRegra("Reserva não encontrada.");
  await bloquearMatriculas(tx, [r.matriculaId]); return r;
}
const Preparar = z.object({ reservaId: z.string().min(1), estadoHash: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000),
  parecerViabilidade: z.string().trim().min(10).max(6000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function prepararExcecaoAdmissao(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO), d = Preparar.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`excecao-admissao:${autor.id}`}, 0))`;
      const r = await bloquearReserva(tx, d.reservaId); await conferirAutor(tx, autor.id);
      const repetida = await tx.propostaExcecaoAdmissao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) { if (repetida.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave usada para outra proposta."); return { id: repetida.id }; }
      const base = await carregarContinuidadeReserva(tx, d.reservaId); exigirCasoExcecao(base);
      if (base.estadoHash !== d.estadoHash) throw new ErroRegra("A reserva ou a agenda mudou. Atualize a revisão.");
      const p = await tx.propostaExcecaoAdmissao.create({ data: { reservaId: d.reservaId, preparadorId: autor.id, motivo: d.motivo, parecerViabilidade: d.parecerViabilidade,
        snapshot: base.snapshot, estadoHash: base.estadoHash, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: "ExcecaoAdmissaoProposta", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id, payload: { propostaId: p.id, reservaId: d.reservaId } });
      return { id: p.id };
    }, { timeout: 20000 });
  });
}

export async function decidirExcecaoAdmissao(input: { propostaId: string; estadoHash: string; aprovada: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), estadoHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const p = await tx.propostaExcecaoAdmissao.findUnique({ where: { id: d.propostaId } });
      if (!p) throw new ErroRegra("Proposta não encontrada.");
      const r = await bloquearReserva(tx, p.reservaId); await conferirAutor(tx, autor.id, true);
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a exceção, mesmo acumulando papéis.");
      if (p.estadoHash !== d.estadoHash) throw new ErroRegra("A revisão não corresponde à proposta.");
      const anterior = await tx.decisaoExcecaoAdmissao.findUnique({ where: { propostaId: p.id } });
      if (anterior) {
        if (anterior.decisorId === autor.id && anterior.aprovada === d.aprovada && anterior.motivo === d.motivo) return { id: anterior.id, aprovada: anterior.aprovada };
        throw new ErroRegra("A proposta já recebeu decisão.");
      }
      if (d.aprovada) {
        const base = await carregarContinuidadeReserva(tx, p.reservaId); exigirCasoExcecao(base);
        if (base.estadoHash !== p.estadoHash) throw new ErroRegra("O cenário mudou. Prepare outra proposta com a viabilidade atual.");
      }
      const decisao = await tx.decisaoExcecaoAdmissao.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "ExcecaoAdmissaoDecidida", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 20000 });
  });
}

export async function consultarExcecoesAdmissao(input: { reservaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ reservaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const r = await bloquearReserva(tx, d.reservaId); await conferirAutor(tx, autor.id);
      const historico = await tx.propostaExcecaoAdmissao.findMany({ where: { reservaId: d.reservaId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, preparadorId: true, motivo: true, parecerViabilidade: true, snapshot: true, estadoHash: true, criadaEm: true, preparador: { select: { nome: true } },
          decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } });
      let revisao: { estadoHash: string; snapshot: Prisma.InputJsonObject } | null = null, pendencia: string | null = null;
      try { const base = await carregarContinuidadeReserva(tx, d.reservaId); exigirCasoExcecao(base); revisao = { estadoHash: base.estadoHash, snapshot: base.snapshot }; }
      catch (e) { if (!(e instanceof ErroRegra)) throw e; pendencia = e.message; }
      return { matriculaId: r.matriculaId, autorId: autor.id, podeDecidir: autor.papeis.includes("ADMINISTRADOR") || autor.papeis.includes("GERENTE_PEDAGOGICO"), revisao, pendencia, historico: historico.slice(0, 20), pagina: d.pagina, temProxima: historico.length > 20 };
    }, { timeout: 20000 });
  });
}
