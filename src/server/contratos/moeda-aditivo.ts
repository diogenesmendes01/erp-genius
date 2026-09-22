"use server";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { consultarAlvoMoedaTx } from "./aditivo-moeda";

// Q173 — mesmo protocolo do vencimento (225/228) e do adiantamento (Q172): Financeiro prepara, outro
// aprovador financeiro decide e aplica após a vigência; o trigger do banco atualiza Matricula.moeda.
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
  return u;
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

export async function proporMoedaAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Preparar.parse(input);
    return prisma.$transaction(async tx => {
      await bloquear(tx, d.matriculaId); await autorFinanceiro(tx, autor.id);
      const anterior = await tx.propostaMoedaAditivo.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { versaoCondicoes: { select: { conferenciaFinal: { select: { revisaoHash: true } } } } } });
      if (anterior) {
        if (anterior.matriculaId !== d.matriculaId || anterior.versaoCondicoesId !== d.versaoCondicoesId || anterior.motivo !== d.motivo || anterior.evidencia !== d.evidencia || anterior.versaoCondicoes.conferenciaFinal.revisaoHash !== d.revisaoHash) throw new ErroRegra("A chave já corresponde a outra proposta.");
        return { id: anterior.id };
      }
      const v = await conferirVersao(tx, d.matriculaId, d.versaoCondicoesId, d.revisaoHash);
      const alvo = await consultarAlvoMoedaTx(tx, d.matriculaId, v);
      if (!alvo.podePreparar || !alvo.moedaNova) throw new ErroRegra([alvo.pendencia, ...alvo.pendencias.map(p => p.texto)].join(" "));
      // Fotografia e hash saem do mesmo JSONB no INSERT, sem reserialização pelo ORM.
      const [p] = await tx.$queryRaw<Array<{ id: string; fotografiaHash: string }>>`
        WITH foto AS (SELECT fotografia_moeda_aditivo_173(${v.id},${alvo.moedaNova}) AS dados)
        INSERT INTO "PropostaMoedaAditivo" (id,"matriculaId","propostaAditivoId","versaoCondicoesId","preparadorId","moedaAnterior","moedaNova",fotografia,"fotografiaHash",motivo,evidencia,"chaveIdempotencia")
        SELECT ${randomUUID()},${d.matriculaId},${v.propostaId},${v.id},${autor.id},${alvo.moedaAtual},${alvo.moedaNova},foto.dados,encode(sha256(convert_to(foto.dados::text,'UTF8')),'hex'),${d.motivo},${d.evidencia},${d.chaveIdempotencia}
        FROM foto RETURNING id,"fotografiaHash"`;
      await registrarEvento(tx, { tipo: "MoedaAditivoProposta", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { propostaId: p.id, de: alvo.moedaAtual, para: alvo.moedaNova, fotografiaHash: p.fotografiaHash } });
      return { id: p.id };
    }, { timeout: 30000 });
  });
}

export async function decidirMoedaAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaMoedaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, select: { matriculaId: true } });
      await bloquear(tx, referencia.matriculaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaMoedaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outra pessoa.");
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo || p.decisao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("A proposta já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (d.aprovada) {
        const v = await conferirVersao(tx, p.matriculaId, p.versaoCondicoesId);
        const alvo = await consultarAlvoMoedaTx(tx, p.matriculaId, v);
        if (!alvo.podePreparar) throw new ErroRegra([alvo.pendencia, ...alvo.pendencias.map(x => x.texto)].join(" "));
      }
      const decisao = await tx.decisaoMoedaAditivo.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: p.fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "MoedaAditivoDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 30000 });
  });
}

export async function aplicarMoedaAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaId: id, chaveIdempotencia }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaMoedaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, select: { matriculaId: true } });
      await bloquear(tx, referencia.matriculaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaMoedaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: { include: { aplicacao: true } } } });
      if (!p.decisao?.aprovada || p.decisao.decisorId !== autor.id || p.preparadorId === autor.id) throw new ErroRegra("Aplicação exige o aprovador independente da proposta.");
      if (p.decisao.aplicacao) {
        if (p.decisao.aplicacao.executorId !== autor.id || p.decisao.aplicacao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("Aplicação já registrada com outra chave.");
        return { id: p.decisao.aplicacao.id, aplicada: true };
      }
      const versao = await conferirVersao(tx, p.matriculaId, p.versaoCondicoesId);
      if (versao.vigenciaInicio > new Date()) throw new ErroRegra("Aguarde a vigência aprovada antes de aplicar a moeda.");
      const alvo = await consultarAlvoMoedaTx(tx, p.matriculaId, versao);
      if (!alvo.podePreparar) throw new ErroRegra([alvo.pendencia, ...alvo.pendencias.map(x => x.texto)].join(" "));
      // A trigger reconfere a fotografia e atualiza a moeda da matrícula na mesma transação.
      const aplicacao = await tx.aplicacaoMoedaAditivo.create({ data: { decisaoId: p.decisao.id, executorId: autor.id, chaveIdempotencia: d.chaveIdempotencia, fotografiaHash: p.fotografiaHash, moedaAnterior: p.moedaAnterior, moedaNova: p.moedaNova } });
      await registrarEvento(tx, { tipo: "MoedaAditivoAplicada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, aplicacaoId: aplicacao.id, de: p.moedaAnterior, para: p.moedaNova, fotografiaHash: p.fotografiaHash } });
      return { id: aplicacao.id, aplicada: true };
    }, { timeout: 30000 });
  });
}

/** Histórico financeiro restrito à matrícula e à versão solicitadas. */
export async function consultarMoedasAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ matriculaId: id, versaoCondicoesId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await autorFinanceiro(tx, autor.id);
      const versao = await tx.versaoCondicoesAditivo.findFirst({ where: { id: d.versaoCondicoesId, matriculaId: d.matriculaId },
        select: { id: true, versao: true, vigenciaInicio: true, condicoes: true, conferenciaFinal: { select: { revisaoHash: true } } } });
      if (!versao) throw new ErroRegra("Versão contratual indisponível nesta matrícula.");
      const aprova = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      const linhas = await tx.propostaMoedaAditivo.findMany({ where: { matriculaId: d.matriculaId, versaoCondicoesId: versao.id }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 50, include: { decisao: { include: { aplicacao: true } } } });
      const aplicada = linhas.some(p => p.decisao?.aplicacao);
      const alvo = aplicada ? null : await consultarAlvoMoedaTx(tx, d.matriculaId, versao);
      const emAndamento = linhas.some(p => !p.decisao || (p.decisao.aprovada && !p.decisao.aplicacao));
      return {
        matriculaId: d.matriculaId, versaoCondicoesId: versao.id, versao: versao.versao, vigenciaInicio: versao.vigenciaInicio.toISOString(), revisaoHash: versao.conferenciaFinal.revisaoHash,
        aplicada, alvo: alvo ? { ...alvo, podePreparar: alvo.podePreparar && !emAndamento } : null,
        propostas: linhas.map(p => ({
          id: p.id, moedaAnterior: p.moedaAnterior, moedaNova: p.moedaNova, motivo: p.motivo, evidencia: p.evidencia, criadaEm: p.criadaEm.toISOString(),
          estado: p.decisao?.aplicacao ? "APLICADA" : p.decisao ? (p.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
          podeDecidir: !p.decisao && aprova && p.preparadorId !== autor.id,
          podeSolicitarAplicacao: versao.vigenciaInicio <= new Date() && !!p.decisao?.aprovada && !p.decisao.aplicacao && aprova && p.decisao.decisorId === autor.id,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null,
          aplicadaEm: p.decisao?.aplicacao?.aplicadaEm.toISOString() ?? null,
        })),
      };
    });
  });
}
