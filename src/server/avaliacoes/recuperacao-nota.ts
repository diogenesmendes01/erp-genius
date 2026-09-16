"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { docenteAtual } from "@/server/diario/permissoes";
import { designadoRecuperacao } from "./recuperacao-designacao-acesso";

const id = z.string().min(1).max(100);
const salvarSchema = z.object({ realizacaoId: id, nota: z.string().max(100).regex(/^-?\d+(\.\d+)?$/).nullable(), comentarioAluno: z.string().trim().max(2000), submetida: z.boolean(), versaoEsperada: z.number().int().min(0).max(2147483646), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decidirSchema = z.object({ notaId: id, entradaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();

async function carregar(tx: Prisma.TransactionClient, realizacaoId: string) {
  const ref = await tx.realizacaoRecuperacao.findUnique({ where: { id: realizacaoId }, select: { itemReserva: { select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } } } });
  if (!ref) throw new ErroRegra("Realização não encontrada.");
  const a = await bloquearLancamento(tx, ref.itemReserva.reserva.proposta.alocacaoId);
  const r = await tx.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: realizacaoId }, include: { itemReserva: { include: { reserva: { include: { proposta: { include: { regra: true } } } } } } } });
  return { a, r };
}

export async function salvarNotaRecuperacao(input: z.input<typeof salvarSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = salvarSchema.parse(input);
    return prisma.$transaction(async tx => {
      const { a, r } = await carregar(tx, d.realizacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const designado = await designadoRecuperacao(tx, r.itemReservaId, u.id);
      if (!fresco?.ativo || !fresco.papeis.includes(Papel.PROFESSOR) || (!(r.professorId === u.id && docenteAtual(u.id, t)) && !designado)) throw new ErroPermissao("Professor sem atribuição para registrar esta nota.");
      const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
      const anterior = await tx.notaRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outro lançamento.");
        return { id: anterior.id, versao: anterior.versao };
      }
      const ultima = await tx.notaRecuperacao.findFirst({ where: { realizacaoId: r.id }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Atualize a versão antes de lançar.");
      if (await tx.notaRecuperacao.count({ where: { realizacaoId: r.id, decisao: { aprovada: true } } })) throw new ErroRegra("Nota oficial exige correção aprovada em fluxo próprio.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(r.itemReserva.reserva.proposta.regra.conteudo);
      if (d.submetida && d.nota === null) throw new ErroRegra("Informe a nota antes de submeter.");
      if (d.nota !== null && (new Prisma.Decimal(d.nota).lt(regra.escala.minimo) || new Prisma.Decimal(d.nota).gt(regra.escala.maximo))) throw new ErroRegra("Nota fora da escala configurada.");
      // A realização é preservada mesmo se outras habilidades da reserva foram canceladas.
      const n = await tx.notaRecuperacao.create({ data: { realizacaoId: r.id, autorId: u.id, versao: d.versaoEsperada + 1, nota: d.nota, comentarioAluno: d.comentarioAluno, submetida: d.submetida, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: d.submetida ? "NotaRecuperacaoSubmetida" : "NotaRecuperacaoRascunhada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { realizacaoId: r.id, notaId: n.id, versao: n.versao } });
      return { id: n.id, versao: n.versao };
    });
  });
}

export async function decidirNotaRecuperacao(input: z.input<typeof decidirSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decidirSchema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.notaRecuperacao.findUnique({ where: { id: d.notaId }, select: { realizacaoId: true } });
      if (!ref) throw new ErroRegra("Nota não encontrada.");
      const { a, r } = await carregar(tx, ref.realizacaoId);
      await conferirGestorAvaliacao(tx, u.id);
      const n = await tx.notaRecuperacao.findUniqueOrThrow({ where: { id: d.notaId }, include: { decisao: true } });
      if (n.autorId === u.id || r.professorId === u.id) throw new ErroRegra("Outra pessoa deve conferir a nota.");
      if (n.entradaHash !== d.entradaHash) throw new ErroRegra("Confira o conteúdo exato da nota.");
      if (n.decisao) {
        if (n.decisao.decisorId === u.id && n.decisao.aprovada === d.aprovada && n.decisao.motivo === d.motivo) return { id: n.decisao.id };
        throw new ErroRegra("Nota já possui decisão.");
      }
      if (!n.submetida || n.nota === null) throw new ErroRegra("Nota ainda não submetida.");
      if (d.aprovada && await tx.notaRecuperacao.count({ where: { realizacaoId: r.id, versao: { gt: n.versao } } })) throw new ErroRegra("Existe versão mais recente da nota.");
      const decisao = await tx.decisaoNotaRecuperacao.create({ data: { notaId: n.id, decisorId: u.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "NotaRecuperacaoOficializada" : "NotaRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { realizacaoId: r.id, notaId: n.id, decisaoId: decisao.id } });
      return { id: decisao.id };
    });
  });
}
