"use server";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { consultarAlvoPrimeiraMensalidadeTx } from "./aditivo-primeira-mensalidade";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { instanteDaGrade } from "@/server/agenda/grade";

const id = z.string().trim().min(1).max(100);
const motivo = z.string().trim().min(5).max(2000);
const chaveIdempotencia = z.string().trim().min(1).max(200);
const Preparar = z.object({ matriculaId: id, versaoCondicoesId: id, revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), motivo, evidencia: z.string().trim().min(5).max(4000), chaveIdempotencia }).strict();
const Decidir = z.object({ propostaId: id, aprovada: z.boolean(), motivo, chaveIdempotencia }).strict();

async function autorFinanceiro(tx: Prisma.TransactionClient, autorId: string, aprovacao = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)
    || (aprovacao && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao();
}
async function bloquear(tx: Prisma.TransactionClient, matriculaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${matriculaId} FOR UPDATE`;
}
async function conferirVersao(tx: Prisma.TransactionClient, matriculaId: string, versaoId: string, revisaoHash?: string) {
  const v = await tx.versaoCondicoesAditivo.findFirst({ where: { id: versaoId, matriculaId }, include: { conferenciaFinal: true } });
  if (!v) throw new ErroRegra("Versão contratual indisponível nesta matrícula.");
  const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, { matriculaId, propostaId: v.propostaId, conclusaoId: v.conferenciaFinal.conclusaoId });
  if (estado.dados.ambiente !== "PRODUCAO" || estado.revisaoHash !== v.conferenciaFinal.revisaoHash
    || (revisaoHash !== undefined && revisaoHash !== estado.revisaoHash)) throw new ErroRegra("A assinatura e a conferência final precisam corresponder à revisão atual.");
  return v;
}

export async function proporVencimentoAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Preparar.parse(input);
    return prisma.$transaction(async tx => {
      await bloquear(tx, d.matriculaId); await autorFinanceiro(tx, autor.id);
      const anterior = await tx.propostaVencimentoAditivo.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { versaoCondicoes: { select: { conferenciaFinal: { select: { revisaoHash: true } } } } } });
      if (anterior) {
        if (anterior.matriculaId !== d.matriculaId || anterior.versaoCondicoesId !== d.versaoCondicoesId || anterior.motivo !== d.motivo || anterior.evidencia !== d.evidencia || anterior.versaoCondicoes.conferenciaFinal.revisaoHash !== d.revisaoHash) throw new ErroRegra("A chave já corresponde a outra proposta.");
        return { id: anterior.id };
      }
      const v = await conferirVersao(tx, d.matriculaId, d.versaoCondicoesId, d.revisaoHash);
      const valor = z.record(z.unknown()).parse(v.condicoes).PRIMEIRA_MENSALIDADE_VENCIMENTO;
      const alvo = await consultarAlvoPrimeiraMensalidadeTx(tx, d.matriculaId, valor);
      if (!alvo.cobranca) throw new ErroRegra(alvo.pendencia);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${alvo.cobranca.id} FOR UPDATE`;
      const c = await tx.cobranca.findUniqueOrThrow({ where: { id: alvo.cobranca.id } });
      const fuso = await carregarFusoInstitucionalTx(tx);
      if (!fuso) throw new ErroRegra("Configure o fuso institucional antes do acerto.");
      const vencimentoNovo = instanteDaGrade(alvo.vencimentoProposto, "12:00", fuso);
      const [foto] = await tx.$queryRaw<Array<{ fotografia: Prisma.JsonValue; hash: string }>>`
        SELECT f AS fotografia, encode(sha256(convert_to(f::text,'UTF8')),'hex') AS hash
        FROM (SELECT fotografia_vencimento_aditivo_225(${v.id},${c.id},${fuso},${vencimentoNovo}::timestamp) AS f) fonte`;
      if (!foto?.fotografia) throw new ErroRegra("Fotografia do acerto indisponível.");
      // Fotografia e hash usam o mesmo JSONB no INSERT, sem nova conversão numérica pelo ORM.
      const [p] = await tx.$queryRaw<Array<{ id: string; fotografiaHash: string }>>`
        WITH foto AS (SELECT ${JSON.stringify(foto.fotografia)}::jsonb AS dados)
        INSERT INTO "PropostaVencimentoAditivo" (id,"matriculaId","propostaAditivoId","versaoCondicoesId","cobrancaId","preparadorId","versaoCobranca","vencimentoAnterior","vencimentoNovo",fuso,fotografia,"fotografiaHash",motivo,evidencia,"chaveIdempotencia")
        SELECT ${randomUUID()},${d.matriculaId},${v.propostaId},${v.id},${c.id},${autor.id},${c.versao},${c.vencimento},${vencimentoNovo},${fuso},foto.dados,encode(sha256(convert_to(foto.dados::text,'UTF8')),'hex'),${d.motivo},${d.evidencia},${d.chaveIdempotencia}
        FROM foto RETURNING id,"fotografiaHash"`;
      await registrarEvento(tx, { tipo: "VencimentoAditivoProposto", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { propostaId: p.id, cobrancaId: c.id, fotografiaHash: p.fotografiaHash } });
      return { id: p.id };
    }, { timeout: 30000 });
  });
}

export async function decidirVencimentoAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaVencimentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, select: { matriculaId: true } });
      await bloquear(tx, referencia.matriculaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaVencimentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outra pessoa.");
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo || p.decisao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("A proposta já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (d.aprovada) await conferirVersao(tx, p.matriculaId, p.versaoCondicoesId);
      const decisao = await tx.decisaoVencimentoAditivo.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: p.fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "VencimentoAditivoDecidido", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 30000 });
  });
}
