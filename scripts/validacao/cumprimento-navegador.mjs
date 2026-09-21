// Fixture e verificação somente no banco local descartável, com dados fictícios.
// Preparar após encerramento-navegador.mjs preparar. A conferência ocorre pela UI.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/cumprimento-navegador.json";
try {
  if (process.argv[2] === "preparar") {
    const f = JSON.parse(await fs.readFile("node_modules/.implementation/encerramento-navegador.json", "utf8"));
    const p = await db.usuario.findUniqueOrThrow({ where: { email: "encerramento-operador@validacao.test" } });
    const a = await db.usuario.findUniqueOrThrow({ where: { email: "encerramento-aprovador@validacao.test" } });
    await db.matricula.update({ where: { id: f.matriculaId }, data: { ativadaEm: new Date("2026-01-01") } });
    const comp = await db.compensacaoCoberturaMatricula.create({ data: { matriculaId: f.matriculaId, cobrancaOrigemId: f.cobrancaId,
      preparadorId: p.id, decisorId: a.id, status: "APROVADA", motivo: "Indisponibilidade fictícia", evidenciaCondicoes: "Condições fictícias", diasPropostos: ["2026-08-10"],
      coberturaOriginalInicio: new Date("2026-08-01"), coberturaOriginalFim: new Date("2026-08-31"), valorCoberturaOriginal: 400, moeda: "BRL", cobrancaVersao: 0, motivoDecisao: "Fixture aprovada", decididaEm: new Date() } });
    const direito = await db.diaCompensacaoCobertura.create({ data: { compensacaoId: comp.id, matriculaId: f.matriculaId, diaOrigem: new Date("2026-08-10") } });
    const r = await db.rascunhoRecomposicaoCobertura.create({ data: { matriculaId: f.matriculaId, preparadorId: p.id, versao: 1, chaveIdempotencia: `fixture-${f.matriculaId}`, entradaHash: "fixture", entrada: {}, snapshot: { proposta: { destinos: [{ id: direito.id, diaCompensadoProposto: "2026-09-01" }] } } } });
    const decisao = await db.decisaoRecomposicaoCobertura.create({ data: { rascunhoId: r.id, decisorId: a.id, aprovada: true, motivo: "Programação fictícia aprovada" } });
    const aplicacao = await db.aplicacaoRecomposicaoCobertura.create({ data: { decisaoId: decisao.id, executorId: a.id } });
    const dia = await db.diaProgramadoRecomposicao.create({ data: { aplicacaoId: aplicacao.id, direitoId: direito.id, dataCobertura: new Date("2026-09-01") } });
    await fs.writeFile(arquivo, JSON.stringify({ ...f, programacaoId: dia.id, direitoId: direito.id })); console.log(JSON.stringify(f));
  } else {
    const f = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const cs = await db.conferenciaCumprimentoRecomposicao.findMany({ where: { programacaoId: f.programacaoId } });
    const d = await db.diaCompensacaoCobertura.findUniqueOrThrow({ where: { id: f.direitoId } });
    const checks = { conferenciaUnica: cs.length === 1, aprovada: cs[0]?.status === "APROVADA", independente: cs[0]?.decisorId != null && cs[0]?.decisorId !== cs[0]?.preparadorId,
      direitoCumprido: d.estado === "RECOMPOSTO" && d.versao === 2 && d.destinacaoReferencia === cs[0]?.id,
      semRecebimento: await db.recebimento.count({ where: { cobrancaId: f.cobrancaId } }) === 0 };
    await fs.writeFile("docs/validacao-cumprimento-navegador-2026-09-11.json", JSON.stringify({ executadoEm: new Date().toISOString(), ambiente: "Local descartável; fixture com programação prévia, conferência pela interface", checks }, null, 2));
    console.log(JSON.stringify(checks)); if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
  }
} finally { await db.$disconnect(); }
