"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { EstadoSegundaChamadaSchema, estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";

const id = z.string().min(1).max(100), texto = z.string().trim().min(5).max(4000), sha = z.string().regex(/^[a-f0-9]{64}$/);
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const propostaSchema = z.object({ alocacaoId: id, codigoAvaliacao: id, motivo: texto, evidencias: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decisaoSchema = z.object({ propostaId: id, propostaHash: sha, aprovada: z.boolean(), motivo: texto }).strict();

function conferirEstado(estado: z.infer<typeof EstadoSegundaChamadaSchema>) {
  if (!estado.ativa || estado.statusMatricula !== "ATIVA") throw new ErroRegra("Nova segunda chamada exige matrícula e vínculo ativos. Pausa ou encerramento exigem autorização específica.");
  if (!estado.pendente) throw new ErroRegra("A avaliação já possui nota oficial ou não pertence à regra vigente.");

}

/** Q146/Q147: propõe uma nova aplicação da avaliação pendente, sem criar nota ou recuperação. */
export async function proporSegundaChamada(input: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), d = propostaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await carregarConsolidadoAvaliacoesTx(tx, usuario.id, d.alocacaoId, "ACOMPANHAMENTO");
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id, "entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE "autorId" = ${usuario.id} AND "chaveIdempotencia" = ${d.chaveIdempotencia} FOR SHARE`);
      if (repetida) { if (repetida.entradaHash !== hash(d)) throw new ErroRegra("Chave utilizada com outra proposta de segunda chamada."); return { id: repetida.id }; }
      const estado = await estadoSegundaChamadaTx(tx, d.alocacaoId, d.codigoAvaliacao); conferirEstado(estado);
      const propostaId = randomUUID(), entradaHash = hash(d), estadoHash = hash(estado);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "PropostaSegundaChamada" (id,"matriculaId","alocacaoId","turmaId","nivelId","regraId","codigoAvaliacao","autorId",motivo,evidencias,"chaveIdempotencia","entradaHash",snapshot,"estadoHash") VALUES (${propostaId},${estado.matriculaId},${estado.alocacaoId},${estado.turmaId},${estado.nivelId},${estado.regraId},${estado.codigoAvaliacao},${usuario.id},${d.motivo},${d.evidencias},${d.chaveIdempotencia},${entradaHash},${JSON.stringify(estado)}::jsonb,${estadoHash})`);
      await registrarEvento(tx, { tipo: "SegundaChamadaProposta", agregadoTipo: "Matricula", agregadoId: estado.matriculaId, autorId: usuario.id, payload: { propostaId, codigoAvaliacao: estado.codigoAvaliacao } });
      return { id: propostaId };
    });
  });
}

/** Q146/Q147: decisão independente não consome nem reserva; saldo é conferido ao agendar. */
export async function decidirSegundaChamada(input: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decisaoSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const [ref] = await tx.$queryRaw<{ alocacaoId: string }[]>(Prisma.sql`SELECT "alocacaoId" AS "alocacaoId" FROM "PropostaSegundaChamada" WHERE id=${d.propostaId}`);
      if (!ref) throw new ErroRegra("Proposta de segunda chamada não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId);
      const [p] = await tx.$queryRaw<{ id: string; alocacaoId: string; matriculaId: string; codigoAvaliacao: string; autorId: string; entradaHash: string; estadoHash: string }[]>(Prisma.sql`SELECT id,"alocacaoId" AS "alocacaoId","matriculaId" AS "matriculaId","codigoAvaliacao" AS "codigoAvaliacao","autorId" AS "autorId","entradaHash" AS "entradaHash","estadoHash" AS "estadoHash" FROM "PropostaSegundaChamada" WHERE id=${d.propostaId} FOR UPDATE`);
      if (!p || p.alocacaoId !== ref.alocacaoId) throw new ErroRegra("A proposta de segunda chamada mudou. Atualize a operação.");
      await conferirGestorAvaliacao(tx, usuario.id);
      if (p.autorId === usuario.id) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa decidir.");
      if (p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira a proposta exata antes de decidir.");
      const [existente] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoSegundaChamada" WHERE "propostaId"=${p.id} FOR SHARE`);
      if (existente) { if (existente.decisorId === usuario.id && existente.aprovada === d.aprovada && existente.motivo === d.motivo) return { id: existente.id }; throw new ErroRegra("A proposta já possui decisão."); }
      if (d.aprovada) { const estado = await estadoSegundaChamadaTx(tx, p.alocacaoId, p.codigoAvaliacao); if (hash(estado) !== p.estadoHash) throw new ErroRegra("A pendência, o vínculo ou o saldo mudou. Prepare nova proposta."); conferirEstado(estado); }
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${decisaoId},${p.id},${usuario.id},${d.aprovada},${d.motivo})`);
      await registrarEvento(tx, { tipo: d.aprovada ? "SegundaChamadaAutorizada" : "SegundaChamadaRejeitada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: usuario.id, payload: { propostaId: p.id, decisaoId, codigoAvaliacao: p.codigoAvaliacao } });
      return { id: decisaoId };
    });
  });
}

/** Histórico paginado da avaliação pendente, sem agenda, prazo ou dados financeiros. */
export async function consultarSegundasChamadas(input: { alocacaoId: string; codigoAvaliacao: string; antesId?: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: id, codigoAvaliacao: id, antesId: id.optional() }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await carregarConsolidadoAvaliacoesTx(tx, usuario.id, d.alocacaoId, "ACOMPANHAMENTO");
      const estado = await estadoSegundaChamadaTx(tx, d.alocacaoId, d.codigoAvaliacao);
      const [u] = await tx.$queryRaw<{ papeis: string[] }[]>(Prisma.sql`SELECT papeis FROM "Usuario" WHERE id=${usuario.id} FOR SHARE`);
      const gestao = !!u?.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
      const itens = await tx.$queryRaw<{ id: string; autorId: string; motivo: string; evidencias: string; entradaHash: string; criadaEm: Date; aprovada: boolean | null; motivoDecisao: string | null; disponibilizacaoId: string | null; prazoAte: Date | null; reservaId: string | null; reservaStatus: string | null; encontroId: string | null }[]>(Prisma.sql`
        SELECT p.id,p."autorId" AS "autorId",p.motivo,p.evidencias,p."entradaHash" AS "entradaHash",p."criadaEm" AS "criadaEm",d.aprovada,d.motivo AS "motivoDecisao",s.id AS "disponibilizacaoId",s."prazoAte" AS "prazoAte",r.id AS "reservaId",r.status AS "reservaStatus",a."encontroId" AS "encontroId"
        FROM "PropostaSegundaChamada" p LEFT JOIN "DecisaoSegundaChamada" d ON d."propostaId"=p.id LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id LEFT JOIN LATERAL (SELECT rr.* FROM "ReservaSegundaChamada" rr WHERE rr."propostaId"=p.id ORDER BY rr."reservadaEm" DESC,rr.id DESC LIMIT 1) r ON true LEFT JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id
        WHERE p."alocacaoId"=${d.alocacaoId} AND p."codigoAvaliacao"=${d.codigoAvaliacao} AND (${d.antesId ?? null}::text IS NULL OR p.id<${d.antesId ?? ""}) ORDER BY p.id DESC LIMIT 21
      `);
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      const a = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: d.alocacaoId }, select: { matriculaId: true, turmaId: true } });
      return { fusoExibicao: config?.fusoInstitucional ?? "UTC", identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId!, a.turmaId), estado, proximoId: itens.length > 20 ? itens[19].id : null,
        itens: itens.slice(0, 20).map((p) => ({ id: p.id, motivo: p.motivo, evidencias: p.evidencias, criadaEm: p.criadaEm.toISOString(), decisao: p.aprovada === null ? null : { aprovada: p.aprovada, motivo: p.motivoDecisao ?? "" }, disponibilizacao: p.disponibilizacaoId ? { id: p.disponibilizacaoId, prazoAte: p.prazoAte!.toISOString() } : null, reserva: p.reservaId ? { id: p.reservaId, status: p.reservaStatus!, encontroId: p.encontroId } : null, podeDecidir: gestao && p.autorId !== usuario.id && p.aprovada === null, podeOperar: gestao, propostaHash: gestao ? p.entradaHash : null })) };
    });
  });
}

/** Histórico administrativo das autorizações pontuais; não libera operações regulares. */
export async function consultarAutorizacoesEspeciaisSegundaChamada(input: { alocacaoId: string; codigoAvaliacao: string; depoisId?: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: id, codigoAvaliacao: id, depoisId: id.optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await carregarConsolidadoAvaliacoesTx(tx, usuario.id, d.alocacaoId, "ACOMPANHAMENTO");
      await conferirGestorAvaliacao(tx, usuario.id);
      const estado = await estadoSegundaChamadaTx(tx, d.alocacaoId, d.codigoAvaliacao);
      const cursor = d.depoisId ? await tx.autorizacaoEspecialSegundaChamada.findFirst({ where: { id: d.depoisId, alocacaoId: estado.alocacaoId, codigoAvaliacao: estado.codigoAvaliacao }, select: { id: true, criadaEm: true } }) : null;
      if (d.depoisId && !cursor) throw new ErroRegra("Cursor de autorizações não encontrado para esta segunda chamada.");
      const registros = await tx.autorizacaoEspecialSegundaChamada.findMany({ where: { alocacaoId: estado.alocacaoId, codigoAvaliacao: estado.codigoAvaliacao, ...(cursor ? { OR: [{ criadaEm: { lt: cursor.criadaEm } }, { criadaEm: cursor.criadaEm, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 21,
        select: { id: true, motivo: true, criadaEm: true, prazoAte: true, autorizador: { select: { nome: true } } } });
      return { alocacaoId: estado.alocacaoId, codigoAvaliacao: estado.codigoAvaliacao, statusMatricula: estado.statusMatricula,
        identificacao: await identificarMatriculaAvaliacao(tx, estado.matriculaId, estado.turmaId),
        podeAutorizar: ["PAUSADA", "ENCERRADA"].includes(estado.statusMatricula) && estado.pendente && !!estado.regraId,
        proximoId: registros.length > 20 ? registros[19].id : null,
        historico: registros.slice(0, 20).map(registro => ({ ...registro, criadaEm: registro.criadaEm.toISOString(), prazoAte: registro.prazoAte.toISOString() })) };
    });
  });
}




