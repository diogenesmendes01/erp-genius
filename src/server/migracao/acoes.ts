"use server";

import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { EntradaPrepararLoteMigracao, estadoDaLinha, identidadeDaFonte, pendenciasDaLinha, textoDaCelula, type LinhaPreparacaoEntrada } from "./preparacao";

const TIPOS = ["ALUNO", "TURMA", "MATRICULA", "FINANCEIRO"] as const;
type TipoFonte = typeof TIPOS[number];

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, ordenar(item)]));
  return valor;
}
function hash(valor: unknown) { return createHash("sha256").update(JSON.stringify(ordenar(valor))).digest("hex"); }

async function adminFrescoTx(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Sua permissão mudou; inicie a preparação novamente.");
}

function dadosDaLinha(linha: LinhaPreparacaoEntrada) {
  return {
    aluno: linha.aluno ?? null, turma: linha.turma ?? null, matricula: linha.matricula ?? null, alocacao: linha.alocacao ?? null,
    financeiro: linha.financeiro ?? null, consentimentoOrigem: linha.consentimentoOrigem ?? null,
    presencaOrigem: linha.presencaOrigem ?? null, dadosAdicionais: linha.dadosAdicionais,
  };
}

function diferem(a: unknown, b: unknown) { return hash(a) !== hash(b); }

export async function prepararLoteMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const entrada = EntradaPrepararLoteMigracao.parse(input);
    const entradaHash = hash(entrada);
    return prisma.$transaction(async (tx) => {
      // A identidade de uma fonte pode reaparecer em lotes diferentes. Um lock por
      // origem impede que duas transações aceitem, ao mesmo tempo, versões divergentes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-preparacao:${entrada.origem}`}, 0))`;
      await adminFrescoTx(tx, autor.id);
      const existente = await tx.lotePreparacaoMigracao.findUnique({ where: { origem_chaveLote: { origem: entrada.origem, chaveLote: entrada.chaveLote } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) {
          const linhasAnteriores = await tx.linhaPreparacaoMigracao.findMany({ where: { loteId: existente.id }, select: { linhaOrigem: true, entradaHash: true } });
          const porLinha = new Map(linhasAnteriores.map((linha) => [linha.linhaOrigem, linha.entradaHash]));
          const conflitos: { linhaOrigem: string; entradaHash: string; codigo: string; dadosConflitantes: Prisma.InputJsonValue }[] = entrada.linhas.filter((linha) => porLinha.get(linha.linhaOrigem) !== hash(linha)).map((linha) => ({ linhaOrigem: linha.linhaOrigem, entradaHash: hash(linha), codigo: porLinha.has(linha.linhaOrigem) ? "LINHA_ORIGEM_DIVERGENTE" : "LINHA_ORIGEM_NOVA", dadosConflitantes: dadosDaLinha(linha) }));
          const linhasRecebidas = new Set(entrada.linhas.map((linha) => linha.linhaOrigem));
          for (const linhaAnterior of linhasAnteriores) if (!linhasRecebidas.has(linhaAnterior.linhaOrigem)) conflitos.push({ linhaOrigem: linhaAnterior.linhaOrigem, entradaHash: hash({ loteId: existente.id, linhaOrigem: linhaAnterior.linhaOrigem, codigo: "LINHA_ORIGEM_AUSENTE_NO_REENVIO" }), codigo: "LINHA_ORIGEM_AUSENTE_NO_REENVIO", dadosConflitantes: { ausenteDoReenvio: true } });
          await tx.conflitoLinhaPreparacaoMigracao.createMany({ data: conflitos.map((conflito) => ({ loteId: existente.id, ...conflito })), skipDuplicates: true });
          await tx.lotePreparacaoMigracao.update({ where: { id: existente.id }, data: { estado: "COM_PENDENCIAS" } });
          if (conflitos.length) await registrarEvento(tx, { tipo: "ConflitoPreparacaoMigracaoRegistrado", agregadoTipo: "LotePreparacaoMigracao", agregadoId: existente.id, autorId: autor.id, payload: { origem: entrada.origem, chaveLote: entrada.chaveLote, conflitos: conflitos.map((conflito) => ({ linhaOrigem: conflito.linhaOrigem, entradaHash: conflito.entradaHash })) } });
          return { loteId: existente.id, repetido: false, estado: "COM_PENDENCIAS" as const, revisaoNecessaria: true };
        }
        return { loteId: existente.id, repetido: true, estado: existente.estado };
      }

      const lote = await tx.lotePreparacaoMigracao.create({ data: { origem: entrada.origem, chaveLote: entrada.chaveLote, entradaHash, estado: "PREPARADO", preparadoPorId: autor.id } });
      let possuiPendencias = false;
      for (const linha of entrada.linhas) {
        const pendencias = pendenciasDaLinha(linha);
        const criada = await tx.linhaPreparacaoMigracao.create({ data: {
          loteId: lote.id, linhaOrigem: linha.linhaOrigem, alunoOrigemId: textoDaCelula(linha.aluno?.id), turmaOrigemId: textoDaCelula(linha.turma?.id),
          matriculaOrigemId: textoDaCelula(linha.matricula?.id), financeiroOrigemId: textoDaCelula(linha.financeiro?.id),
          dadosOrigem: dadosDaLinha(linha), entradaHash: hash(linha), estado: estadoDaLinha(pendencias),
          // O cliente Prisma é regenerado pelo integrador junto da migration 180.
          ...( { tipoEntrada: linha.tipoEntrada } as unknown as Record<string, unknown> ),
          pendencias: { create: pendencias },
        } });
        if (pendencias.length) possuiPendencias = true;

        for (const tipo of TIPOS) {
          const identidade = identidadeDaFonte(linha, tipo);
          if (!identidade) continue;
          const campo = tipo === "ALUNO" ? "alunoOrigemId" : tipo === "TURMA" ? "turmaOrigemId" : tipo === "MATRICULA" ? "matriculaOrigemId" : "financeiroOrigemId";
          const candidatas = await tx.linhaPreparacaoMigracao.findMany({
            where: { id: { not: criada.id }, lote: { origem: entrada.origem }, [campo]: identidade.id },
            select: { id: true, loteId: true, dadosOrigem: true },
          });
          for (const candidata of candidatas) {
            const dadosExistentes = (candidata.dadosOrigem as Record<string, unknown>)[tipo.toLowerCase()];
            if (!diferem(dadosExistentes, identidade.dados)) {
              // A repetição de ID idêntico continua pendente: não representa uma
              // associação automática entre linhas da origem.
              possuiPendencias = true;
              await tx.colisaoOrigemPreparacaoMigracao.createMany({ data: [{ tipo: `${tipo}_REPETIDO`, identificadorOrigem: identidade.id, linhaExistenteId: candidata.id, linhaConflitanteId: criada.id }], skipDuplicates: true });
              await tx.linhaPreparacaoMigracao.updateMany({ where: { id: { in: [candidata.id, criada.id] } }, data: { estado: "COLISAO_ORIGEM" } });
              await tx.lotePreparacaoMigracao.update({ where: { id: candidata.loteId }, data: { estado: "COM_PENDENCIAS" } });
              continue;
            }
            possuiPendencias = true;
            await tx.colisaoOrigemPreparacaoMigracao.createMany({ data: [{ tipo, identificadorOrigem: identidade.id, linhaExistenteId: candidata.id, linhaConflitanteId: criada.id }], skipDuplicates: true });
            await tx.linhaPreparacaoMigracao.updateMany({ where: { id: { in: [candidata.id, criada.id] } }, data: { estado: "COLISAO_ORIGEM" } });
            await tx.lotePreparacaoMigracao.update({ where: { id: candidata.loteId }, data: { estado: "COM_PENDENCIAS" } });
          }
        }
      }
      const estado = possuiPendencias ? "COM_PENDENCIAS" as const : "PREPARADO" as const;
      await tx.lotePreparacaoMigracao.update({ where: { id: lote.id }, data: { estado } });
      await registrarEvento(tx, { tipo: "LotePreparacaoMigracaoCriado", agregadoTipo: "LotePreparacaoMigracao", agregadoId: lote.id, autorId: autor.id, payload: { origem: entrada.origem, chaveLote: entrada.chaveLote, linhas: entrada.linhas.length, estado } });
      return { loteId: lote.id, repetido: false, estado };
    });
  });
}
