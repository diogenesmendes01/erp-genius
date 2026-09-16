// Somente banco local descartável. Preparar após encerramento-navegador.mjs preparar.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/recomposicao-navegador.json";
try {
  if (process.argv[2] === "preparar") {
    const f = JSON.parse(await fs.readFile("node_modules/.implementation/encerramento-navegador.json", "utf8"));
    const preparador = await db.usuario.findUniqueOrThrow({ where: { email: "encerramento-operador@validacao.test" } });
    const decisor = await db.usuario.findUniqueOrThrow({ where: { email: "encerramento-aprovador@validacao.test" } });
    const m = await db.matricula.findUniqueOrThrow({ where: { id: f.matriculaId } });
    const comp = await db.compensacaoCoberturaMatricula.create({ data: { matriculaId: m.id, cobrancaOrigemId: f.cobrancaId, documentoOrigemId: m.contratoDocumentoId,
      preparadorId: preparador.id, decisorId: decisor.id, status: "APROVADA", motivo: "Indisponibilidade fictícia", evidenciaCondicoes: "Condições fictícias conferidas", diasPropostos: ["2099-09-10", "2099-09-11"],
      coberturaOriginalInicio: new Date("2099-09-01"), coberturaOriginalFim: new Date("2099-09-30"), valorCoberturaOriginal: 400, moeda: "BRL", cobrancaVersao: 0, motivoDecisao: "Conferência fictícia independente", decididaEm: new Date(),
    } });
    await db.diaCompensacaoCobertura.createMany({ data: ["2099-09-10", "2099-09-11"].map((d) => ({ matriculaId: m.id, compensacaoId: comp.id, diaOrigem: new Date(d) })) });
    const futura = await db.cobranca.create({ data: { matriculaId: m.id, tipo: "MENSALIDADE", moeda: "BRL", valorOriginal: 400, valorNegociado: 400, vencimento: new Date("2099-10-05"), coberturaInicio: new Date("2099-10-01"), coberturaFim: new Date("2099-10-31") } });
    await fs.writeFile(arquivo, JSON.stringify({ ...f, futuraId: futura.id })); console.log(JSON.stringify({ ...f, futuraId: futura.id }));
  } else {
    const f = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const r = await db.rascunhoRecomposicaoCobertura.findMany({ where: { matriculaId: f.matriculaId }, include: { decisao: { include: { aplicacao: { include: { dias: true } } } } } });
    const c = await db.cobranca.findUniqueOrThrow({ where: { id: f.futuraId } });
    const m = await db.matricula.findMany({ where: { alunoId: f.alunoId } });
    const checks = { rascunhoUnico: r.length === 1, aprovacaoIndependente: r[0]?.decisao?.aprovada === true && r[0].preparadorId !== r[0].decisao.decisorId,
      aplicada: !!r[0]?.decisao?.aplicacao, doisDiasProgramados: r[0]?.decisao?.aplicacao?.dias.length === 2,
      coberturaDeslocada: c.coberturaInicio?.toISOString().slice(0, 10) === "2099-10-03" && c.coberturaFim?.toISOString().slice(0, 10) === "2099-11-02",
      financeiroPreservado: c.valorNegociado.equals(400) && c.vencimento.toISOString().slice(0, 10) === "2099-10-05" && await db.recebimento.count({ where: { cobrancaId: c.id } }) === 0,
      direitosNaoConsumidos: await db.diaCompensacaoCobertura.count({ where: { matriculaId: f.matriculaId, estado: "PENDENTE" } }) === 2,
      contratosPreservados: m.length === 2 && m.every((v) => v.status === "ATIVA"),
    };
    await fs.writeFile("docs/validacao-recomposicao-navegador-2026-09-11.json", JSON.stringify({ executadoEm: new Date().toISOString(), ambiente: "Local descartável; dados fictícios", checks }, null, 2));
    console.log(JSON.stringify(checks)); if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
  }
} finally { await db.$disconnect(); }
