"use server";

import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";

const id = z.string().min(1);
const texto = z.string().trim().min(5).max(3000);
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");

type FotoSql = { fotografia: Prisma.JsonValue; fotografiaHash: string };
const temAlcadaFinanceira = (ator: { ativo?: boolean; papeis: Papel[] }) => ator.ativo !== false && ator.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR);

async function exigirFinanceiroTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

async function fotoAtualTx(tx: Prisma.TransactionClient, propostaId: string) {
  const linhas = await tx.$queryRaw<FotoSql[]>`SELECT fotografia, "fotografiaHash" FROM q23_fotografia_financeira_materializada_257(${propostaId})`;
  return linhas[0] ?? null;
}

/** Prepara somente a confirmação sem delta: não cria nem altera efeitos financeiros. */
export async function proporRevisaoFinanceiraCorrecaoAula(input: unknown) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaCorrecaoAulaId: id, motivo: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input);
    const entradaHash = hash(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await exigirFinanceiroTx(tx, usuario.id);
      const existente = await tx.propostaRevisaoFinanceiraCorrecaoAula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Esta chave já identifica outra revisão financeira.");
        return { id: existente.id, propostaCorrecaoAulaId: existente.propostaCorrecaoAulaId, versao: existente.versao };
      }
      const proposta = await tx.propostaCorrecaoAula.findUnique({ where: { id: d.propostaCorrecaoAulaId }, select: { id: true, encontroId: true, versao: true, entradaHash: true, encontro: { select: { matriculaId: true } } } });
      if (!proposta?.encontro.matriculaId) throw new ErroRegra("A revisão financeira exige aula particular identificada.");
      const foto = await fotoAtualTx(tx, proposta.id);
      if (!foto) throw new ErroRegra("A fotografia não comprova equivalência Q92 sem alteração de valores. Pendências, reservas não consumidas, cancelamentos e outros efeitos financeiros seguem fluxo próprio.");
      const ultima = await tx.propostaRevisaoFinanceiraCorrecaoAula.findFirst({ where: { propostaCorrecaoAulaId: proposta.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const revisao = await tx.propostaRevisaoFinanceiraCorrecaoAula.create({ data: {
        propostaCorrecaoAulaId: proposta.id, versao: (ultima?.versao ?? 0) + 1, versaoCorrecaoAula: proposta.versao,
        tipo: "SEM_ALTERACAO_VALORES", preparadorId: usuario.id, propostaHash: proposta.entradaHash,
        fotografia: foto.fotografia as Prisma.InputJsonValue, fotografiaHash: foto.fotografiaHash, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "RevisaoFinanceiraCorrecaoAulaProposta", agregadoTipo: "Matricula", agregadoId: proposta.encontro.matriculaId,
        autorId: usuario.id, payload: { revisaoId: revisao.id, propostaCorrecaoAulaId: proposta.id, versao: revisao.versao, tipo: revisao.tipo } });
      return { id: revisao.id, propostaCorrecaoAulaId: proposta.id, versao: revisao.versao };
    });
  });
}

/** Decide a revisão; aprovação não publica nem altera a correção Q23. */
export async function decidirRevisaoFinanceiraCorrecaoAula(input: unknown) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaId: id, aprovada: z.boolean(), motivo: texto }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await exigirFinanceiroTx(tx, usuario.id);
      const proposta = await tx.propostaRevisaoFinanceiraCorrecaoAula.findUnique({ where: { id: d.propostaId }, include: { decisao: true, propostaCorrecaoAula: { select: { encontro: { select: { matriculaId: true } } } } } });
      if (!proposta?.propostaCorrecaoAula.encontro.matriculaId) throw new ErroRegra("Revisão financeira não encontrada.");
      if (proposta.decisao) {
        if (proposta.decisao.decisorId !== usuario.id || proposta.decisao.aprovada !== d.aprovada || proposta.decisao.motivo !== d.motivo) throw new ErroRegra("A revisão já possui decisão imutável.");
        return { id: proposta.decisao.id, propostaId: proposta.id, aprovada: proposta.decisao.aprovada };
      }
      const decisao = await tx.decisaoRevisaoFinanceiraCorrecaoAula.create({ data: { propostaId: proposta.id, decisorId: usuario.id,
        aprovada: d.aprovada, motivo: d.motivo, propostaHash: proposta.propostaHash, fotografiaHash: proposta.fotografiaHash } });
      await registrarEvento(tx, { tipo: "RevisaoFinanceiraCorrecaoAulaDecidida", agregadoTipo: "Matricula", agregadoId: proposta.propostaCorrecaoAula.encontro.matriculaId,
        autorId: usuario.id, payload: { revisaoId: proposta.id, decisaoId: decisao.id, aprovada: decisao.aprovada } });
      return { id: decisao.id, propostaId: proposta.id, aprovada: decisao.aprovada };
    });
  });
}

/** Projeção financeira por matrícula: não expõe diário, notas ou avaliações. */
export async function consultarRevisoesFinanceirasCorrecaoAula(input: unknown) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ matriculaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await exigirFinanceiroTx(tx, usuario.id);
      const revisoesBrutas = await tx.propostaRevisaoFinanceiraCorrecaoAula.findMany({ where: { propostaCorrecaoAula: { encontro: { matriculaId: d.matriculaId } } }, orderBy: [{ propostaCorrecaoAula: { versao: "desc" } }, { versao: "desc" }],
        select: { id: true, versao: true, tipo: true, motivo: true, criadaEm: true, propostaCorrecaoAulaId: true, fotografia: true, fotografiaHash: true, preparador: { select: { id: true, nome: true, ativo: true, papeis: true } }, decisao: { select: { id: true, aprovada: true, motivo: true, criadaEm: true, decisor: { select: { id: true, nome: true, ativo: true, papeis: true } } } }, propostaCorrecaoAula: { select: { versao: true, entradaHash: true, autorId: true, encontro: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } } } } } });
      const revisoes = revisoesBrutas.map(revisao => {
        const foto = revisao.fotografia as Record<string, unknown>;
        // Financeiro vê somente a memória financeira já imutável. Diário,
        // conteúdo e chamadas continuam restritos ao fluxo pedagógico Q23.
        return { ...revisao,
          podeDecidir: temAlcadaFinanceira(usuario) && !revisao.decisao && revisao.preparador.id !== usuario.id && revisao.propostaCorrecaoAula.autorId !== usuario.id,
          fotografia: { fundamento: foto.fundamento, ocorrencia: foto.ocorrencia, conferencia: foto.conferencia, reservaConsumida: foto.reservaConsumida,
            compraAntecipada: foto.compraAntecipada, condicoes: foto.condicoes, cobranca: foto.cobranca, informesPagamento: foto.informesPagamento,
            recebimentos: foto.recebimentos, destinacoes: foto.destinacoes },
        };
      });
      const brutas = await tx.propostaCorrecaoAula.findMany({ where: { encontro: { matriculaId: d.matriculaId }, rejeicao: null, aprovacao: null }, orderBy: { versao: "desc" }, distinct: ["encontroId"], select: { id: true, encontroId: true, versao: true, encontro: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } } } });
      // The SQL projection is the eligibility authority. Do not expose a Q23
      // motive merely because it belongs to this enrolment.
      const candidatas: Array<(typeof brutas)[number] & { podePreparar: boolean; preparoBloqueadoPor: string | null }> = [];
      for (const candidata of brutas) {
        const foto = await fotoAtualTx(tx, candidata.id);
        if (!foto) continue;
        const ultima = revisoesBrutas.find(r => r.propostaCorrecaoAulaId === candidata.id);
        if (!ultima) {
          candidatas.push({ ...candidata, podePreparar: true, preparoBloqueadoPor: null });
          continue;
        }
        const fotografiaAtual = ultima.fotografiaHash === foto.fotografiaHash;
        const preparadorAtual = temAlcadaFinanceira(ultima.preparador);
        const decisorAtual = !ultima.decisao || temAlcadaFinanceira(ultima.decisao.decisor);
        const podePreparar = ultima.decisao?.aprovada === false || !fotografiaAtual || !preparadorAtual || !decisorAtual;
        const preparoBloqueadoPor = podePreparar ? null
          : ultima.decisao ? "A revisão aprovada permanece vigente e aguarda publicação pedagógica."
            : "A revisão financeira vigente aguarda decisão independente.";
        candidatas.push({ ...candidata, podePreparar, preparoBloqueadoPor });
      }
      return { usuarioId: usuario.id, revisoes, candidatas };
    });
  });
}
