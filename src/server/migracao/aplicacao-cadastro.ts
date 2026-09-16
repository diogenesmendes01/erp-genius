"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const Entrada = z.object({ loteId: z.string().min(1).max(100), modo: z.enum(["ENSAIO", "APLICAR"]), confirmacaoHash: z.string().length(64).optional() }).strict();
type Linha = { id: string; entradaHash: string; tipoEntrada: string; alunoOrigemId: string | null; dadosOrigem: unknown; pendencias: bigint; colisoes: bigint; origem: string };
type AlunoFonte = { id: string; nome: string; email: string; documento: string; pais: string; fuso: string };
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : typeof valor === "number" ? String(valor) : "";
function alunoDaFonte(dados: unknown): AlunoFonte | null {
  const aluno = (dados as { aluno?: Record<string, unknown> } | null)?.aluno;
  if (!aluno) return null;
  const id = texto(aluno.id), nome = texto(aluno.nome), email = texto(aluno.email).toLowerCase(), documento = texto(aluno.documento), pais = texto(aluno.pais).toUpperCase(), fuso = texto(aluno.fuso);
  if (!id || !nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !documento || !/^[A-Z]{2}$/.test(pais) || !fuso) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: fuso }).format(); } catch { return null; }
  return { id, nome, email, documento, pais, fuso };
}
function nomePartes(nome: string) { const [primeiroNome, ...resto] = nome.trim().split(/\s+/); return { primeiroNome: primeiroNome!, sobrenome: resto.join(" ") || null }; }
function hashConfirmacao(linhas: Linha[]) { return createHash("sha256").update(linhas.map((linha) => `${linha.id}:${linha.entradaHash}`).sort().join("|"), "utf8").digest("hex"); }
async function adminFresco(tx: Prisma.TransactionClient, id: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${id} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
}
async function evidenciar(tx: Prisma.TransactionClient, linha: Linha, situacao: "ENSAIO_VALIDO" | "APLICADO" | "BLOQUEADO" | "DIVERGENCIA_DESTINO", autorId: string, alunoId?: string, detalhe?: string) {
  await tx.$executeRaw`INSERT INTO "AplicacaoCadastroMigracao" (id, "linhaId", "entradaHash", situacao, "alunoId", detalhe, "executadoPorId") VALUES (${randomUUID()}, ${linha.id}, ${linha.entradaHash}, ${situacao}::"SituacaoAplicacaoCadastroMigracao", ${alunoId ?? null}, ${detalhe ?? null}, ${autorId}) ON CONFLICT ("linhaId", "entradaHash", situacao) DO NOTHING`;
}

/** Ensaia ou aplica somente CADASTRO completo; nunca cria contrato, vínculo, cobrança, consentimento ou conta. */
export async function aplicarCadastroPreparacaoMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const entrada = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-aplicacao:${entrada.loteId}`}, 0))`;
      await adminFresco(tx, autor.id);
      const linhas = await tx.$queryRaw<Linha[]>(Prisma.sql`
        SELECT l.id, l."entradaHash", l."tipoEntrada"::text AS "tipoEntrada", l."alunoOrigemId", l."dadosOrigem", lote.origem,
          (SELECT count(*) FROM "PendenciaCampoPreparacaoMigracao" p WHERE p."linhaId" = l.id) AS pendencias,
          ((SELECT count(*) FROM "ColisaoOrigemPreparacaoMigracao" c WHERE c."linhaExistenteId" = l.id) + (SELECT count(*) FROM "ColisaoOrigemPreparacaoMigracao" c WHERE c."linhaConflitanteId" = l.id)) AS colisoes
        FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lote ON lote.id = l."loteId"
        WHERE l."loteId" = ${entrada.loteId} FOR UPDATE OF l`);
      if (!linhas.length) return { aplicadas: 0, ensaiadas: 0, bloqueadas: 0, divergencias: 0, confirmacaoHash: null, explicacao: "Lote não encontrado." };
      const confirmacaoHash = hashConfirmacao(linhas);
      if (entrada.modo === "APLICAR" && entrada.confirmacaoHash !== confirmacaoHash) return { aplicadas: 0, ensaiadas: 0, bloqueadas: 0, divergencias: 0, confirmacaoHash: null, explicacao: "Faça um novo ensaio: a fotografia do lote ou a confirmação não corresponde." };
      // A ordem global por origem/ID evita corrida entre lotes e deadlock quando
      // a mesma fonte reaparece em mais de um lote.
      const identidades = linhas.map((linha) => alunoDaFonte(linha.dadosOrigem)).filter((fonte): fonte is AlunoFonte => !!fonte)
        .map((fonte) => `${linhas.find((linha) => alunoDaFonte(linha.dadosOrigem)?.id === fonte.id)?.origem ?? ""}:${fonte.id}`).sort();
      for (const identidade of [...new Set(identidades)]) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-aluno-origem:${identidade}`}, 0))`;
      const resultado = { aplicadas: 0, ensaiadas: 0, bloqueadas: 0, divergencias: 0 };
      for (const linha of linhas) {
        const fonte = alunoDaFonte(linha.dadosOrigem);
        if (linha.tipoEntrada !== "CADASTRO" || linha.pendencias > 0n || linha.colisoes > 0n || !fonte || fonte.id !== linha.alunoOrigemId) {
          await evidenciar(tx, linha, "BLOQUEADO", autor.id, undefined, "Linha não é cadastro completo ou possui pendência/colisão."); resultado.bloqueadas++; continue;
        }
        const paises = await tx.pais.findMany({ where: { codigoISO: fonte.pais, status: "ATIVO" }, select: { id: true } });
        if (paises.length !== 1) { await evidenciar(tx, linha, "BLOQUEADO", autor.id, undefined, "País de origem não corresponde a país ativo inequívoco."); resultado.bloqueadas++; continue; }
        const pais = paises[0]!;
        const mapas = await tx.$queryRaw<{ alunoId: string; primeiroNome: string; sobrenome: string | null; email: string | null; documento: string | null; paisId: string; fuso: string | null }[]>(Prisma.sql`
          SELECT mapa."alunoId", a."primeiroNome", a.sobrenome, a.email, a.documento, a."paisId", a.fuso
          FROM "MapaOrigemAlunoMigracao" mapa JOIN "Aluno" a ON a.id = mapa."alunoId"
          WHERE mapa.origem = ${linha.origem} AND mapa."alunoOrigemId" = ${fonte.id} FOR UPDATE OF mapa, a`);
        const partes = nomePartes(fonte.nome), existente = mapas[0];
        if (existente && (existente.primeiroNome !== partes.primeiroNome || existente.sobrenome !== partes.sobrenome || existente.email !== fonte.email || existente.documento !== fonte.documento || existente.paisId !== pais.id || existente.fuso !== fonte.fuso)) {
          await evidenciar(tx, linha, "DIVERGENCIA_DESTINO", autor.id, existente.alunoId, "Destino associado diverge da fotografia; nenhuma sobrescrita foi feita."); resultado.divergencias++; continue;
        }
        const candidatos = !existente ? await tx.aluno.findMany({ where: { OR: [{ email: fonte.email }, { documento: fonte.documento }] }, select: { id: true } }) : [];
        if (candidatos.length) { await evidenciar(tx, linha, "BLOQUEADO", autor.id, undefined, "E-mail ou documento já existe sem mapa de origem; exige conferência humana."); resultado.bloqueadas++; continue; }
        if (entrada.modo === "ENSAIO") { await evidenciar(tx, linha, "ENSAIO_VALIDO", autor.id, existente?.alunoId, existente ? "Destino já corresponde à fotografia." : "Cadastro pode ser criado com os campos mapeados."); resultado.ensaiadas++; continue; }
        const ensaio = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "AplicacaoCadastroMigracao" WHERE "linhaId" = ${linha.id} AND "entradaHash" = ${linha.entradaHash} AND situacao = 'ENSAIO_VALIDO'::"SituacaoAplicacaoCadastroMigracao" FOR SHARE`);
        if (!ensaio.length) { await evidenciar(tx, linha, "BLOQUEADO", autor.id, undefined, "Aplique somente a fotografia que possui ensaio persistido."); resultado.bloqueadas++; continue; }
        if (existente) { await evidenciar(tx, linha, "APLICADO", autor.id, existente.alunoId, "Replay da aplicação já conciliado com o destino."); resultado.aplicadas++; continue; }
        const alunoId = randomUUID();
        await tx.aluno.create({ data: { id: alunoId, ...partes, email: fonte.email, documento: fonte.documento, paisId: pais.id, fuso: fonte.fuso, whatsapp: false, aceitaComunicacoes: false } });
        await tx.$executeRaw`INSERT INTO "MapaOrigemAlunoMigracao" (id, origem, "alunoOrigemId", "alunoId") VALUES (${randomUUID()}, ${linha.origem}, ${fonte.id}, ${alunoId})`;
        await evidenciar(tx, linha, "APLICADO", autor.id, alunoId, "Cadastro criado exclusivamente com campos mapeados."); resultado.aplicadas++;
      }
      const resultados = await tx.$queryRaw<{ linhaOrigem: string; situacao: string; alunoId: string | null; detalhe: string | null }[]>(Prisma.sql`
        SELECT DISTINCT ON (l.id) l."linhaOrigem", a.situacao::text, a."alunoId", a.detalhe
        FROM "LinhaPreparacaoMigracao" l LEFT JOIN "AplicacaoCadastroMigracao" a ON a."linhaId" = l.id AND a."entradaHash" = l."entradaHash"
        WHERE l."loteId" = ${entrada.loteId} ORDER BY l.id, a."criadoEm" DESC NULLS LAST`);
      return { ...resultado, resultados, confirmacaoHash: entrada.modo === "ENSAIO" ? confirmacaoHash : null, explicacao: "Apenas cadastros completos foram ensaiados ou aplicados; demais entidades permanecem em conferência." };
    });
  });
}
